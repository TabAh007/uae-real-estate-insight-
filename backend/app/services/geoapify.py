"""Geoapify client — geocoding, and a Places fallback for sparse OSM areas.

Free tier: 3,000 requests/day. Sign up at https://www.geoapify.com.
"""
import httpx

from app.config import settings
from app.schemas import GeocodeResult, Poi
from app.services.overpass import _haversine_m

GEOCODE_URL = "https://api.geoapify.com/v1/geocode/search"
PLACES_URL = "https://api.geoapify.com/v2/places"

# Our POI category labels -> Geoapify's category taxonomy (used only as an OSM
# fallback, so labels stay identical to overpass.POI_TAGS values).
GEOAPIFY_CATEGORY = {
    "school": "education.school",
    "hospital": "healthcare.hospital",
    "clinic": "healthcare.clinic_or_praxis",
    "pharmacy": "healthcare.pharmacy",
    "supermarket": "commercial.supermarket",
    "mall": "commercial.shopping_mall",
    "metro_station": "public_transport",
    "park": "leisure.park",
    "place_of_worship": "religion.place_of_worship",
}


async def geocode_address(address: str) -> GeocodeResult | None:
    if not settings.geoapify_configured:
        raise RuntimeError("GEOAPIFY_API_KEY is not set — see backend/.env.example")

    params = {
        "text": address,
        "filter": "countrycode:ae",
        "limit": 1,
        "apiKey": settings.geoapify_api_key,
    }
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(GEOCODE_URL, params=params)
        response.raise_for_status()
        features = response.json().get("features", [])

    if not features:
        return None

    props = features[0]["properties"]
    lon, lat = features[0]["geometry"]["coordinates"]
    return GeocodeResult(formatted_address=props.get("formatted", address), lat=lat, lon=lon)


def _label_for(feature_categories: list[str], wanted: dict[str, str]) -> str:
    for label, gcat in wanted.items():
        if any(c == gcat or c.startswith(gcat + ".") for c in feature_categories):
            return label
    return "other"


async def nearby_places(lat: float, lon: float, radius_m: int, labels: set[str]) -> list[Poi]:
    """Geoapify Places for the given category labels — used to fill gaps where
    OpenStreetMap returned nothing. Returns [] if Geoapify isn't configured."""
    if not settings.geoapify_configured:
        return []
    wanted = {label: GEOAPIFY_CATEGORY[label] for label in labels if label in GEOAPIFY_CATEGORY}
    if not wanted:
        return []

    params = {
        "categories": ",".join(sorted(set(wanted.values()))),
        "filter": f"circle:{lon},{lat},{radius_m}",
        "limit": 60,
        "apiKey": settings.geoapify_api_key,
    }
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(PLACES_URL, params=params)
        response.raise_for_status()
        features = response.json().get("features", [])

    pois: list[Poi] = []
    for feature in features:
        props = feature.get("properties", {})
        name = props.get("name")
        if not name:
            continue
        p_lat, p_lon = props.get("lat"), props.get("lon")
        if p_lat is None or p_lon is None:
            coords = feature.get("geometry", {}).get("coordinates")
            if not coords:
                continue
            p_lon, p_lat = coords[0], coords[1]

        pois.append(
            Poi(
                name=name,
                category=_label_for(props.get("categories", []), wanted),
                lat=p_lat,
                lon=p_lon,
                distance_m=round(_haversine_m(lat, lon, p_lat, p_lon), 1),
                source="geoapify",
            )
        )
    return pois

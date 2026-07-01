"""OpenStreetMap Overpass API client — free, no key required.

Used for the "what's nearby" neighborhood feature. Coverage is strong for
metro stations/malls/landmarks in Dubai/Abu Dhabi but can be sparse for
residential-area amenities; pair with GeoapifyClient.nearby_places as a
fallback when a category returns zero results.
"""
import httpx

from app.schemas import Poi

# Primary + fallback mirror — the main instance intermittently 406s without
# these headers, and public Overpass instances occasionally rate-limit.
OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
REQUEST_HEADERS = {
    "Accept": "application/json",
    "User-Agent": "uae-real-estate-insight/0.1 (https://github.com/; contact via repo issues)",
}

# OSM tag -> our category label
POI_TAGS = {
    "amenity=school": "school",
    "amenity=hospital": "hospital",
    "amenity=clinic": "clinic",
    "amenity=place_of_worship": "place_of_worship",
    "amenity=pharmacy": "pharmacy",
    "shop=supermarket": "supermarket",
    "shop=mall": "mall",
    "railway=station": "metro_station",
    "leisure=park": "park",
}


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    from math import atan2, cos, radians, sin, sqrt

    r = 6_371_000
    d_lat, d_lon = radians(lat2 - lat1), radians(lon2 - lon1)
    a = sin(d_lat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lon / 2) ** 2
    return 2 * r * atan2(sqrt(a), sqrt(1 - a))


async def find_nearby_pois(lat: float, lon: float, radius_m: int = 1200) -> list[Poi]:
    clauses = "".join(
        f'nwr[{tag.split("=")[0]}="{tag.split("=")[1]}"](around:{radius_m},{lat},{lon});'
        for tag in POI_TAGS
    )
    query = f"[out:json][timeout:20];({clauses});out center;"

    async with httpx.AsyncClient(timeout=25, headers=REQUEST_HEADERS) as client:
        last_error: Exception | None = None
        elements = []
        for url in OVERPASS_URLS:
            try:
                response = await client.post(url, data={"data": query})
                response.raise_for_status()
                elements = response.json().get("elements", [])
                break
            except (httpx.HTTPStatusError, httpx.TransportError) as exc:
                last_error = exc
        else:
            raise last_error

    pois: list[Poi] = []
    for el in elements:
        tags = el.get("tags", {})
        name = tags.get("name") or tags.get("name:en")
        if not name:
            continue
        el_lat = el.get("lat") or el.get("center", {}).get("lat")
        el_lon = el.get("lon") or el.get("center", {}).get("lon")
        if el_lat is None or el_lon is None:
            continue

        category = next(
            (label for tag, label in POI_TAGS.items() if tags.get(tag.split("=")[0]) == tag.split("=")[1]),
            "other",
        )
        pois.append(
            Poi(
                name=name,
                category=category,
                lat=el_lat,
                lon=el_lon,
                distance_m=round(_haversine_m(lat, lon, el_lat, el_lon), 1),
            )
        )

    return sorted(pois, key=lambda p: p.distance_m)

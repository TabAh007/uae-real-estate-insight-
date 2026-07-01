"""Geoapify client — geocoding, and a Places fallback for sparse OSM areas.

Free tier: 3,000 requests/day. Sign up at https://www.geoapify.com.
"""
import httpx

from app.config import settings
from app.schemas import GeocodeResult

GEOCODE_URL = "https://api.geoapify.com/v1/geocode/search"


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

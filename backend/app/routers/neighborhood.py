from fastapi import APIRouter, Query

from app.schemas import NeighborhoodResponse
from app.services.overpass import find_nearby_pois

router = APIRouter(prefix="/neighborhood", tags=["neighborhood"])


@router.get("/nearby", response_model=NeighborhoodResponse)
async def nearby(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    radius_m: int = Query(1200, ge=100, le=5000),
) -> NeighborhoodResponse:
    pois = await find_nearby_pois(lat, lon, radius_m)
    return NeighborhoodResponse(lat=lat, lon=lon, radius_m=radius_m, pois=pois)

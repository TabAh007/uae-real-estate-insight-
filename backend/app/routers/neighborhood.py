from fastapi import APIRouter, HTTPException, Query

from app.schemas import NeighborhoodResponse
from app.services.overpass import OverpassUnavailable, find_nearby_pois

router = APIRouter(prefix="/neighborhood", tags=["neighborhood"])


@router.get("/nearby", response_model=NeighborhoodResponse)
async def nearby(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    radius_m: int = Query(1200, ge=100, le=5000),
) -> NeighborhoodResponse:
    try:
        pois = await find_nearby_pois(lat, lon, radius_m)
    except OverpassUnavailable as exc:
        raise HTTPException(status_code=503, detail=f"{exc} — please try again in a moment.") from exc
    return NeighborhoodResponse(lat=lat, lon=lon, radius_m=radius_m, pois=pois)

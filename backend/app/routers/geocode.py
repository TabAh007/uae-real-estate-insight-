from fastapi import APIRouter, HTTPException, Query

from app.schemas import GeocodeResult
from app.services.geoapify import geocode_address

router = APIRouter(prefix="/geocode", tags=["geocode"])


@router.get("", response_model=GeocodeResult)
async def geocode(address: str = Query(..., min_length=3)) -> GeocodeResult:
    try:
        result = await geocode_address(address)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    if result is None:
        raise HTTPException(status_code=404, detail="No match found for that address")
    return result

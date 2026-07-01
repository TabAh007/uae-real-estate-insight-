from fastapi import APIRouter, HTTPException, Query

from app.config import settings
from app.schemas import NeighborhoodResponse, SchoolsResponse
from app.services import geoapify, khda_schools
from app.services.overpass import POI_TAGS, OverpassUnavailable, find_nearby_pois

router = APIRouter(prefix="/neighborhood", tags=["neighborhood"])

ALL_CATEGORIES = set(POI_TAGS.values())


@router.get("/nearby", response_model=NeighborhoodResponse)
async def nearby(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    radius_m: int = Query(1200, ge=100, le=5000),
) -> NeighborhoodResponse:
    try:
        pois = await find_nearby_pois(lat, lon, radius_m)
    except OverpassUnavailable as exc:
        # OSM down entirely — serve everything from Geoapify if we can.
        if settings.geoapify_configured:
            pois = await geoapify.nearby_places(lat, lon, radius_m, ALL_CATEGORIES)
            pois.sort(key=lambda p: p.distance_m)
            return NeighborhoodResponse(
                lat=lat, lon=lon, radius_m=radius_m, pois=pois,
                source="geoapify (openstreetmap unavailable)",
            )
        raise HTTPException(status_code=503, detail=f"{exc} — please try again in a moment.") from exc

    # OSM up but sparse: fill categories it returned nothing for from Geoapify.
    source = "openstreetmap"
    missing = ALL_CATEGORIES - {p.category for p in pois}
    if missing and settings.geoapify_configured:
        extra = await geoapify.nearby_places(lat, lon, radius_m, missing)
        if extra:
            pois = sorted(pois + extra, key=lambda p: p.distance_m)
            source = f"openstreetmap (+geoapify fallback: {', '.join(sorted({p.category for p in extra}))})"

    return NeighborhoodResponse(lat=lat, lon=lon, radius_m=radius_m, pois=pois, source=source)


@router.get("/schools", response_model=SchoolsResponse)
async def schools(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    radius_m: int = Query(3000, ge=100, le=10000),
) -> SchoolsResponse:
    if not khda_schools.has_data():
        source = "no KHDA school data — add DubaiPrivateSchoolsOpenData.xlsx to backend/data/ (see README)"
        return SchoolsResponse(lat=lat, lon=lon, radius_m=radius_m, schools=[], source=source)
    found = khda_schools.find_nearby(lat, lon, radius_m)
    return SchoolsResponse(lat=lat, lon=lon, radius_m=radius_m, schools=found, source="khda_open_data")

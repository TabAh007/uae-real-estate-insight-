from statistics import median, quantiles

from fastapi import APIRouter, HTTPException

from app.schemas import ValuationRequest, ValuationResponse
from app.services.transactions_source import get_transactions

router = APIRouter(prefix="/valuation", tags=["valuation"])

# A "comparable" should be a similar-sized unit — a studio and a penthouse in
# the same area have wildly different price/sqm, so raw min/max across all of
# them yields a uselessly wide band. Keep sales within ±SIZE_TOLERANCE of the
# subject's floor area, and require at least MIN_COMPS before trusting the
# filter; otherwise fall back to the full area/type set.
SIZE_TOLERANCE = 0.35
MIN_COMPS = 5


@router.post("/estimate", response_model=ValuationResponse)
async def estimate(payload: ValuationRequest) -> ValuationResponse:
    all_comps, source = await get_transactions(
        area=payload.area, property_type=payload.property_type
    )
    if not all_comps:
        raise HTTPException(
            status_code=404,
            detail=f"No comparable transactions found for {payload.property_type} in {payload.area}",
        )

    lo, hi = payload.size_sqm * (1 - SIZE_TOLERANCE), payload.size_sqm * (1 + SIZE_TOLERANCE)
    sized = [t for t in all_comps if lo <= t.size_sqm <= hi]

    if payload.bedrooms is not None:
        by_bed = [t for t in sized if t.bedrooms == payload.bedrooms]
        if len(by_bed) >= MIN_COMPS:
            sized = by_bed

    if len(sized) >= MIN_COMPS:
        used = sized
        method = (
            f"Interquartile (25th–75th percentile) price/sqm of {len(used)} "
            f"comparables within ±{int(SIZE_TOLERANCE * 100)}% of {payload.size_sqm:g} sqm"
        )
    else:
        # Not enough size-matched sales — widen to all area/type comps and say so.
        used = all_comps
        method = (
            f"Interquartile (25th–75th percentile) price/sqm of all {len(used)} "
            f"{payload.property_type} sales in {payload.area} (too few size-matched comps to narrow)"
        )

    prices_per_sqm = sorted(t.price_per_sqm for t in used)
    median_psm = median(prices_per_sqm)
    if len(prices_per_sqm) >= 4:
        q25, _, q75 = quantiles(prices_per_sqm, n=4)
    else:
        q25, q75 = prices_per_sqm[0], prices_per_sqm[-1]

    # Show the comparables closest in size to the subject first.
    closest = sorted(used, key=lambda t: abs(t.size_sqm - payload.size_sqm))

    response = ValuationResponse(
        area=payload.area,
        property_type=payload.property_type,
        size_sqm=payload.size_sqm,
        estimated_low_aed=round(q25 * payload.size_sqm, -2),
        estimated_mid_aed=round(median_psm * payload.size_sqm, -2),
        estimated_high_aed=round(q75 * payload.size_sqm, -2),
        price_per_sqm_median=round(median_psm, 2),
        comparables_used=len(used),
        comparables=closest[:10],
        asking_price_aed=payload.asking_price_aed,
        method=method,
        source=source,
    )

    if payload.asking_price_aed is not None:
        if payload.asking_price_aed < response.estimated_low_aed:
            response.asking_price_verdict = "below comparable range — potentially underpriced"
        elif payload.asking_price_aed > response.estimated_high_aed:
            response.asking_price_verdict = "above comparable range — potentially overpriced"
        else:
            response.asking_price_verdict = "within comparable range"

    return response

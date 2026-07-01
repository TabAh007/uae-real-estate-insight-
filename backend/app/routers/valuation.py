from statistics import median

from fastapi import APIRouter, HTTPException

from app.config import settings
from app.schemas import Transaction, ValuationRequest, ValuationResponse
from app.services import sample_data
from app.services.dubai_pulse import dubai_pulse_client

router = APIRouter(prefix="/valuation", tags=["valuation"])


async def _comparables(area: str, property_type: str) -> tuple[list[Transaction], str]:
    if settings.dubai_pulse_configured:
        records = await dubai_pulse_client.search_transactions(area=area, property_type=property_type)
        return records, "dubai_pulse"

    records = [
        t
        for t in sample_data.SAMPLE_TRANSACTIONS
        if t.area.lower() == area.lower() and t.property_type.lower() == property_type.lower()
    ]
    return records, "sample_data (DUBAI_PULSE_* not configured — see backend/.env.example)"


@router.post("/estimate", response_model=ValuationResponse)
async def estimate(payload: ValuationRequest) -> ValuationResponse:
    comparables, source = await _comparables(payload.area, payload.property_type)
    if not comparables:
        raise HTTPException(
            status_code=404,
            detail=f"No comparable transactions found for {payload.property_type} in {payload.area}",
        )

    prices_per_sqm = sorted(t.price_per_sqm for t in comparables)
    median_psm = median(prices_per_sqm)
    # Comparable-sales range, not a single point estimate — see project README
    # on why a bare number is misleading without a confidence band.
    low_psm = prices_per_sqm[0]
    high_psm = prices_per_sqm[-1]

    response = ValuationResponse(
        area=payload.area,
        property_type=payload.property_type,
        size_sqm=payload.size_sqm,
        estimated_low_aed=round(low_psm * payload.size_sqm, -2),
        estimated_mid_aed=round(median_psm * payload.size_sqm, -2),
        estimated_high_aed=round(high_psm * payload.size_sqm, -2),
        price_per_sqm_median=median_psm,
        comparables_used=len(comparables),
        comparables=comparables[:10],
        asking_price_aed=payload.asking_price_aed,
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

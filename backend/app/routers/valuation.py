from statistics import median, quantiles

from fastapi import APIRouter, HTTPException

from app.schemas import RentalYieldResponse, ValuationRequest, ValuationResponse
from app.services import comps
from app.services.transactions_source import get_rent_contracts, get_transactions

router = APIRouter(prefix="/valuation", tags=["valuation"])


def _median_psm(records: list, psm_attr: str) -> float:
    return median(getattr(r, psm_attr) for r in records)


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

    used, narrowed = comps.select_by_size(all_comps, payload.size_sqm, payload.bedrooms)
    if narrowed:
        method = (
            f"Interquartile (25th–75th percentile) price/sqm of {len(used)} "
            f"comparables within ±{int(comps.SIZE_TOLERANCE * 100)}% of {payload.size_sqm:g} sqm"
        )
    else:
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


@router.post("/rental-yield", response_model=RentalYieldResponse)
async def rental_yield(payload: ValuationRequest) -> RentalYieldResponse:
    sales, sale_source = await get_transactions(area=payload.area, property_type=payload.property_type)
    rents, rent_source = await get_rent_contracts(area=payload.area, property_type=payload.property_type)

    if not sales:
        raise HTTPException(
            status_code=404,
            detail=f"No comparable sales for {payload.property_type} in {payload.area} — can't compute yield.",
        )
    if not rents:
        raise HTTPException(status_code=404, detail=f"No rent data available: {rent_source}")

    # Normalise both sides to price/sqm so the sale and rent comp sets don't
    # have to be the exact same size to compare fairly.
    sale_comps, _ = comps.select_by_size(sales, payload.size_sqm, payload.bedrooms)
    rent_comps, _ = comps.select_by_size(rents, payload.size_sqm, payload.bedrooms)

    sale_psm = _median_psm(sale_comps, "price_per_sqm")
    rent_psm = _median_psm(rent_comps, "annual_rent_per_sqm")

    estimated_sale = sale_psm * payload.size_sqm
    estimated_rent = rent_psm * payload.size_sqm
    gross_yield = rent_psm / sale_psm * 100 if sale_psm else 0.0

    return RentalYieldResponse(
        area=payload.area,
        property_type=payload.property_type,
        size_sqm=payload.size_sqm,
        estimated_annual_rent_aed=round(estimated_rent, -2),
        estimated_sale_value_aed=round(estimated_sale, -2),
        gross_yield_pct=round(gross_yield, 2),
        sale_comps_used=len(sale_comps),
        rent_comps_used=len(rent_comps),
        method=(
            f"Median annual rent/sqm ({len(rent_comps)} contracts) ÷ median sale "
            f"price/sqm ({len(sale_comps)} sales), size-matched to {payload.size_sqm:g} sqm"
        ),
        sale_source=sale_source,
        rent_source=rent_source,
    )

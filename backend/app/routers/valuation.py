from statistics import median, quantiles

from fastapi import APIRouter, HTTPException

from app.schemas import (
    InvestmentScoreResponse,
    RentalYieldResponse,
    ScoreComponent,
    ValuationRequest,
    ValuationResponse,
)
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


def _value_component(asking: float | None, est_value: float) -> ScoreComponent | None:
    """Asking price vs. comparable value. Skipped if no asking price given."""
    if asking is None or est_value <= 0:
        return None
    ratio = asking / est_value
    if ratio < 0.90:
        score, verdict = 35.0, f"~{round((1 - ratio) * 100)}% below comparable value — a discount"
    elif ratio <= 1.00:
        score, verdict = 28.0, "at or just below comparable value"
    elif ratio <= 1.10:
        score, verdict = 16.0, f"~{round((ratio - 1) * 100)}% above comparable value"
    else:
        score, verdict = 5.0, f"~{round((ratio - 1) * 100)}% above comparable value — a premium"
    return ScoreComponent(name="Value vs. comparables", score=score, max_score=35, detail=verdict)


def _yield_component(gross_yield: float | None) -> ScoreComponent | None:
    """Higher gross yield scores higher, capped at 40 (≈8%+)."""
    if gross_yield is None:
        return None
    score = max(0.0, min(40.0, gross_yield / 8 * 40))
    return ScoreComponent(
        name="Gross rental yield",
        score=round(score, 1),
        max_score=40,
        detail=f"{gross_yield:.1f}% gross (8%+ scores full marks)",
    )


def _liquidity_component(n_sales: int) -> ScoreComponent:
    """More recent comparable sales = more liquid, easier-to-exit market."""
    score = min(25.0, n_sales / 80 * 25)
    return ScoreComponent(
        name="Market liquidity",
        score=round(score, 1),
        max_score=25,
        detail=f"{n_sales} recent sales of this type in {'the area' if n_sales else 'this area'} (80+ scores full marks)",
    )


@router.post("/investment-score", response_model=InvestmentScoreResponse)
async def investment_score(payload: ValuationRequest) -> InvestmentScoreResponse:
    sales, sale_source = await get_transactions(area=payload.area, property_type=payload.property_type)
    if not sales:
        raise HTTPException(
            status_code=404,
            detail=f"No comparable sales for {payload.property_type} in {payload.area}.",
        )

    sale_comps, _ = comps.select_by_size(sales, payload.size_sqm, payload.bedrooms)
    sale_psm = _median_psm(sale_comps, "price_per_sqm")
    est_value = sale_psm * payload.size_sqm

    rents, rent_source = await get_rent_contracts(area=payload.area, property_type=payload.property_type)
    gross_yield = None
    if rents:
        rent_comps, _ = comps.select_by_size(rents, payload.size_sqm, payload.bedrooms)
        gross_yield = _median_psm(rent_comps, "annual_rent_per_sqm") / sale_psm * 100 if sale_psm else None

    components = [
        c
        for c in (
            _value_component(payload.asking_price_aed, est_value),
            _yield_component(gross_yield),
            _liquidity_component(len(sales)),
        )
        if c is not None
    ]

    earned = sum(c.score for c in components)
    possible = sum(c.max_score for c in components)
    overall = round(earned / possible * 100) if possible else 0

    # Liquidity alone isn't enough to judge an investment.
    assessable = [c for c in components if c.name != "Market liquidity"]
    if not assessable:
        rating = "Insufficient data (add an asking price and/or rent data)"
    elif overall >= 70:
        rating = "Attractive"
    elif overall >= 55:
        rating = "Fair"
    elif overall >= 40:
        rating = "Weak"
    else:
        rating = "Poor"

    return InvestmentScoreResponse(
        area=payload.area,
        property_type=payload.property_type,
        size_sqm=payload.size_sqm,
        overall_score=overall,
        rating=rating,
        components=components,
        estimated_value_aed=round(est_value, -2),
        gross_yield_pct=round(gross_yield, 2) if gross_yield is not None else None,
        sale_source=sale_source,
        rent_source=rent_source,
    )

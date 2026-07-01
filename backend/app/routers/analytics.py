from collections import defaultdict
from datetime import datetime, timedelta
from statistics import median

from fastapi import APIRouter, HTTPException, Query

from app.schemas import PriceTrendPoint, PriceTrendResponse
from app.services.transactions_source import get_transactions

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _bucket(date_str: str, granularity: str) -> str:
    d = datetime.strptime(date_str[:10], "%Y-%m-%d").date()
    if granularity == "month":
        return d.strftime("%Y-%m")
    if granularity == "week":
        return (d - timedelta(days=d.weekday())).strftime("%Y-%m-%d")  # Monday
    return d.strftime("%Y-%m-%d")  # day


@router.get("/price-trend", response_model=PriceTrendResponse)
async def price_trend(
    area: str,
    property_type: str,
    granularity: str = Query("month", pattern="^(day|week|month)$"),
) -> PriceTrendResponse:
    sales, source = await get_transactions(area=area, property_type=property_type)
    if not sales:
        raise HTTPException(
            status_code=404,
            detail=f"No transactions for {property_type} in {area}.",
        )

    buckets: dict[str, list[float]] = defaultdict(list)
    for t in sales:
        if not t.transaction_date:
            continue
        try:
            buckets[_bucket(t.transaction_date, granularity)].append(t.price_per_sqm)
        except ValueError:
            continue

    points = [
        PriceTrendPoint(period=period, median_price_per_sqm=round(median(psms)), count=len(psms))
        for period, psms in sorted(buckets.items())
    ]

    # The trend is only meaningful with several time buckets; flag when the
    # loaded export covers too narrow a window (see backend/data/README.md).
    note = None
    if len(points) < 3:
        note = (
            f"Only {len(points)} {granularity} bucket(s) in the loaded data — "
            "download a wider DLD date range for a real trend."
        )

    return PriceTrendResponse(
        area=area,
        property_type=property_type,
        granularity=granularity,
        points=points,
        source=source,
        note=note,
    )

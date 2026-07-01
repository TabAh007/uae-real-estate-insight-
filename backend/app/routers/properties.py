from fastapi import APIRouter, Query

from app.schemas import TransactionsResponse
from app.services.transactions_source import get_facets, get_transactions

router = APIRouter(prefix="/properties", tags=["properties"])


@router.get("/transactions", response_model=TransactionsResponse)
async def transactions(
    area: str | None = None,
    property_type: str | None = None,
    bedrooms: int | None = None,
) -> TransactionsResponse:
    records, source = await get_transactions(area, property_type, bedrooms)
    return TransactionsResponse(transactions=records, source=source)


@router.get("/list", response_model=TransactionsResponse)
async def list_properties(
    area: str | None = None,
    property_type: str | None = None,
    bedrooms: int | None = None,
    limit: int = Query(60, ge=1, le=300),
) -> TransactionsResponse:
    """Recent transactions as browsable properties — newest first, capped."""
    records, source = await get_transactions(area, property_type, bedrooms)
    records = sorted(records, key=lambda t: t.transaction_date, reverse=True)[:limit]
    return TransactionsResponse(transactions=records, source=source)


@router.get("/facets")
async def facets() -> dict[str, list[str]]:
    return await get_facets()

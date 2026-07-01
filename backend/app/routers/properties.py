from fastapi import APIRouter

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


@router.get("/facets")
async def facets() -> dict[str, list[str]]:
    return await get_facets()

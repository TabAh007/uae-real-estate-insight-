from fastapi import APIRouter, Query

from app.config import settings
from app.schemas import TransactionsResponse
from app.services import sample_data
from app.services.dubai_pulse import dubai_pulse_client

router = APIRouter(prefix="/properties", tags=["properties"])


@router.get("/transactions", response_model=TransactionsResponse)
async def transactions(
    area: str | None = None,
    property_type: str | None = None,
    bedrooms: int | None = None,
) -> TransactionsResponse:
    if settings.dubai_pulse_configured:
        records = await dubai_pulse_client.search_transactions(area, property_type, bedrooms)
        source = "dubai_pulse"
    else:
        records = [
            t
            for t in sample_data.SAMPLE_TRANSACTIONS
            if (not area or t.area.lower() == area.lower())
            and (not property_type or t.property_type.lower() == property_type.lower())
            and (bedrooms is None or t.bedrooms == bedrooms)
        ]
        source = "sample_data (DUBAI_PULSE_* not configured — see backend/.env.example)"

    return TransactionsResponse(transactions=records, source=source)

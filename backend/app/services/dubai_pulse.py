"""Client for the Dubai Pulse open-data API (Dubai Land Department datasets).

Apply for API access at https://www.dubaipulse.gov.ae — approval issues an
OAuth2 client-credentials Client ID/Secret and the dataset-specific base URL.
Fill DUBAI_PULSE_* into backend/.env once approved; the exact query params
below (area/property_type/bedrooms) should be checked against the dataset
schema you're granted, since Dubai Pulse dataset field names can vary by
dataset version.

Until then, `app.config.settings.dubai_pulse_configured` is False and
routers fall back to `app.services.sample_data`.
"""
import time

import httpx

from app.config import settings
from app.schemas import Transaction


class DubaiPulseClient:
    def __init__(self) -> None:
        self._token: str | None = None
        self._token_expires_at: float = 0.0

    async def _get_access_token(self, client: httpx.AsyncClient) -> str:
        if self._token and time.monotonic() < self._token_expires_at:
            return self._token

        response = await client.post(
            settings.dubai_pulse_token_url,
            data={
                "grant_type": "client_credentials",
                "client_id": settings.dubai_pulse_client_id,
                "client_secret": settings.dubai_pulse_client_secret,
            },
        )
        response.raise_for_status()
        payload = response.json()
        self._token = payload["access_token"]
        self._token_expires_at = time.monotonic() + payload.get("expires_in", 3600) - 30
        return self._token

    async def search_transactions(
        self,
        area: str | None = None,
        property_type: str | None = None,
        bedrooms: int | None = None,
        limit: int = 500,
    ) -> list[Transaction]:
        async with httpx.AsyncClient(timeout=15) as client:
            token = await self._get_access_token(client)
            params = {"limit": limit}
            if area:
                params["area_name_en"] = area
            if property_type:
                params["property_type_en"] = property_type
            if bedrooms is not None:
                params["rooms_en"] = bedrooms

            response = await client.get(
                settings.dubai_pulse_transactions_url,
                params=params,
                headers={"Authorization": f"Bearer {token}"},
            )
            response.raise_for_status()
            raw_records = response.json().get("records", [])

        return [
            Transaction(
                area=record.get("area_name_en", area or "unknown"),
                property_type=record.get("property_type_en", property_type or "unknown"),
                bedrooms=record.get("rooms_en"),
                size_sqm=float(record.get("procedure_area", 0) or 0),
                price_aed=float(record.get("actual_worth", 0) or 0),
                transaction_date=record.get("instance_date", ""),
            )
            for record in raw_records
            if record.get("procedure_area") and record.get("actual_worth")
        ]


dubai_pulse_client = DubaiPulseClient()

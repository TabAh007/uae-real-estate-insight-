"""Single source-of-truth for where transaction data comes from.

Priority: live Dubai Pulse API (if credentials set) -> local DLD CSV export
(if any dropped in backend/data/) -> bundled sample data. Both routers call
this so the fallback logic lives in exactly one place.
"""
from app.config import settings
from app.schemas import RentContract, Transaction
from app.services import dld_csv, dld_rent_csv, sample_data, sample_rents
from app.services.dubai_pulse import dubai_pulse_client


async def get_transactions(
    area: str | None = None,
    property_type: str | None = None,
    bedrooms: int | None = None,
) -> tuple[list[Transaction], str]:
    if settings.dubai_pulse_configured:
        records = await dubai_pulse_client.search_transactions(area, property_type, bedrooms)
        return records, "dubai_pulse_api"

    if dld_csv.has_data():
        return dld_csv.search(area, property_type, bedrooms), "dld_csv (backend/data/)"

    records = [
        t
        for t in sample_data.SAMPLE_TRANSACTIONS
        if (not area or t.area.lower() == area.lower())
        and (not property_type or t.property_type.lower() == property_type.lower())
        and (bedrooms is None or t.bedrooms == bedrooms)
    ]
    return records, "sample_data (no Dubai Pulse creds and no CSV — see backend/data/README.md)"


async def get_rent_contracts(
    area: str | None = None,
    property_type: str | None = None,
    bedrooms: int | None = None,
) -> tuple[list[RentContract], str]:
    """Rent contracts for yield. Priority: real rent CSV -> sample rents (only
    when sales are ALSO sample, so a real-sales + sample-rents mix that would
    produce a bogus yield never happens) -> empty with guidance."""
    if dld_rent_csv.has_data():
        return dld_rent_csv.search(area, property_type, bedrooms), "dld_rent_csv (backend/data/)"

    if not dld_csv.has_data():
        records = [
            c
            for c in sample_rents.SAMPLE_RENTS
            if (not area or c.area.lower() == area.lower())
            and (not property_type or c.property_type.lower() == property_type.lower())
            and (bedrooms is None or c.bedrooms == bedrooms)
        ]
        return records, "sample_rents (demo)"

    return [], "no rent data — download the DLD rent-contracts CSV (see backend/data/README.md)"


async def get_facets() -> dict[str, list[str]]:
    """Distinct areas / property types present in the active data source, so the
    frontend dropdowns reflect real data (e.g. 'Flat' vs 'Apartment') instead of
    a hardcoded guess."""
    records, _ = await get_transactions()
    areas = sorted({t.area for t in records if t.area})
    property_types = sorted({t.property_type for t in records if t.property_type})
    return {"areas": areas, "property_types": property_types}

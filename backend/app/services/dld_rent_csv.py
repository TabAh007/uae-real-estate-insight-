"""Loads Dubai Land Department rent-contract CSV exports (no API key).

Download from https://dubailand.gov.ae/en/open-data/real-estate-data/
(Rent Transaction Details -> Download as CSV) and drop it in backend/data/.
Sales CSVs in the same folder are ignored here (detected by header).
"""
import csv
import glob
import os

from app.schemas import RentContract
from app.services import csv_utils
from app.services.dld_csv import DATA_DIR

COLUMN_CANDIDATES = {
    "area": ["AREA_EN", "Area", "area_name_en"],
    "property_type": [
        "EJARI_PROP_SUB_TYPE_EN", "PROP_SB_TYPE_EN", "Property Sub Type",
        "EJARI_PROP_TYPE_EN", "PROP_TYPE_EN", "Property Type", "property_type_en",
    ],
    # Prefer the annualised figure; CONTRACT_AMOUNT can cover a multi-year term.
    "annual_rent": ["ANNUAL_AMOUNT", "Annual Amount", "annual_amount"],
    "contract_amount": ["CONTRACT_AMOUNT", "Contract Amount", "contract_amount"],
    "size_sqm": ["ACTUAL_AREA", "PROP_SIZE", "Property Size (sq.m)", "actual_area"],
    "rooms": ["ROOMS_EN", "Number of Rooms", "ROOMS", "rooms"],
    "date": ["REGISTRATION_DATE", "Registration Date", "CONTRACT_START_DATE", "Start Date", "registration_date"],
}


def _row_to_contract(row: dict[str, str]) -> RentContract | None:
    annual = csv_utils.parse_float(csv_utils.pick(row, COLUMN_CANDIDATES["annual_rent"]))
    if annual is None:
        annual = csv_utils.parse_float(csv_utils.pick(row, COLUMN_CANDIDATES["contract_amount"]))
    size = csv_utils.parse_float(csv_utils.pick(row, COLUMN_CANDIDATES["size_sqm"]))
    if not annual or not size:
        return None

    return RentContract(
        area=(csv_utils.pick(row, COLUMN_CANDIDATES["area"]) or "unknown").strip(),
        property_type=(csv_utils.pick(row, COLUMN_CANDIDATES["property_type"]) or "unknown").strip(),
        bedrooms=csv_utils.parse_rooms(csv_utils.pick(row, COLUMN_CANDIDATES["rooms"])),
        size_sqm=size,
        annual_rent_aed=annual,
        registration_date=(csv_utils.pick(row, COLUMN_CANDIDATES["date"]) or "").strip(),
    )


def _load() -> list[RentContract]:
    contracts: list[RentContract] = []
    for path in sorted(glob.glob(os.path.join(DATA_DIR, "*.csv"))):
        with open(path, newline="", encoding="utf-8-sig") as handle:
            reader = csv.DictReader(handle)
            if csv_utils.header_kind(reader.fieldnames) != "rent":
                continue
            for row in reader:
                contract = _row_to_contract(row)
                if contract:
                    contracts.append(contract)
    return contracts


CONTRACTS: list[RentContract] = _load()


def has_data() -> bool:
    return len(CONTRACTS) > 0


def search(
    area: str | None = None,
    property_type: str | None = None,
    bedrooms: int | None = None,
) -> list[RentContract]:
    return [
        c
        for c in CONTRACTS
        if (not area or c.area.lower() == area.lower())
        and (not property_type or c.property_type.lower() == property_type.lower())
        and (bedrooms is None or c.bedrooms == bedrooms)
    ]

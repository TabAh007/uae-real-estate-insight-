"""Loads Dubai Land Department open-data CSV exports (no API key required).

Download a CSV from https://dubailand.gov.ae/en/open-data/real-estate-data/
(Transaction Details -> Download as CSV) and drop it in backend/data/. Every
`*.csv` there is loaded on startup and exposed the same way as the Dubai Pulse
API, so routers can treat both identically.

If the portal renames a column in a future export, adjust COLUMN_MAP below.
"""
import csv
import glob
import os
import re

from app.schemas import Transaction

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")

# DLD exports come in two header styles: the machine names in the "Download as
# CSV" file (AREA_EN, TRANS_VALUE, ...) and the human-readable names shown in
# the web table (Area, Amount, ...). Each field lists the candidate headers in
# priority order; the loader uses the first one present in the file, so either
# export — and roughly the Dubai Pulse API shape — works unchanged.
COLUMN_CANDIDATES = {
    "area": ["AREA_EN", "Area", "area_name_en"],
    # Sub type (Flat/Villa) is finer than PROP_TYPE_EN (Unit/Building/Land).
    "property_type": ["PROP_SB_TYPE_EN", "Property Sub Type", "PROP_TYPE_EN", "Property Type", "property_type_en"],
    "price_aed": ["TRANS_VALUE", "Amount", "ACTUAL_WORTH", "actual_worth"],
    "size_sqm": ["ACTUAL_AREA", "PROCEDURE_AREA", "Property Size (sq.m)", "procedure_area"],
    "rooms": ["ROOMS_EN", "Room(s)", "rooms_en"],
    "date": ["INSTANCE_DATE", "Transaction Date", "instance_date"],
}


def _pick(row: dict[str, str], field: str) -> str | None:
    for header in COLUMN_CANDIDATES[field]:
        if header in row and row[header] not in (None, ""):
            return row[header]
    return None


def _parse_rooms(value: str | None) -> int | None:
    if not value:
        return None
    text = value.strip().lower()
    if "studio" in text:
        return 0
    match = re.search(r"\d+", text)
    return int(match.group()) if match else None


def _parse_float(value: str | None) -> float | None:
    if not value:
        return None
    cleaned = value.replace(",", "").strip()
    try:
        return float(cleaned)
    except ValueError:
        return None


def _row_to_transaction(row: dict[str, str]) -> Transaction | None:
    price = _parse_float(_pick(row, "price_aed"))
    size = _parse_float(_pick(row, "size_sqm"))
    if not price or not size:
        return None

    return Transaction(
        area=(_pick(row, "area") or "unknown").strip(),
        property_type=(_pick(row, "property_type") or "unknown").strip(),
        bedrooms=_parse_rooms(_pick(row, "rooms")),
        size_sqm=size,
        price_aed=price,
        transaction_date=(_pick(row, "date") or "").strip(),
    )


def _load() -> list[Transaction]:
    transactions: list[Transaction] = []
    for path in sorted(glob.glob(os.path.join(DATA_DIR, "*.csv"))):
        with open(path, newline="", encoding="utf-8-sig") as handle:
            for row in csv.DictReader(handle):
                txn = _row_to_transaction(row)
                if txn:
                    transactions.append(txn)
    return transactions


# Loaded once at import (startup). Restart the backend after adding a CSV.
TRANSACTIONS: list[Transaction] = _load()


def has_data() -> bool:
    return len(TRANSACTIONS) > 0


def search(
    area: str | None = None,
    property_type: str | None = None,
    bedrooms: int | None = None,
) -> list[Transaction]:
    return [
        t
        for t in TRANSACTIONS
        if (not area or t.area.lower() == area.lower())
        and (not property_type or t.property_type.lower() == property_type.lower())
        and (bedrooms is None or t.bedrooms == bedrooms)
    ]

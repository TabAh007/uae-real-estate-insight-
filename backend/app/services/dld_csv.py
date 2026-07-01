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

# DLD portal (English) header -> our field. Kept explicit so a renamed export
# column is a one-line fix rather than a silent data-loss bug.
COLUMN_MAP = {
    "area": "Area",
    "property_type": "Property Sub Type",  # e.g. Flat/Villa — finer than "Property Type" (Land/Building/Unit)
    "price_aed": "Amount",
    "size_sqm": "Property Size (sq.m)",
    "rooms": "Room(s)",
    "date": "Transaction Date",
}


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
    price = _parse_float(row.get(COLUMN_MAP["price_aed"]))
    size = _parse_float(row.get(COLUMN_MAP["size_sqm"]))
    if not price or not size:
        return None

    return Transaction(
        area=(row.get(COLUMN_MAP["area"]) or "unknown").strip(),
        property_type=(row.get(COLUMN_MAP["property_type"]) or "unknown").strip(),
        bedrooms=_parse_rooms(row.get(COLUMN_MAP["rooms"])),
        size_sqm=size,
        price_aed=price,
        transaction_date=(row.get(COLUMN_MAP["date"]) or "").strip(),
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

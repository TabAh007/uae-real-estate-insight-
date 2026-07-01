"""Loads Dubai Land Department sales-transaction CSV exports (no API key).

Download from https://dubailand.gov.ae/en/open-data/real-estate-data/
(Transaction Details -> Download as CSV) and drop it in backend/data/. Rent
CSVs in the same folder are ignored here (see dld_rent_csv.py).
"""
import csv
import glob
import os

from app.schemas import Transaction
from app.services import csv_utils

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")

# DLD exports use either machine names (from "Download as CSV") or the web
# table's display names. Each field lists candidates in priority order.
COLUMN_CANDIDATES = {
    "area": ["AREA_EN", "Area", "area_name_en"],
    # Sub type (Flat/Villa) is finer than PROP_TYPE_EN (Unit/Building/Land).
    "property_type": ["PROP_SB_TYPE_EN", "Property Sub Type", "PROP_TYPE_EN", "Property Type", "property_type_en"],
    "price_aed": ["TRANS_VALUE", "Amount", "ACTUAL_WORTH", "actual_worth"],
    "size_sqm": ["ACTUAL_AREA", "PROCEDURE_AREA", "Property Size (sq.m)", "procedure_area"],
    "rooms": ["ROOMS_EN", "Room(s)", "rooms_en"],
    "date": ["INSTANCE_DATE", "Transaction Date", "instance_date"],
}


def _row_to_transaction(row: dict[str, str]) -> Transaction | None:
    price = csv_utils.parse_float(csv_utils.pick(row, COLUMN_CANDIDATES["price_aed"]))
    size = csv_utils.parse_float(csv_utils.pick(row, COLUMN_CANDIDATES["size_sqm"]))
    if not price or not size:
        return None

    return Transaction(
        area=(csv_utils.pick(row, COLUMN_CANDIDATES["area"]) or "unknown").strip(),
        property_type=(csv_utils.pick(row, COLUMN_CANDIDATES["property_type"]) or "unknown").strip(),
        bedrooms=csv_utils.parse_rooms(csv_utils.pick(row, COLUMN_CANDIDATES["rooms"])),
        size_sqm=size,
        price_aed=price,
        transaction_date=(csv_utils.pick(row, COLUMN_CANDIDATES["date"]) or "").strip(),
    )


def _load() -> list[Transaction]:
    transactions: list[Transaction] = []
    for path in sorted(glob.glob(os.path.join(DATA_DIR, "*.csv"))):
        with open(path, newline="", encoding="utf-8-sig") as handle:
            reader = csv.DictReader(handle)
            if csv_utils.header_kind(reader.fieldnames) != "sales":
                continue  # a rent (or unrecognized) file — not ours
            for row in reader:
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

"""Shared helpers for parsing DLD CSV exports (sales and rents)."""
import re

# Headers that identify a file's kind, so sales and rent CSVs can coexist in
# backend/data/ and each loader only ingests its own files.
SALES_PRICE_HEADERS = {"TRANS_VALUE", "Amount", "ACTUAL_WORTH", "actual_worth"}
RENT_AMOUNT_HEADERS = {
    "ANNUAL_AMOUNT", "Annual Amount", "annual_amount",
    "CONTRACT_AMOUNT", "Contract Amount", "contract_amount",
}


def parse_float(value: str | None) -> float | None:
    if not value:
        return None
    try:
        return float(value.replace(",", "").strip())
    except ValueError:
        return None


def parse_rooms(value: str | None) -> int | None:
    """DLD uses 'Studio', '1 B/R', '2 B/R', etc."""
    if not value:
        return None
    text = value.strip().lower()
    if "studio" in text:
        return 0
    match = re.search(r"\d+", text)
    return int(match.group()) if match else None


def pick(row: dict[str, str], candidates: list[str]) -> str | None:
    """First non-empty value among candidate header names, in priority order."""
    for header in candidates:
        if header in row and row[header] not in (None, ""):
            return row[header]
    return None


def header_kind(fieldnames: list[str] | None) -> str:
    """Classify a CSV as 'sales', 'rent', or 'unknown' from its headers.

    Sales wins if a sale-price column is present (a sales export never carries a
    rent-amount column), so a rent file is one with a rent amount and no price.
    """
    headers = set(fieldnames or [])
    if headers & SALES_PRICE_HEADERS:
        return "sales"
    if headers & RENT_AMOUNT_HEADERS:
        return "rent"
    return "unknown"

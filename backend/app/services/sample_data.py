"""Local sample transactions used until Dubai Pulse API access is approved.

Shape mirrors the real DLD transactions dataset so this can be swapped for
`DubaiPulseClient.search_transactions` without changing any router code.
NOT real data — for local development and demoing the API contract only.
"""
from app.schemas import Transaction

SAMPLE_TRANSACTIONS: list[Transaction] = [
    Transaction(area="Dubai Marina", property_type="Apartment", bedrooms=1, size_sqm=68, price_aed=1_450_000, transaction_date="2026-01-14"),
    Transaction(area="Dubai Marina", property_type="Apartment", bedrooms=1, size_sqm=72, price_aed=1_520_000, transaction_date="2026-02-02"),
    Transaction(area="Dubai Marina", property_type="Apartment", bedrooms=2, size_sqm=110, price_aed=2_300_000, transaction_date="2026-01-28"),
    Transaction(area="Dubai Marina", property_type="Apartment", bedrooms=2, size_sqm=105, price_aed=2_150_000, transaction_date="2025-12-19"),
    Transaction(area="Dubai Marina", property_type="Apartment", bedrooms=2, size_sqm=115, price_aed=2_420_000, transaction_date="2026-03-05"),
    Transaction(area="Jumeirah Village Circle", property_type="Apartment", bedrooms=1, size_sqm=60, price_aed=720_000, transaction_date="2026-01-09"),
    Transaction(area="Jumeirah Village Circle", property_type="Apartment", bedrooms=1, size_sqm=58, price_aed=690_000, transaction_date="2025-11-22"),
    Transaction(area="Jumeirah Village Circle", property_type="Apartment", bedrooms=2, size_sqm=95, price_aed=1_050_000, transaction_date="2026-02-14"),
    Transaction(area="Downtown Dubai", property_type="Apartment", bedrooms=2, size_sqm=120, price_aed=3_400_000, transaction_date="2026-01-30"),
    Transaction(area="Downtown Dubai", property_type="Apartment", bedrooms=2, size_sqm=118, price_aed=3_250_000, transaction_date="2025-12-11"),
    Transaction(area="Downtown Dubai", property_type="Apartment", bedrooms=3, size_sqm=165, price_aed=4_800_000, transaction_date="2026-02-27"),
    Transaction(area="Business Bay", property_type="Apartment", bedrooms=1, size_sqm=65, price_aed=1_150_000, transaction_date="2026-01-17"),
    Transaction(area="Business Bay", property_type="Apartment", bedrooms=1, size_sqm=70, price_aed=1_220_000, transaction_date="2025-12-30"),
    Transaction(area="Arabian Ranches", property_type="Villa", bedrooms=3, size_sqm=280, price_aed=3_900_000, transaction_date="2026-01-05"),
    Transaction(area="Arabian Ranches", property_type="Villa", bedrooms=4, size_sqm=340, price_aed=4_600_000, transaction_date="2026-02-18"),
]

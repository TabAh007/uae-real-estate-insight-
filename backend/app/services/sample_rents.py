"""Sample rent contracts for demo mode (mirrors sample_data.py sale areas).

Only used when neither a real rent CSV nor real sales CSV is present, so demo
yields stay self-consistent. NOT real data.
"""
from app.schemas import RentContract

SAMPLE_RENTS: list[RentContract] = [
    RentContract(area="Dubai Marina", property_type="Apartment", bedrooms=1, size_sqm=68, annual_rent_aed=95_000, registration_date="2026-01-10"),
    RentContract(area="Dubai Marina", property_type="Apartment", bedrooms=1, size_sqm=72, annual_rent_aed=100_000, registration_date="2026-02-05"),
    RentContract(area="Dubai Marina", property_type="Apartment", bedrooms=2, size_sqm=110, annual_rent_aed=150_000, registration_date="2026-01-22"),
    RentContract(area="Dubai Marina", property_type="Apartment", bedrooms=2, size_sqm=108, annual_rent_aed=145_000, registration_date="2025-12-14"),
    RentContract(area="Dubai Marina", property_type="Apartment", bedrooms=2, size_sqm=115, annual_rent_aed=158_000, registration_date="2026-03-01"),
    RentContract(area="Jumeirah Village Circle", property_type="Apartment", bedrooms=1, size_sqm=60, annual_rent_aed=58_000, registration_date="2026-01-08"),
    RentContract(area="Jumeirah Village Circle", property_type="Apartment", bedrooms=1, size_sqm=58, annual_rent_aed=55_000, registration_date="2025-11-20"),
    RentContract(area="Jumeirah Village Circle", property_type="Apartment", bedrooms=2, size_sqm=95, annual_rent_aed=85_000, registration_date="2026-02-12"),
    RentContract(area="Downtown Dubai", property_type="Apartment", bedrooms=2, size_sqm=120, annual_rent_aed=185_000, registration_date="2026-01-25"),
    RentContract(area="Downtown Dubai", property_type="Apartment", bedrooms=2, size_sqm=118, annual_rent_aed=178_000, registration_date="2025-12-09"),
    RentContract(area="Downtown Dubai", property_type="Apartment", bedrooms=3, size_sqm=165, annual_rent_aed=255_000, registration_date="2026-02-20"),
    RentContract(area="Business Bay", property_type="Apartment", bedrooms=1, size_sqm=65, annual_rent_aed=80_000, registration_date="2026-01-15"),
    RentContract(area="Business Bay", property_type="Apartment", bedrooms=1, size_sqm=70, annual_rent_aed=85_000, registration_date="2025-12-28"),
    RentContract(area="Arabian Ranches", property_type="Villa", bedrooms=3, size_sqm=280, annual_rent_aed=250_000, registration_date="2026-01-03"),
    RentContract(area="Arabian Ranches", property_type="Villa", bedrooms=4, size_sqm=340, annual_rent_aed=320_000, registration_date="2026-02-16"),
]

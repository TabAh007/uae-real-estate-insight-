from pydantic import BaseModel, Field


class GeocodeResult(BaseModel):
    formatted_address: str
    lat: float
    lon: float


class Poi(BaseModel):
    name: str
    category: str
    lat: float
    lon: float
    distance_m: float


class NeighborhoodResponse(BaseModel):
    lat: float
    lon: float
    radius_m: int
    pois: list[Poi]
    source: str = "openstreetmap"


class SchoolNearby(BaseModel):
    name: str
    rating: str | None = None
    rating_year: str | None = None
    curriculum: str | None = None
    grades: str | None = None
    lat: float
    lon: float
    distance_m: float


class SchoolsResponse(BaseModel):
    lat: float
    lon: float
    radius_m: int
    schools: list[SchoolNearby]
    source: str


class Transaction(BaseModel):
    area: str
    property_type: str
    bedrooms: int | None = None
    size_sqm: float
    price_aed: float
    transaction_date: str

    @property
    def price_per_sqm(self) -> float:
        return round(self.price_aed / self.size_sqm, 2)


class TransactionsResponse(BaseModel):
    transactions: list[Transaction]
    source: str


class RentContract(BaseModel):
    area: str
    property_type: str
    bedrooms: int | None = None
    size_sqm: float
    annual_rent_aed: float
    registration_date: str

    @property
    def annual_rent_per_sqm(self) -> float:
        return round(self.annual_rent_aed / self.size_sqm, 2)


class ValuationRequest(BaseModel):
    area: str
    property_type: str
    size_sqm: float = Field(gt=0)
    bedrooms: int | None = None
    asking_price_aed: float | None = None


class ValuationResponse(BaseModel):
    area: str
    property_type: str
    size_sqm: float
    estimated_low_aed: float
    estimated_mid_aed: float
    estimated_high_aed: float
    price_per_sqm_median: float
    comparables_used: int
    comparables: list[Transaction]
    asking_price_aed: float | None = None
    asking_price_verdict: str | None = None
    method: str
    source: str
    disclaimer: str = (
        "Estimate derived from comparable DLD transactions in the same area/type. "
        "Not a substitute for a licensed RICS/RERA valuation."
    )


class RentalYieldResponse(BaseModel):
    area: str
    property_type: str
    size_sqm: float
    estimated_annual_rent_aed: float
    estimated_sale_value_aed: float
    gross_yield_pct: float
    sale_comps_used: int
    rent_comps_used: int
    method: str
    sale_source: str
    rent_source: str
    disclaimer: str = (
        "Gross yield = median annual rent / median sale price for comparable "
        "units. Ignores service charges, agency/DLD fees, and vacancy — net "
        "yield is lower. Not investment advice."
    )

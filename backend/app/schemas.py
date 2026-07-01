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

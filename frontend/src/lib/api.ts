const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8010";

export interface GeocodeResult {
  formatted_address: string;
  lat: number;
  lon: number;
}

export interface Poi {
  name: string;
  category: string;
  lat: number;
  lon: number;
  distance_m: number;
}

export interface NeighborhoodResponse {
  lat: number;
  lon: number;
  radius_m: number;
  pois: Poi[];
  source: string;
}

export interface Transaction {
  area: string;
  property_type: string;
  bedrooms: number | null;
  size_sqm: number;
  price_aed: number;
  transaction_date: string;
}

export interface ValuationResponse {
  area: string;
  property_type: string;
  size_sqm: number;
  estimated_low_aed: number;
  estimated_mid_aed: number;
  estimated_high_aed: number;
  price_per_sqm_median: number;
  comparables_used: number;
  comparables: Transaction[];
  asking_price_aed: number | null;
  asking_price_verdict: string | null;
  method: string;
  source: string;
  disclaimer: string;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail ?? `Request to ${path} failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function geocodeAddress(address: string): Promise<GeocodeResult> {
  return apiFetch(`/geocode?address=${encodeURIComponent(address)}`);
}

export function getNeighborhood(lat: number, lon: number, radiusM = 1200): Promise<NeighborhoodResponse> {
  return apiFetch(`/neighborhood/nearby?lat=${lat}&lon=${lon}&radius_m=${radiusM}`);
}

export interface Facets {
  areas: string[];
  property_types: string[];
}

export function getFacets(): Promise<Facets> {
  return apiFetch(`/properties/facets`);
}

export interface SchoolNearby {
  name: string;
  rating: string | null;
  rating_year: string | null;
  curriculum: string | null;
  grades: string | null;
  lat: number;
  lon: number;
  distance_m: number;
}

export interface SchoolsResponse {
  lat: number;
  lon: number;
  radius_m: number;
  schools: SchoolNearby[];
  source: string;
}

export function getSchools(lat: number, lon: number, radiusM = 3000): Promise<SchoolsResponse> {
  return apiFetch(`/neighborhood/schools?lat=${lat}&lon=${lon}&radius_m=${radiusM}`);
}

export interface ValuationRequest {
  area: string;
  property_type: string;
  size_sqm: number;
  bedrooms?: number;
  asking_price_aed?: number;
}

export function estimateValuation(payload: ValuationRequest): Promise<ValuationResponse> {
  return apiFetch(`/valuation/estimate`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface RentalYieldResponse {
  area: string;
  property_type: string;
  size_sqm: number;
  estimated_annual_rent_aed: number;
  estimated_sale_value_aed: number;
  gross_yield_pct: number;
  sale_comps_used: number;
  rent_comps_used: number;
  method: string;
  sale_source: string;
  rent_source: string;
  disclaimer: string;
}

export function estimateRentalYield(payload: ValuationRequest): Promise<RentalYieldResponse> {
  return apiFetch(`/valuation/rental-yield`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface ScoreComponent {
  name: string;
  score: number;
  max_score: number;
  detail: string;
}

export interface InvestmentScoreResponse {
  area: string;
  property_type: string;
  size_sqm: number;
  overall_score: number;
  rating: string;
  components: ScoreComponent[];
  estimated_value_aed: number;
  gross_yield_pct: number | null;
  sale_source: string;
  rent_source: string;
  disclaimer: string;
}

export function estimateInvestmentScore(payload: ValuationRequest): Promise<InvestmentScoreResponse> {
  return apiFetch(`/valuation/investment-score`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface PriceTrendPoint {
  period: string;
  median_price_per_sqm: number;
  count: number;
}

export interface PriceTrendResponse {
  area: string;
  property_type: string;
  granularity: string;
  points: PriceTrendPoint[];
  source: string;
  note: string | null;
}

export function getPriceTrend(
  area: string,
  propertyType: string,
  granularity: "day" | "week" | "month" = "month",
): Promise<PriceTrendResponse> {
  const q = new URLSearchParams({ area, property_type: propertyType, granularity });
  return apiFetch(`/analytics/price-trend?${q.toString()}`);
}

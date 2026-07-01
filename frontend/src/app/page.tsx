"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  estimateInvestmentScore,
  estimateRentalYield,
  estimateValuation,
  geocodeAddress,
  getFacets,
  getNeighborhood,
  getPriceTrend,
  getSchools,
  type InvestmentScoreResponse,
  type NeighborhoodResponse,
  type PriceTrendResponse,
  type RentalYieldResponse,
  type SchoolNearby,
  type ValuationResponse,
} from "@/lib/api";
import TrendChart from "@/components/TrendChart";

// MapLibre touches window/document at import time — must load client-only.
const PropertyMap = dynamic(() => import("@/components/PropertyMap"), { ssr: false });

type Granularity = "day" | "week" | "month";

// Fallback options shown before facets load (or if the backend is unreachable).
const FALLBACK_AREAS = ["Dubai Marina", "Jumeirah Village Circle", "Downtown Dubai", "Business Bay", "Arabian Ranches"];
const FALLBACK_PROPERTY_TYPES = ["Apartment", "Villa"];

const RATING_COLOR: Record<string, string> = {
  Outstanding: "#15803d",
  "Very Good": "#4d7c0f",
  Good: "#ca8a04",
  Acceptable: "#ea580c",
  Weak: "#b91c1c",
  Unsatisfactory: "#7f1d1d",
};

// Marker colours mirror PropertyMap, used for the map legend.
const LEGEND = [
  { label: "This property", color: "#111827" },
  { label: "School (by KHDA rating)", color: "#4d7c0f" },
  { label: "Supermarket", color: "#ea580c" },
  { label: "Pharmacy", color: "#16a34a" },
  { label: "Hospital / clinic", color: "#dc2626" },
  { label: "Metro", color: "#0891b2" },
  { label: "Mall", color: "#9333ea" },
];

function ratingPillClass(rating: string): string {
  if (rating.startsWith("Attractive")) return "bg-emerald-100 text-emerald-800";
  if (rating.startsWith("Fair")) return "bg-amber-100 text-amber-800";
  if (rating.startsWith("Weak")) return "bg-orange-100 text-orange-800";
  if (rating.startsWith("Poor")) return "bg-red-100 text-red-800";
  return "bg-gray-100 text-gray-700";
}

function Spinner() {
  return <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />;
}

export default function Home() {
  const [address, setAddress] = useState("Dubai Marina, Dubai");
  const [center, setCenter] = useState<{ lat: number; lon: number } | null>(null);
  const [neighborhood, setNeighborhood] = useState<NeighborhoodResponse | null>(null);
  const [schools, setSchools] = useState<SchoolNearby[]>([]);

  // Dropdown options come from whatever data the backend actually has loaded
  // (sample data, a DLD CSV, or the live API), so e.g. real "Flat"/uppercase
  // area names replace the hardcoded guesses automatically.
  const [areas, setAreas] = useState<string[]>(FALLBACK_AREAS);
  const [propertyTypes, setPropertyTypes] = useState<string[]>(FALLBACK_PROPERTY_TYPES);

  const [area, setArea] = useState(FALLBACK_AREAS[0]);
  const [propertyType, setPropertyType] = useState(FALLBACK_PROPERTY_TYPES[0]);
  const [sizeSqm, setSizeSqm] = useState(90);
  const [askingPrice, setAskingPrice] = useState<number | "">("");
  const [valuation, setValuation] = useState<ValuationResponse | null>(null);
  const [yieldResult, setYieldResult] = useState<RentalYieldResponse | null>(null);
  const [scoreResult, setScoreResult] = useState<InvestmentScoreResponse | null>(null);
  const [trend, setTrend] = useState<PriceTrendResponse | null>(null);
  const [granularity, setGranularity] = useState<Granularity>("day");

  const [loadingLocation, setLoadingLocation] = useState(false);
  const [loadingValuation, setLoadingValuation] = useState(false);
  const [loadingYield, setLoadingYield] = useState(false);
  const [loadingScore, setLoadingScore] = useState(false);
  const [loadingTrend, setLoadingTrend] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getFacets()
      .then((facets) => {
        if (facets.areas.length) {
          setAreas(facets.areas);
          setArea(facets.areas[0]);
        }
        if (facets.property_types.length) {
          setPropertyTypes(facets.property_types);
          setPropertyType(facets.property_types[0]);
        }
      })
      .catch(() => {
        /* keep fallbacks if the backend isn't up yet */
      });
  }, []);

  async function handleLocate() {
    setError(null);
    setLoadingLocation(true);
    try {
      const geo = await geocodeAddress(address);
      setCenter({ lat: geo.lat, lon: geo.lon });
      const [nearby, schoolsResp] = await Promise.all([
        getNeighborhood(geo.lat, geo.lon),
        getSchools(geo.lat, geo.lon).catch(() => null),
      ]);
      setNeighborhood(nearby);
      setSchools(schoolsResp?.schools ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to locate address");
    } finally {
      setLoadingLocation(false);
    }
  }

  async function handleEstimate() {
    setError(null);
    setLoadingValuation(true);
    try {
      const result = await estimateValuation({
        area,
        property_type: propertyType,
        size_sqm: sizeSqm,
        asking_price_aed: askingPrice === "" ? undefined : askingPrice,
      });
      setValuation(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to estimate valuation");
    } finally {
      setLoadingValuation(false);
    }
  }

  async function handleYield() {
    setError(null);
    setLoadingYield(true);
    try {
      const result = await estimateRentalYield({ area, property_type: propertyType, size_sqm: sizeSqm });
      setYieldResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to estimate rental yield");
      setYieldResult(null);
    } finally {
      setLoadingYield(false);
    }
  }

  async function handleTrend(g: Granularity = granularity) {
    setError(null);
    setLoadingTrend(true);
    try {
      const result = await getPriceTrend(area, propertyType, g);
      setTrend(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load price trend");
      setTrend(null);
    } finally {
      setLoadingTrend(false);
    }
  }

  async function handleScore() {
    setError(null);
    setLoadingScore(true);
    try {
      const result = await estimateInvestmentScore({
        area,
        property_type: propertyType,
        size_sqm: sizeSqm,
        asking_price_aed: askingPrice === "" ? undefined : askingPrice,
      });
      setScoreResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to compute investment score");
      setScoreResult(null);
    } finally {
      setLoadingScore(false);
    }
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-5 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-blue-500 text-white">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="leading-tight">
          <h1 className="text-sm font-semibold text-gray-900">UAE Real Estate Insight</h1>
          <p className="text-[11px] text-gray-500">Valuation, yield & neighborhood analytics on open Dubai Land Department data</p>
        </div>
        <span className="ml-auto hidden rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200 sm:inline">
          Live DLD data
        </span>
      </header>

      <div className="flex flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
        <aside className="scrollbar-slim flex w-full shrink-0 flex-col gap-4 bg-gray-50 p-4 md:w-[400px] md:overflow-y-auto">
          {/* Step 1 — locate */}
          <div className="card">
            <h2 className="section-title">
              <span className="step-badge">1</span> Locate a property
            </h2>
            <input
              className="field"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Dubai Marina, Dubai"
            />
            <button onClick={handleLocate} disabled={loadingLocation} className="btn bg-gray-900 hover:bg-gray-800">
              {loadingLocation ? <><Spinner /> Locating…</> : "Locate & show nearby amenities"}
            </button>
          </div>

          {neighborhood && (
            <div className="card">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-semibold text-gray-800">Nearby amenities</h3>
                <span className="text-xs text-gray-400">{neighborhood.pois.length} within {neighborhood.radius_m}m</span>
              </div>
              {neighborhood.source !== "openstreetmap" && (
                <p className="text-[11px] text-gray-400">source: {neighborhood.source}</p>
              )}
              <ul className="scrollbar-slim max-h-40 overflow-y-auto text-xs">
                {neighborhood.pois.slice(0, 15).map((poi, i) => (
                  <li key={i} className="flex justify-between gap-2 border-b border-gray-100 py-1.5 last:border-0">
                    <span className="truncate text-gray-700">
                      {poi.name} <span className="text-gray-400">· {poi.category}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-gray-500">{Math.round(poi.distance_m)}m</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {schools.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-800">KHDA-rated schools nearby</h3>
              <ul className="scrollbar-slim max-h-44 overflow-y-auto text-xs">
                {schools.slice(0, 12).map((s, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 border-b border-gray-100 py-1.5 last:border-0">
                    <span className="min-w-0 truncate text-gray-700">{s.name}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      {s.rating && (
                        <span
                          className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                          style={{ backgroundColor: RATING_COLOR[s.rating] ?? "#6b7280" }}
                        >
                          {s.rating}
                        </span>
                      )}
                      <span className="tabular-nums text-gray-500">{Math.round(s.distance_m)}m</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Step 2 — analyze */}
          <div className="card">
            <h2 className="section-title">
              <span className="step-badge">2</span> Analyze the investment
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <select className="field" value={area} onChange={(e) => setArea(e.target.value)}>
                {areas.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              <select className="field" value={propertyType} onChange={(e) => setPropertyType(e.target.value)}>
                {propertyTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-500">
                Size (sqm)
                <input type="number" className="field" value={sizeSqm} onChange={(e) => setSizeSqm(Number(e.target.value))} />
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-500">
                Asking price (AED) — optional
                <input
                  type="number"
                  className="field"
                  value={askingPrice}
                  onChange={(e) => setAskingPrice(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="e.g. 1,500,000"
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button onClick={handleEstimate} disabled={loadingValuation} className="btn bg-blue-600 hover:bg-blue-700">
                {loadingValuation ? <><Spinner /> Estimating…</> : "Estimate value"}
              </button>
              <button onClick={handleYield} disabled={loadingYield} className="btn bg-emerald-600 hover:bg-emerald-700">
                {loadingYield ? <><Spinner /> Calculating…</> : "Rental yield"}
              </button>
              <button onClick={handleScore} disabled={loadingScore} className="btn bg-indigo-600 hover:bg-indigo-700">
                {loadingScore ? <><Spinner /> Scoring…</> : "★ Investment score"}
              </button>
              <button onClick={() => handleTrend()} disabled={loadingTrend} className="btn bg-slate-700 hover:bg-slate-800">
                {loadingTrend ? <><Spinner /> Loading…</> : "Price trend"}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          {scoreResult && (
            <div className="card border-indigo-200 bg-indigo-50/60">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full bg-white shadow-sm ring-2 ring-indigo-200">
                  <span className="text-xl font-bold leading-none text-indigo-700">{scoreResult.overall_score}</span>
                  <span className="text-[9px] text-gray-400">/ 100</span>
                </div>
                <div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ratingPillClass(scoreResult.rating)}`}>
                    {scoreResult.rating}
                  </span>
                  <p className="mt-1 text-xs text-gray-500">Est. value AED {scoreResult.estimated_value_aed.toLocaleString()}</p>
                </div>
              </div>
              <div className="mt-1 flex flex-col gap-2.5">
                {scoreResult.components.map((c) => (
                  <div key={c.name} className="flex flex-col gap-1">
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>{c.name}</span>
                      <span className="tabular-nums text-gray-500">{c.score}/{c.max_score}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(c.score / c.max_score) * 100}%` }} />
                    </div>
                    <p className="text-[11px] text-gray-400">{c.detail}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-gray-400">{scoreResult.disclaimer}</p>
            </div>
          )}

          {valuation && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-800">Comparable-sales value</h3>
              <p className="text-lg font-bold text-gray-900">
                AED {valuation.estimated_low_aed.toLocaleString()} – {valuation.estimated_high_aed.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500">
                Median AED {valuation.estimated_mid_aed.toLocaleString()} · {valuation.comparables_used} comparables
              </p>
              {valuation.asking_price_verdict && (
                <span className="w-fit rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                  {valuation.asking_price_verdict}
                </span>
              )}
              <p className="text-[11px] text-gray-400">{valuation.method}</p>
              <p className="text-[11px] text-gray-400">{valuation.disclaimer}</p>
            </div>
          )}

          {yieldResult && (
            <div className="card border-emerald-200 bg-emerald-50/60">
              <h3 className="text-sm font-semibold text-gray-800">Gross rental yield</h3>
              <p className="text-2xl font-bold text-emerald-700">{yieldResult.gross_yield_pct}%</p>
              <p className="text-xs text-gray-600">
                Est. annual rent AED {yieldResult.estimated_annual_rent_aed.toLocaleString()} on est. value AED{" "}
                {yieldResult.estimated_sale_value_aed.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500">
                {yieldResult.rent_comps_used} rent contracts · {yieldResult.sale_comps_used} sales
              </p>
              <p className="text-[11px] text-gray-400">{yieldResult.disclaimer}</p>
            </div>
          )}

          {trend && (
            <div className="card">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">Median price/sqm over time</h3>
                <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5">
                  {(["day", "week", "month"] as Granularity[]).map((g) => (
                    <button
                      key={g}
                      onClick={() => {
                        setGranularity(g);
                        handleTrend(g);
                      }}
                      className={`rounded-md px-2 py-0.5 text-[11px] font-medium capitalize transition ${
                        granularity === g ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <TrendChart points={trend.points} />
              {trend.note && (
                <p className="rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-700">{trend.note}</p>
              )}
              <p className="text-[11px] text-gray-400">
                {trend.points.length} {granularity} point(s) · {trend.area} · {trend.source}
              </p>
            </div>
          )}
        </aside>

        <main className="relative h-[60vh] shrink-0 md:h-auto md:flex-1">
          <PropertyMap center={center} pois={neighborhood?.pois ?? []} schools={schools} />
          {(neighborhood || schools.length > 0) && (
            <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg border border-gray-200 bg-white/90 px-3 py-2 text-[11px] shadow-sm backdrop-blur">
              <p className="mb-1 font-semibold text-gray-600">Legend</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                {LEGEND.map((l) => (
                  <span key={l.label} className="flex items-center gap-1.5 text-gray-600">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
                    {l.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

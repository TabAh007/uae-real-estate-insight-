"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  analyzeProperty,
  getFacets,
  getNeighborhood,
  getSchools,
  geocodeAddress,
  listProperties,
  type NeighborhoodResponse,
  type PropertyAnalysis,
  type SchoolNearby,
  type Transaction,
} from "@/lib/api";

// MapLibre touches window/document at import time — must load client-only.
const PropertyMap = dynamic(() => import("@/components/PropertyMap"), { ssr: false });

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

const LEGEND = [
  { label: "This property", color: "#111827" },
  { label: "School (KHDA rating)", color: "#4d7c0f" },
  { label: "Supermarket", color: "#ea580c" },
  { label: "Pharmacy", color: "#16a34a" },
  { label: "Hospital / clinic", color: "#dc2626" },
  { label: "Metro", color: "#0891b2" },
];

function ratingPillClass(rating: string): string {
  if (rating.startsWith("Attractive")) return "bg-emerald-100 text-emerald-800";
  if (rating.startsWith("Fair")) return "bg-amber-100 text-amber-800";
  if (rating.startsWith("Weak")) return "bg-orange-100 text-orange-800";
  if (rating.startsWith("Poor")) return "bg-red-100 text-red-800";
  return "bg-gray-100 text-gray-700";
}

function verdictPillClass(verdict: string): string {
  if (verdict.includes("underpriced") || verdict.includes("below")) return "bg-emerald-100 text-emerald-800";
  if (verdict.includes("overpriced") || verdict.includes("above")) return "bg-red-100 text-red-800";
  return "bg-gray-100 text-gray-700";
}

function Spinner() {
  return <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />;
}

function bedLabel(t: Transaction): string {
  if (t.bedrooms === 0) return "Studio";
  if (t.bedrooms == null) return t.property_type;
  return `${t.bedrooms} B/R`;
}

export default function Home() {
  const [areas, setAreas] = useState<string[]>(FALLBACK_AREAS);
  const [propertyTypes, setPropertyTypes] = useState<string[]>(FALLBACK_PROPERTY_TYPES);
  const [area, setArea] = useState(FALLBACK_AREAS[0]);
  const [propertyType, setPropertyType] = useState(FALLBACK_PROPERTY_TYPES[0]);

  const [properties, setProperties] = useState<Transaction[]>([]);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [analysis, setAnalysis] = useState<PropertyAnalysis | null>(null);

  const [center, setCenter] = useState<{ lat: number; lon: number } | null>(null);
  const [neighborhood, setNeighborhood] = useState<NeighborhoodResponse | null>(null);
  const [schools, setSchools] = useState<SchoolNearby[]>([]);

  const [loadingList, setLoadingList] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
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
      .catch(() => {});
  }, []);

  async function handleShowProperties() {
    setError(null);
    setLoadingList(true);
    setSelected(null);
    setAnalysis(null);
    try {
      const resp = await listProperties(area, propertyType, 60);
      setProperties(resp.transactions);
      if (resp.transactions.length === 0) setError(`No ${propertyType} transactions found in ${area}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load properties");
      setProperties([]);
    } finally {
      setLoadingList(false);
    }
  }

  async function handleSelect(property: Transaction) {
    setSelected(property);
    setAnalysis(null);
    setError(null);
    setLoadingAnalysis(true);
    try {
      const analysisPromise = analyzeProperty(property);
      // Best-effort map + neighborhood from the area centroid (DLD rows have no
      // exact coordinates); analysis still shows if geocoding is unavailable.
      const locationPromise = geocodeAddress(`${property.area}, Dubai`)
        .then(async (geo) => {
          setCenter({ lat: geo.lat, lon: geo.lon });
          const [nearby, schoolsResp] = await Promise.all([
            getNeighborhood(geo.lat, geo.lon).catch(() => null),
            getSchools(geo.lat, geo.lon).catch(() => null),
          ]);
          setNeighborhood(nearby);
          setSchools(schoolsResp?.schools ?? []);
        })
        .catch(() => {
          setCenter(null);
          setNeighborhood(null);
          setSchools([]);
        });

      const result = await analysisPromise;
      setAnalysis(result);
      await locationPromise;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze property");
    } finally {
      setLoadingAnalysis(false);
    }
  }

  const fmt = (n: number) => "AED " + Math.round(n).toLocaleString();

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-5 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-blue-500 text-white">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="leading-tight">
          <h1 className="text-sm font-semibold text-gray-900">UAE Real Estate Insight</h1>
          <p className="text-[11px] text-gray-500">Browse real Dubai Land Department transactions and analyze any one instantly</p>
        </div>
        <span className="ml-auto hidden rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200 sm:inline">
          Live DLD data
        </span>
      </header>

      <div className="flex flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
        <aside className="scrollbar-slim flex w-full shrink-0 flex-col gap-4 bg-gray-50 p-4 md:w-[420px] md:overflow-y-auto">
          {/* Step 1 — pick an area */}
          <div className="card">
            <h2 className="section-title">
              <span className="step-badge">1</span> Find properties
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-500">
                Area
                <select className="field" value={area} onChange={(e) => setArea(e.target.value)}>
                  {areas.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-500">
                Type
                <select className="field" value={propertyType} onChange={(e) => setPropertyType(e.target.value)}>
                  {propertyTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
            </div>
            <button onClick={handleShowProperties} disabled={loadingList} className="btn bg-indigo-600 hover:bg-indigo-700">
              {loadingList ? <><Spinner /> Loading…</> : "Show properties"}
            </button>
          </div>

          {/* Step 2 — property list */}
          {properties.length > 0 && (
            <div className="card">
              <div className="flex items-baseline justify-between">
                <h2 className="section-title">
                  <span className="step-badge">2</span> Pick a property
                </h2>
                <span className="text-[11px] text-gray-400">{properties.length} shown</span>
              </div>
              <ul className="scrollbar-slim -mx-1 max-h-72 overflow-y-auto px-1">
                {properties.map((p, i) => {
                  const isSel = selected === p;
                  return (
                    <li key={i}>
                      <button
                        onClick={() => handleSelect(p)}
                        className={`mb-1.5 w-full rounded-lg border px-3 py-2 text-left transition ${
                          isSel ? "border-indigo-400 bg-indigo-50" : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-baseline justify-between">
                          <span className="text-sm font-semibold text-gray-900">{fmt(p.price_aed)}</span>
                          <span className="text-[11px] text-gray-400">{p.transaction_date.slice(0, 10)}</span>
                        </div>
                        <div className="text-xs text-gray-600">
                          {bedLabel(p)} · {p.property_type} · {p.size_sqm.toFixed(0)} sqm · {fmt(p.price_aed / p.size_sqm)}/sqm
                        </div>
                        {(p.nearest_landmark || p.nearest_metro) && (
                          <div className="text-[11px] text-gray-400">
                            near {[p.nearest_landmark, p.nearest_metro].filter(Boolean).join(" · ")}
                          </div>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          {loadingAnalysis && !analysis && (
            <div className="card items-center text-sm text-gray-500">
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-500" /> Analyzing…
              </span>
            </div>
          )}

          {/* Step 3 — full analysis of the selected property */}
          {analysis && (
            <>
              {analysis.investment_score && (
                <div className="card border-indigo-200 bg-indigo-50/60">
                  <div className="flex items-center gap-3">
                    <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full bg-white shadow-sm ring-2 ring-indigo-200">
                      <span className="text-xl font-bold leading-none text-indigo-700">{analysis.investment_score.overall_score}</span>
                      <span className="text-[9px] text-gray-400">/ 100</span>
                    </div>
                    <div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ratingPillClass(analysis.investment_score.rating)}`}>
                        {analysis.investment_score.rating}
                      </span>
                      <p className="mt-1 text-xs text-gray-500">Investment score for this property</p>
                    </div>
                  </div>
                  <div className="mt-1 flex flex-col gap-2.5">
                    {analysis.investment_score.components.map((c) => (
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
                </div>
              )}

              {/* Property facts + valuation verdict */}
              <div className="card">
                <h3 className="text-sm font-semibold text-gray-800">
                  {bedLabel(analysis.property)} {analysis.property.property_type} · {analysis.property.size_sqm.toFixed(0)} sqm
                </h3>
                <p className="text-lg font-bold text-gray-900">{fmt(analysis.property.price_aed)}</p>
                {analysis.valuation.asking_price_verdict && (
                  <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${verdictPillClass(analysis.valuation.asking_price_verdict)}`}>
                    {analysis.valuation.asking_price_verdict}
                  </span>
                )}
                <p className="text-xs text-gray-500">
                  Comparable range {fmt(analysis.valuation.estimated_low_aed)} – {fmt(analysis.valuation.estimated_high_aed)} · median{" "}
                  {fmt(analysis.valuation.estimated_mid_aed)} ({analysis.valuation.comparables_used} comps)
                </p>
                <p className="text-[11px] text-gray-400">{analysis.valuation.disclaimer}</p>
              </div>

              {/* Rental yield */}
              {analysis.rental_yield && (
                <div className="card border-emerald-200 bg-emerald-50/60">
                  <h3 className="text-sm font-semibold text-gray-800">Gross rental yield</h3>
                  <p className="text-2xl font-bold text-emerald-700">{analysis.rental_yield.gross_yield_pct}%</p>
                  <p className="text-xs text-gray-600">
                    Est. annual rent {fmt(analysis.rental_yield.estimated_annual_rent_aed)} · {analysis.rental_yield.rent_comps_used} rent comps
                  </p>
                </div>
              )}
            </>
          )}

          {/* Neighborhood + schools (from the area centroid) */}
          {neighborhood && neighborhood.pois.length > 0 && (
            <div className="card">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-semibold text-gray-800">Nearby amenities</h3>
                <span className="text-xs text-gray-400">{neighborhood.pois.length} within {neighborhood.radius_m}m</span>
              </div>
              <ul className="scrollbar-slim max-h-36 overflow-y-auto text-xs">
                {neighborhood.pois.slice(0, 12).map((poi, i) => (
                  <li key={i} className="flex justify-between gap-2 border-b border-gray-100 py-1.5 last:border-0">
                    <span className="truncate text-gray-700">{poi.name} <span className="text-gray-400">· {poi.category}</span></span>
                    <span className="shrink-0 tabular-nums text-gray-500">{Math.round(poi.distance_m)}m</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {schools.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-800">KHDA-rated schools nearby</h3>
              <ul className="scrollbar-slim max-h-40 overflow-y-auto text-xs">
                {schools.slice(0, 10).map((s, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 border-b border-gray-100 py-1.5 last:border-0">
                    <span className="min-w-0 truncate text-gray-700">{s.name}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      {s.rating && (
                        <span className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white" style={{ backgroundColor: RATING_COLOR[s.rating] ?? "#6b7280" }}>
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

          {properties.length === 0 && !loadingList && !error && (
            <p className="px-1 text-xs text-gray-400">
              Pick an area and type, then <strong>Show properties</strong> to browse real DLD transactions. Click any one for a full investment analysis.
            </p>
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

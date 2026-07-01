"use client";

import { useCallback, useEffect, useState } from "react";
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
import type { PropertyPin } from "@/components/PropertyMap";

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
  { label: "Property (click it)", color: "#818cf8" },
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

function bedLabel(t: Transaction): string {
  if (t.bedrooms === 0) return "Studio";
  if (t.bedrooms == null) return t.property_type;
  return `${t.bedrooms} B/R`;
}

// A DLD record is a past sale with no listing of its own, so we link to each
// portal's search for similar CURRENT listings (opened in the user's browser —
// no scraping on our side). Site-scoped search reliably lands on real results.
function listingSearchLinks(t: Transaction): { name: string; url: string }[] {
  const beds = t.bedrooms === 0 ? "studio" : t.bedrooms != null ? `${t.bedrooms} bedroom` : "";
  const terms = `${t.area} ${beds} ${t.property_type} for sale dubai`.replace(/\s+/g, " ").trim();
  const search = (site: string) =>
    `https://www.google.com/search?q=${encodeURIComponent(`${terms} site:${site}`)}`;
  return [
    { name: "Bayut", url: search("bayut.com") },
    { name: "Property Finder", url: search("propertyfinder.ae") },
    { name: "Dubizzle", url: search("dubizzle.com") },
  ];
}

// Deterministic spiral offset so an area's properties spread out and stay put.
function jitter(lat: number, lon: number, i: number): { lat: number; lon: number } {
  const golden = 2.399963;
  const r = 0.0022 * Math.sqrt(i + 1);
  const a = i * golden;
  return { lat: lat + r * Math.cos(a), lon: lon + (r * Math.sin(a)) / Math.cos((lat * Math.PI) / 180) };
}

const fmt = (n: number) => "AED " + Math.round(n).toLocaleString();

export default function Home() {
  const [areas, setAreas] = useState<string[]>(FALLBACK_AREAS);
  const [propertyTypes, setPropertyTypes] = useState<string[]>(FALLBACK_PROPERTY_TYPES);
  const [area, setArea] = useState(FALLBACK_AREAS[0]);
  const [propertyType, setPropertyType] = useState(FALLBACK_PROPERTY_TYPES[0]);

  const [pins, setPins] = useState<PropertyPin[]>([]);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [analysis, setAnalysis] = useState<PropertyAnalysis | null>(null);

  const [center, setCenter] = useState<{ lat: number; lon: number } | null>(null);
  const [neighborhood, setNeighborhood] = useState<NeighborhoodResponse | null>(null);
  const [schools, setSchools] = useState<SchoolNearby[]>([]);

  const [loadingList, setLoadingList] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadArea(a: string, t: string) {
    setError(null);
    setNotice(null);
    setLoadingList(true);
    setSelected(null);
    setAnalysis(null);
    setNeighborhood(null);
    setSchools([]);
    try {
      // Area centroid, then scatter the area's transactions around it as pins.
      const geo = await geocodeAddress(`${a}, Dubai`).catch(() => null);
      const resp = await listProperties(a, t, 60);
      if (resp.transactions.length === 0) {
        setPins([]);
        setCenter(geo ? { lat: geo.lat, lon: geo.lon } : null);
        setError(`No ${t} transactions found in ${a}.`);
        return;
      }
      if (!geo) {
        setPins([]);
        setError(`Couldn't locate ${a} on the map. Set GEOAPIFY_API_KEY, or pick another area.`);
        return;
      }
      const newPins: PropertyPin[] = resp.transactions.map((p, i) => {
        const j = jitter(geo.lat, geo.lon, i);
        return { property: p, lat: j.lat, lon: j.lon };
      });
      setCenter({ lat: geo.lat, lon: geo.lon });
      setPins(newPins);
      setNotice(`${resp.transactions.length} properties in ${a} — click any pin for its full analysis. (Pin positions are approximate — DLD data has no exact coordinates.)`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load properties");
      setPins([]);
    } finally {
      setLoadingList(false);
    }
  }

  // Load facets, then auto-load the first area so pins appear with no clicks.
  useEffect(() => {
    getFacets()
      .then((facets) => {
        if (facets.areas.length) setAreas(facets.areas);
        if (facets.property_types.length) setPropertyTypes(facets.property_types);
        // Open on a data-rich area + the most common type so pins appear at once.
        const t = facets.property_types.find((x) => x === "Flat") ?? facets.property_types[0] ?? FALLBACK_PROPERTY_TYPES[0];
        const a = facets.areas.find((x) => x === "Madinat Al Mataar") ?? facets.areas[0] ?? FALLBACK_AREAS[0];
        setArea(a);
        setPropertyType(t);
        loadArea(a, t);
      })
      .catch(() => loadArea(area, propertyType));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = useCallback(async (property: Transaction) => {
    setSelected(property);
    setAnalysis(null);
    setError(null);
    setLoadingAnalysis(true);
    try {
      const result = await analyzeProperty(property);
      setAnalysis(result);
      if (center) {
        const [nearby, schoolsResp] = await Promise.all([
          getNeighborhood(center.lat, center.lon).catch(() => null),
          getSchools(center.lat, center.lon).catch(() => null),
        ]);
        setNeighborhood(nearby);
        setSchools(schoolsResp?.schools ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze property");
    } finally {
      setLoadingAnalysis(false);
    }
  }, [center]);

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
          <p className="text-[11px] text-gray-500">Click a property pin on the map for its full investment analysis</p>
        </div>
        <span className="ml-auto hidden rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200 sm:inline">
          Live DLD data
        </span>
      </header>

      <div className="flex flex-1 flex-col-reverse overflow-y-auto md:flex-row md:overflow-hidden">
        {/* Left = results only */}
        <aside className="scrollbar-slim flex w-full shrink-0 flex-col gap-4 bg-gray-50 p-4 md:w-[400px] md:overflow-y-auto">
          {!analysis && !loadingAnalysis && (
            <div className="card items-start">
              <h2 className="text-sm font-semibold text-gray-800">Pick a property on the map</h2>
              <p className="text-xs text-gray-500">
                Each pin is a real Dubai Land Department transaction in the selected area. Click one to see its
                investment score, valuation, rental yield, and nearby schools. Use the area selector on the map to
                switch neighborhoods.
              </p>
            </div>
          )}

          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          {loadingAnalysis && !analysis && (
            <div className="card items-center text-sm text-gray-500">
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-500" /> Analyzing…
              </span>
            </div>
          )}

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
                {analysis.property.transaction_date && (
                  <p className="text-[11px] text-gray-400">Sold {analysis.property.transaction_date.slice(0, 10)}</p>
                )}
                <div className="flex flex-col gap-1 border-t border-gray-100 pt-2">
                  <span className="text-[11px] text-gray-500">See similar current listings:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {listingSearchLinks(analysis.property).map((l) => (
                      <a
                        key={l.name}
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50"
                      >
                        {l.name} ↗
                      </a>
                    ))}
                  </div>
                  <span className="text-[10px] text-gray-400">
                    This is a past DLD sale — links search each portal for comparable listings on sale now.
                  </span>
                </div>
                <p className="text-[11px] text-gray-400">{analysis.valuation.disclaimer}</p>
              </div>

              {analysis.rental_yield && (
                <div className="card border-emerald-200 bg-emerald-50/60">
                  <h3 className="text-sm font-semibold text-gray-800">Gross rental yield</h3>
                  <p className="text-2xl font-bold text-emerald-700">{analysis.rental_yield.gross_yield_pct}%</p>
                  <p className="text-xs text-gray-600">
                    Est. annual rent {fmt(analysis.rental_yield.estimated_annual_rent_aed)} · {analysis.rental_yield.rent_comps_used} rent comps
                  </p>
                </div>
              )}

              {neighborhood && neighborhood.pois.length > 0 && (
                <div className="card">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-sm font-semibold text-gray-800">Nearby amenities</h3>
                    <span className="text-xs text-gray-400">{neighborhood.pois.length} within {neighborhood.radius_m}m</span>
                  </div>
                  <ul className="scrollbar-slim max-h-32 overflow-y-auto text-xs">
                    {neighborhood.pois.slice(0, 10).map((poi, i) => (
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
            </>
          )}
        </aside>

        {/* Right = the map, the primary interface */}
        <main className="relative h-[55vh] shrink-0 md:h-auto md:flex-1">
          <PropertyMap
            center={center}
            pois={neighborhood?.pois ?? []}
            schools={schools}
            propertyPins={pins}
            selectedProperty={selected}
            onSelectProperty={handleSelect}
          />

          {/* Area/type picker floats on the map */}
          <div className="absolute left-4 top-4 flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 bg-white/95 p-3 shadow-md backdrop-blur">
            <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-500">
              Area
              <select
                className="field w-44"
                value={area}
                onChange={(e) => {
                  setArea(e.target.value);
                  loadArea(e.target.value, propertyType);
                }}
              >
                {areas.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-500">
              Type
              <select
                className="field w-32"
                value={propertyType}
                onChange={(e) => {
                  setPropertyType(e.target.value);
                  loadArea(area, e.target.value);
                }}
              >
                {propertyTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            {loadingList && (
              <span className="h-4 w-4 animate-spin self-center rounded-full border-2 border-gray-300 border-t-indigo-500" />
            )}
          </div>

          {notice && (
            <div className="pointer-events-none absolute right-4 top-4 max-w-xs rounded-lg border border-gray-200 bg-white/95 px-3 py-2 text-[11px] text-gray-600 shadow-sm backdrop-blur">
              {notice}
            </div>
          )}

          {pins.length > 0 && (
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

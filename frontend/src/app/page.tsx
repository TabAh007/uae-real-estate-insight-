"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  estimateValuation,
  geocodeAddress,
  getFacets,
  getNeighborhood,
  type NeighborhoodResponse,
  type ValuationResponse,
} from "@/lib/api";

// MapLibre touches window/document at import time — must load client-only.
const PropertyMap = dynamic(() => import("@/components/PropertyMap"), { ssr: false });

// Fallback options shown before facets load (or if the backend is unreachable).
const FALLBACK_AREAS = ["Dubai Marina", "Jumeirah Village Circle", "Downtown Dubai", "Business Bay", "Arabian Ranches"];
const FALLBACK_PROPERTY_TYPES = ["Apartment", "Villa"];

export default function Home() {
  const [address, setAddress] = useState("Dubai Marina, Dubai");
  const [center, setCenter] = useState<{ lat: number; lon: number } | null>(null);
  const [neighborhood, setNeighborhood] = useState<NeighborhoodResponse | null>(null);

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

  const [loadingLocation, setLoadingLocation] = useState(false);
  const [loadingValuation, setLoadingValuation] = useState(false);
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
      const nearby = await getNeighborhood(geo.lat, geo.lon);
      setNeighborhood(nearby);
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

  return (
    <div className="flex h-screen w-full">
      <aside className="flex w-[420px] shrink-0 flex-col gap-6 overflow-y-auto border-r border-gray-200 p-5">
        <div>
          <h1 className="text-lg font-semibold">UAE Real Estate Insight</h1>
          <p className="text-sm text-gray-500">Valuation from real Dubai Land Department transactions; neighborhood data from OpenStreetMap.</p>
        </div>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-gray-700">1. Locate a property</h2>
          <input
            className="rounded border border-gray-300 px-3 py-2 text-sm"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. Dubai Marina, Dubai"
          />
          <button
            onClick={handleLocate}
            disabled={loadingLocation}
            className="rounded bg-gray-900 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            {loadingLocation ? "Locating…" : "Locate & show nearby amenities"}
          </button>
        </section>

        {neighborhood && (
          <section className="flex flex-col gap-1">
            <h2 className="text-sm font-medium text-gray-700">
              Nearby ({neighborhood.pois.length} within {neighborhood.radius_m}m)
            </h2>
            <ul className="max-h-40 overflow-y-auto text-xs text-gray-600">
              {neighborhood.pois.slice(0, 15).map((poi, i) => (
                <li key={i} className="flex justify-between border-b border-gray-100 py-1">
                  <span>{poi.name} <span className="text-gray-400">({poi.category})</span></span>
                  <span>{Math.round(poi.distance_m)}m</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-gray-700">2. Is it priced right?</h2>
          <div className="grid grid-cols-2 gap-2">
            <select className="rounded border border-gray-300 px-2 py-2 text-sm" value={area} onChange={(e) => setArea(e.target.value)}>
              {areas.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <select className="rounded border border-gray-300 px-2 py-2 text-sm" value={propertyType} onChange={(e) => setPropertyType(e.target.value)}>
              {propertyTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <input
            type="number"
            className="rounded border border-gray-300 px-3 py-2 text-sm"
            value={sizeSqm}
            onChange={(e) => setSizeSqm(Number(e.target.value))}
            placeholder="Size (sqm)"
          />
          <input
            type="number"
            className="rounded border border-gray-300 px-3 py-2 text-sm"
            value={askingPrice}
            onChange={(e) => setAskingPrice(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="Asking price (AED) — optional"
          />
          <button
            onClick={handleEstimate}
            disabled={loadingValuation}
            className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            {loadingValuation ? "Estimating…" : "Estimate value"}
          </button>
        </section>

        {valuation && (
          <section className="flex flex-col gap-2 rounded border border-gray-200 p-3">
            <p className="text-sm">
              Comparable range:{" "}
              <strong>
                AED {valuation.estimated_low_aed.toLocaleString()} – {valuation.estimated_high_aed.toLocaleString()}
              </strong>
            </p>
            <p className="text-xs text-gray-500">Median: AED {valuation.estimated_mid_aed.toLocaleString()} ({valuation.comparables_used} comparables)</p>
            {valuation.asking_price_verdict && (
              <p className="text-sm font-medium text-amber-700">Verdict: {valuation.asking_price_verdict}</p>
            )}
            <p className="text-xs text-gray-400">{valuation.method}</p>
            <p className="text-xs text-gray-400">{valuation.disclaimer}</p>
            <p className="text-xs text-gray-400">Source: {valuation.source}</p>
          </section>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </aside>

      <main className="flex-1">
        <PropertyMap center={center} pois={neighborhood?.pois ?? []} />
      </main>
    </div>
  );
}

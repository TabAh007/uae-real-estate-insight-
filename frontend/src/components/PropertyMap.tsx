"use client";

import { useEffect, useRef } from "react";
import maplibregl, { Map as MapLibreMap, Marker, LngLatBounds } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Poi, SchoolNearby, Transaction } from "@/lib/api";

const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "&copy; OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

const CATEGORY_COLORS: Record<string, string> = {
  school: "#2563eb",
  hospital: "#dc2626",
  clinic: "#dc2626",
  pharmacy: "#16a34a",
  supermarket: "#ea580c",
  mall: "#9333ea",
  metro_station: "#0891b2",
  park: "#65a30d",
  place_of_worship: "#78716c",
};

const RATING_COLORS: Record<string, string> = {
  Outstanding: "#15803d",
  "Very Good": "#4d7c0f",
  Good: "#ca8a04",
  Acceptable: "#ea580c",
  Weak: "#b91c1c",
  Unsatisfactory: "#7f1d1d",
};

export interface PropertyPin {
  property: Transaction;
  lat: number;
  lon: number;
}

interface PropertyMapProps {
  center: { lat: number; lon: number } | null;
  pois: Poi[];
  schools?: SchoolNearby[];
  propertyPins?: PropertyPin[];
  selectedProperty?: Transaction | null;
  onSelectProperty?: (p: Transaction) => void;
}

const fmt = (n: number) => "AED " + Math.round(n).toLocaleString();

export default function PropertyMap({
  center,
  pois,
  schools = [],
  propertyPins = [],
  selectedProperty = null,
  onSelectProperty,
}: PropertyMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const propMarkersRef = useRef<Marker[]>([]);
  const amenityMarkersRef = useRef<Marker[]>([]);
  const lastFitRef = useRef<PropertyPin[] | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapRef.current = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: [55.2708, 25.2048],
      zoom: 10,
    });
    mapRef.current.addControl(new maplibregl.NavigationControl(), "top-right");
  }, []);

  // Clickable property pins (jittered around the area centroid).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    propMarkersRef.current.forEach((m) => m.remove());
    propMarkersRef.current = [];
    if (propertyPins.length === 0) return;

    const bounds = new LngLatBounds();
    propertyPins.forEach((pin) => {
      const isSel = pin.property === selectedProperty;
      const beds = pin.property.bedrooms === 0 ? "Studio" : pin.property.bedrooms != null ? `${pin.property.bedrooms} B/R` : pin.property.property_type;
      const marker = new maplibregl.Marker({ color: isSel ? "#4f46e5" : "#818cf8", scale: isSel ? 1.3 : 0.85 })
        .setLngLat([pin.lon, pin.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 22, closeButton: false }).setText(
            `${fmt(pin.property.price_aed)} · ${beds} · ${pin.property.size_sqm.toFixed(0)} sqm`,
          ),
        )
        .addTo(map);
      const el = marker.getElement();
      el.style.cursor = "pointer";
      el.addEventListener("mouseenter", () => marker.togglePopup());
      el.addEventListener("mouseleave", () => marker.getPopup()?.remove());
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectProperty?.(pin.property);
      });
      propMarkersRef.current.push(marker);
      bounds.extend([pin.lon, pin.lat]);
    });

    // Fit only when the set of pins changes (not on selection).
    if (lastFitRef.current !== propertyPins && !bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 70, maxZoom: 15, duration: 600 });
      lastFitRef.current = propertyPins;
    }
  }, [propertyPins, selectedProperty, onSelectProperty]);

  // Amenity + school markers for the selected property's area.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    amenityMarkersRef.current.forEach((m) => m.remove());
    amenityMarkersRef.current = [];
    if (!center) return;

    pois.forEach((poi) => {
      const marker = new maplibregl.Marker({ color: CATEGORY_COLORS[poi.category] ?? "#6b7280", scale: 0.7 })
        .setLngLat([poi.lon, poi.lat])
        .setPopup(new maplibregl.Popup({ offset: 18 }).setText(`${poi.name} (${poi.category}, ${Math.round(poi.distance_m)}m)`))
        .addTo(map);
      amenityMarkersRef.current.push(marker);
    });

    schools.forEach((school) => {
      const label = `${school.name} — ${school.rating ?? "unrated"}${school.curriculum ? ` (${school.curriculum})` : ""}, ${Math.round(school.distance_m)}m`;
      const marker = new maplibregl.Marker({ color: (school.rating && RATING_COLORS[school.rating]) || "#6b7280", scale: 0.7 })
        .setLngLat([school.lon, school.lat])
        .setPopup(new maplibregl.Popup({ offset: 18 }).setText(label))
        .addTo(map);
      amenityMarkersRef.current.push(marker);
    });
  }, [center, pois, schools]);

  return <div ref={containerRef} className="h-full w-full" />;
}

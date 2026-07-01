"use client";

import { useEffect, useRef } from "react";
import maplibregl, { Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Poi } from "@/lib/api";

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

interface PropertyMapProps {
  center: { lat: number; lon: number } | null;
  pois: Poi[];
}

export default function PropertyMap({ center, pois }: PropertyMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapRef.current = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: [55.2708, 25.2048], // Dubai
      zoom: 11,
    });
    mapRef.current.addControl(new maplibregl.NavigationControl(), "top-right");
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !center) return;
    map.flyTo({ center: [center.lon, center.lat], zoom: 15 });

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    markersRef.current.push(
      new maplibregl.Marker({ color: "#111827" }).setLngLat([center.lon, center.lat]).addTo(map)
    );

    pois.forEach((poi) => {
      const marker = new maplibregl.Marker({ color: CATEGORY_COLORS[poi.category] ?? "#6b7280" })
        .setLngLat([poi.lon, poi.lat])
        .setPopup(new maplibregl.Popup().setText(`${poi.name} (${poi.category}, ${poi.distance_m}m)`))
        .addTo(map);
      markersRef.current.push(marker);
    });
  }, [center, pois]);

  return <div ref={containerRef} className="h-full w-full rounded-lg" />;
}

import { useEffect, useRef } from "react";
import L from "leaflet";
import type { HotPepperShop, Snapshot } from "@shared/types";
import { TOKYO_CENTER, RANGE_METERS } from "@shared/constants";

const EMPTY_RESTAURANTS: HotPepperShop[] = [];

if (!import.meta.env.DEV) {
  L.Icon.Default.mergeOptions({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

type Props = {
  snapshot: Snapshot | null;
  onCenterChange?: (lat: number, lng: number) => void;
  hoveredId?: string | null;
  range: number;
};

export default function Map({
  snapshot,
  onCenterChange,
  hoveredId,
  range,
}: Props) {
  const restaurants = snapshot?.searchResult?.results.shop ?? EMPTY_RESTAURANTS;
  const isHost = snapshot?.selfId === snapshot?.hostId;

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const rangeCircleRef = useRef<L.Circle | null>(null);

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView(TOKYO_CENTER, 15);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);

    if (isHost) {
      const circle = L.circle(TOKYO_CENTER, {
        radius: RANGE_METERS[3],
        color: "#3b82f6",
        fillColor: "#3b82f6",
        opacity: 0.01,
        weight: 2,
      }).addTo(map);

      rangeCircleRef.current = circle;

      map.on("move", () => circle.setLatLng(map.getCenter()));

      map.on("moveend", () => {
        const center = map.getCenter();
        onCenterChange?.(center.lat, center.lng);
      });
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 15),
        () => {},
      );
    }

    return () => {
      Object.values(markersRef.current).forEach((m) => m.remove());
      markersRef.current = {};
      map.remove();
      mapRef.current = null;
    };
  }, [isHost, onCenterChange]);

  // Update range circle
  useEffect(() => {
    if (!isHost || !rangeCircleRef.current) return;
    rangeCircleRef.current.setRadius(RANGE_METERS[range] ?? 1000);
  }, [isHost, range]);

  // Update markers
  useEffect(() => {
    if (!mapRef.current) return;

    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    restaurants.forEach((r) => {
      const marker = L.marker([r.lat, r.lng])
        .bindPopup(`<b>${r.name}</b><br/>${r.genre.name}`)
        .addTo(mapRef.current!);
      markersRef.current[r.id] = marker;
    });
  }, [restaurants]);

  // Highlight hovered marker
  useEffect(() => {
    Object.entries(markersRef.current).forEach(([id, marker]) => {
      const el = marker.getElement();
      if (!el) return;
      el.style.filter = id === hoveredId ? "hue-rotate(120deg)" : "";
    });
  }, [hoveredId]);

  return <div ref={containerRef} className="w-full h-full" />;
}

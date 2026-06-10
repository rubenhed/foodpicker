import { useEffect, useRef } from "react";
import L from "leaflet";
import type { HotPepperShop, StateSnapshotMessage } from "@shared/types";
import { TOKYO_CENTER, RANGE_METERS } from "@shared/constants";

const EMPTY_RESTAURANTS: HotPepperShop[] = [];

if (import.meta.env.DEV) {
  console.log("Using Leaflet default icons");
} else {
  L.Icon.Default.mergeOptions({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

type Props = {
  snapshot: StateSnapshotMessage | null;
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

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView(TOKYO_CENTER, 15);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);

    if (isHost) {
      const rangeCircle = L.circle(TOKYO_CENTER, {
        radius: RANGE_METERS[3],
        color: "#3b82f6",
        fillColor: "#3b82f6",
        opacity: 0.01,
        weight: 2,
      }).addTo(map);

      rangeCircleRef.current = rangeCircle;

      map.on("move", () => {
        const center = map.getCenter();

        rangeCircle.setLatLng(center);
      });
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          map.setView([pos.coords.latitude, pos.coords.longitude], 15);
        },
        () => {},
      );
    }

    if (isHost && onCenterChange) {
      map.on("moveend", () => {
        const center = map.getCenter();
        onCenterChange(center.lat, center.lng);
      });
    }

    return () => {
      const markers = markersRef.current;

      map.remove();
      mapRef.current = null;

      Object.values(markers).forEach((m) => m.remove());
      markersRef.current = {};
    };
  }, [isHost, onCenterChange]);

  useEffect(() => {
    if (!isHost || !rangeCircleRef.current) return;

    rangeCircleRef.current.setRadius(RANGE_METERS[range] ?? 1000);
  }, [isHost, range]);

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

  useEffect(() => {
    Object.entries(markersRef.current).forEach(([id, marker]) => {
      const el = marker.getElement();

      if (!el) return;

      el.style.filter = id === hoveredId ? "hue-rotate(120deg)" : "";
    });
  }, [hoveredId]);

  return <div ref={containerRef} className="w-full h-full" />;
}

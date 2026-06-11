import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import type { HotPepperShop, Snapshot } from "@shared/types";
import { MessageType, RANGE_METERS } from "@shared/constants";
import Map from "../components/Map";
import RestaurantCard from "../components/RestaurantCard";
import { Share, Check } from "lucide-react";

function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`;
}

const EMPTY_RESTAURANTS: HotPepperShop[] = [];

type Tab = "map" | "list";

export default function Room() {
  const { code } = useParams();
  const { state } = useLocation();
  const name: string = state?.name ?? "Anonymous";

  const ws = useRef<WebSocket | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [lunch, setLunch] = useState(false);
  const [range, setRange] = useState(2);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<Tab>("map");

  const isHost = !!snapshot && snapshot.selfId === snapshot.hostId;
  const searchDetails = snapshot?.searchDetails ?? null;
  const restaurants = searchDetails?.result.results.shop ?? EMPTY_RESTAURANTS;
  const votes = useMemo(() => snapshot?.votes ?? {}, [snapshot?.votes]);
  const participants = snapshot?.participants ?? [];

  const handleCenterChange = useCallback((lat: number, lng: number) => {
    setMapCenter([lat, lng]);
  }, []);

  function handleCopy() {
    navigator.clipboard.writeText(`${window.location.origin}?code=${code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Distances derived from search origin in snapshot — stable, no ref needed
  const distances = useMemo(() => {
    if (!searchDetails) return {} as Record<string, number>;
    const { lat, lng } = searchDetails.origin;
    return Object.fromEntries(
      searchDetails.result.results.shop.map((r) => [
        r.id,
        distanceMeters(lat, lng, r.lat, r.lng),
      ]),
    );
  }, [searchDetails]);

  const restaurantsByProximity = useMemo(
    () =>
      [...restaurants].sort(
        (a, b) => (distances[a.id] ?? Infinity) - (distances[b.id] ?? Infinity),
      ),
    [restaurants, distances],
  );

  const genres = useMemo(
    () => [...new Set(restaurants.map((r) => r.genre.name))],
    [restaurants],
  );

  const filteredRestaurantsByProximity = useMemo(
    () =>
      selectedGenre
        ? restaurantsByProximity.filter((r) => r.genre.name === selectedGenre)
        : restaurantsByProximity,
    [restaurantsByProximity, selectedGenre],
  );

  const currentVotes = useMemo(
    () =>
      restaurantsByProximity
        .filter((r) => Object.values(votes).some((id) => id === r.id))
        .sort(
          (a, b) =>
            Object.values(votes).filter((id) => id === b.id).length -
            Object.values(votes).filter((id) => id === a.id).length,
        ),
    [restaurantsByProximity, votes],
  );

  const sendSearch = useCallback(() => {
    if (!isHost || !mapCenter || ws.current?.readyState !== WebSocket.OPEN)
      return;
    setIsSearching(true);
    ws.current.send(
      JSON.stringify({
        type: MessageType.SEARCH,
        lat: mapCenter[0],
        lng: mapCenter[1],
        range,
        lunch,
      }),
    );
  }, [isHost, mapCenter, range, lunch]);

  const sendVote = useCallback((restaurantId: string) => {
    if (ws.current?.readyState !== WebSocket.OPEN) return;
    ws.current.send(JSON.stringify({ type: MessageType.VOTE, restaurantId }));
  }, []);

  const connect = useCallback(() => {
    const wsUrl = `${import.meta.env.VITE_WS_BASE}/room/${code}/ws?name=${encodeURIComponent(name)}`;
    const socket = new WebSocket(wsUrl);
    ws.current = socket;

    socket.onerror = (e) => console.error("ws error", e);
    socket.onclose = (e) => console.log("ws closed", e.code, e.reason);

    socket.onmessage = (e) => {
      const msg = JSON.parse(e.data) as Partial<Snapshot>;
      setSnapshot(
        (prev) =>
          ({
            ...(prev ?? {}),
            ...msg,
            searchDetails:
              "searchDetails" in msg ? msg.searchDetails : prev?.searchDetails,
          }) as Snapshot,
      );
      setIsSearching(false);
    };
  }, [code, name]);

  useEffect(() => {
    connect();
    const handleVisibility = () => {
      if (
        document.visibilityState === "visible" &&
        ws.current?.readyState !== WebSocket.OPEN
      ) {
        connect();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      ws.current?.close();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [connect]);

  const tabBtn = (t: Tab, label: string, count?: number) => (
    <button
      onClick={() => setTab(t)}
      className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${
        tab === t
          ? "bg-white text-stone-900 shadow-sm"
          : "text-stone-500 hover:text-stone-700"
      }`}
    >
      {label}
      {count !== undefined ? ` (${count})` : ""}
    </button>
  );

  const restaurantList = (
    list: HotPepperShop[],
    emptyMsg: string,
    compact = false,
  ) => (
    <div className="flex flex-col gap-2 overflow-y-auto flex-1 min-h-0">
      {list.length === 0 && (
        <p className="text-stone-400 text-sm">{emptyMsg}</p>
      )}
      {list.map((r) => (
        <RestaurantCard
          key={r.id}
          r={r}
          votes={votes}
          selfVote={votes[snapshot?.selfId ?? ""] ?? null}
          onVote={() => sendVote(r.id)}
          onMouseEnter={() => setHoveredId(r.id)}
          onMouseLeave={() => setHoveredId(null)}
          distance={formatDistance(distances[r.id] ?? 0)}
          compact={compact}
        />
      ))}
    </div>
  );

  const genreFilter = (
    <div className="flex flex-wrap gap-2 shrink-0">
      <button
        onClick={() => setSelectedGenre(null)}
        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
          selectedGenre === null
            ? "bg-orange-500 text-white"
            : "bg-stone-100 text-stone-600 hover:bg-stone-200"
        }`}
      >
        All
      </button>
      {genres.map((genre) => (
        <button
          key={genre}
          onClick={() =>
            setSelectedGenre(genre === selectedGenre ? null : genre)
          }
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            selectedGenre === genre
              ? "bg-orange-500 text-white"
              : "bg-stone-100 text-stone-600 hover:bg-stone-200"
          }`}
        >
          {genre}
        </button>
      ))}
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-stone-50 text-stone-900 p-4 gap-3 overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-start gap-2">
        <div className="flex items-center gap-3 shrink-0">
          <h1 className="text-xl font-bold tracking-tight">
            Food<span className="text-orange-500">Picker</span>
            <span className="text-stone-300 font-normal mx-2">/</span>
            <span className="text-stone-500 font-mono text-base">{code}</span>
          </h1>
          {isHost && (
            <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">
              host
            </span>
          )}
          <div className="relative">
            <button
              onClick={handleCopy}
              className="text-stone-400 hover:text-orange-500 transition-colors"
              title="Copy invite link"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Share className="w-4 h-4" />
              )}
            </button>
            {copied && (
              <span className="absolute left-1/2 -translate-x-1/2 top-6 text-xs text-green-500 font-medium whitespace-nowrap">
                Link copied!
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 min-w-0">
          <span className="text-xs text-stone-400">
            {participants.length} participant
            {participants.length !== 1 ? "s" : ""}
          </span>
          <div className="flex flex-wrap justify-end gap-x-2 gap-y-0.5">
            {participants.map((p) => (
              <span
                key={p.userId}
                className={`text-xs ${p.userId === snapshot?.selfId ? "text-stone-900 font-semibold" : "text-stone-400"}`}
              >
                {p.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Host controls */}
      {isHost && (
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={sendSearch}
            disabled={isSearching || !mapCenter}
            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 rounded-lg font-semibold text-sm disabled:opacity-40 transition-colors"
          >
            {isSearching ? "Searching..." : "Search Nearby"}
          </button>
          <select
            value={range}
            onChange={(e) => setRange(Number(e.target.value))}
            className="bg-white border border-stone-200 px-3 py-1.5 rounded-lg text-sm text-stone-700 focus:outline-none focus:border-orange-400"
          >
            {Object.entries(RANGE_METERS).map(([key, meters]) => (
              <option key={key} value={key}>
                {meters >= 1000 ? `${meters / 1000}km` : `${meters}m`}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
            <input
              type="checkbox"
              checked={lunch}
              onChange={(e) => setLunch(e.target.checked)}
              className="w-4 h-4 accent-orange-500"
            />
            Lunch only
          </label>
        </div>
      )}

      {/* Mobile tabs */}
      <div className="md:hidden flex gap-1 bg-stone-100 p-1 rounded-xl shrink-0">
        {tabBtn("map", "Map")}
        {tabBtn("list", "List", filteredRestaurantsByProximity.length)}
      </div>

      {/* Mobile content */}
      <div className="md:hidden flex flex-col flex-1 min-h-0">
        {tab === "map" && (
          <div className="rounded-xl overflow-hidden border border-stone-200 flex-1">
            <Map
              snapshot={snapshot}
              onCenterChange={handleCenterChange}
              hoveredId={hoveredId}
              range={range}
            />
          </div>
        )}
        {tab === "list" && (
          <div className="flex flex-col flex-1 min-h-0 gap-3">
            {genres.length > 0 && genreFilter}
            <div className="flex flex-col min-h-0" style={{ flex: 2 }}>
              <h2 className="text-xs font-semibold text-stone-400 mb-2 uppercase tracking-wider shrink-0">
                Nearby ({filteredRestaurantsByProximity.length})
              </h2>
              {restaurantList(
                filteredRestaurantsByProximity,
                isHost
                  ? "Move the map and hit Search."
                  : "Waiting for host to search.",
              )}
            </div>
            {currentVotes.length > 0 && (
              <div className="flex flex-col min-h-0" style={{ flex: 1 }}>
                <h2 className="text-xs font-semibold text-stone-400 mb-2 uppercase tracking-wider shrink-0">
                  Votes ({currentVotes.length})
                </h2>
                {restaurantList(currentVotes, "No votes yet.", true)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Desktop layout */}
      <div className="hidden md:flex flex-col flex-1 min-h-0 gap-4">
        <div
          className="w-full rounded-xl overflow-hidden shrink-0 border border-stone-200"
          style={{ height: "50vh" }}
        >
          <Map
            snapshot={snapshot}
            onCenterChange={handleCenterChange}
            hoveredId={hoveredId}
            range={range}
          />
        </div>
        {genres.length > 0 && genreFilter}
        <div className="flex gap-4 flex-1 min-h-0">
          <div className="flex flex-col min-h-0" style={{ flex: 2 }}>
            <h2 className="text-xs font-semibold text-stone-400 mb-2 uppercase tracking-wider shrink-0">
              Nearby ({filteredRestaurantsByProximity.length})
            </h2>
            {restaurantList(
              filteredRestaurantsByProximity,
              isHost
                ? "Move the map and hit Search."
                : "Waiting for host to search.",
            )}
          </div>
          <div className="flex flex-col min-h-0" style={{ flex: 1 }}>
            <h2 className="text-xs font-semibold text-stone-400 mb-2 uppercase tracking-wider shrink-0">
              Votes ({currentVotes.length})
            </h2>
            {restaurantList(currentVotes, "No votes yet.", true)}
          </div>
        </div>
      </div>
    </div>
  );
}

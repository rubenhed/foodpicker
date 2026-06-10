import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import type {
  HotPepperShop,
  ServerMessage,
  StateSnapshotMessage,
} from "@shared/types";
import { MessageType, RANGE_METERS } from "@shared/constants";
import Map from "../components/Map";
import RestaurantCard from "../components/RestaurantCard";

function distance(lat1: number, lng1: number, lat2: number, lng2: number) {
  return Math.sqrt((lat1 - lat2) ** 2 + (lng1 - lng2) ** 2);
}

export default function Room() {
  const { code } = useParams();
  const { state } = useLocation();
  const nameRef = useRef<string>(state?.name ?? "Anonymous");

  const ws = useRef<WebSocket | null>(null);
  const [snapshot, setSnapshot] = useState<StateSnapshotMessage | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [lunch, setLunch] = useState(false);
  const [range, setRange] = useState(3);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);

  const userId = snapshot?.selfId ?? null;
  const isHost = snapshot?.selfId === snapshot?.hostId;

  const EMPTY_RESTAURANTS: HotPepperShop[] = [];
  const EMPTY_PARTICIPANTS: string[] = [];
  const EMPTY_VOTES: Record<string, string> = {};

  const restaurants = snapshot?.searchResult?.results.shop ?? EMPTY_RESTAURANTS;
  const votes = snapshot?.votes ?? EMPTY_VOTES;
  const participants = snapshot?.participantIds ?? EMPTY_PARTICIPANTS;

  const handleCenterChange = useCallback((lat: number, lng: number) => {
    setMapCenter([lat, lng]);
  }, []);

  const sorted = useMemo(
    () =>
      mapCenter
        ? [...(restaurants ?? [])].sort(
            (a, b) =>
              distance(mapCenter[0], mapCenter[1], a.lat, a.lng) -
              distance(mapCenter[0], mapCenter[1], b.lat, b.lng),
          )
        : (restaurants ?? []),
    [restaurants, mapCenter],
  );

  const genres = useMemo(
    () => [...new Set(restaurants.map((r) => r.genre.name))],
    [restaurants],
  );

  const filtered = useMemo(
    () =>
      selectedGenre
        ? sorted.filter((r) => r.genre.name === selectedGenre)
        : sorted,
    [sorted, selectedGenre],
  );

  function sendSearch() {
    if (!isHost) return;
    if (!mapCenter) return;

    if (ws.current?.readyState !== WebSocket.OPEN) {
      console.log("ws not open, readyState:", ws.current?.readyState);
      return;
    }

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
  }

  const connect = useCallback(() => {
    const wsUrl = `${import.meta.env.VITE_WS_BASE}/room/${code}/ws`;
    const socket = new WebSocket(wsUrl);
    ws.current = socket;

    socket.onerror = (e) => console.error("ws error", e);
    socket.onclose = (e) => console.log("ws closed", e.code, e.reason);

    socket.onopen = () => {
      socket.send(
        JSON.stringify({ type: MessageType.JOIN, name: nameRef.current }),
      );
    };

    socket.onmessage = (e) => {
      const msg = JSON.parse(e.data) as ServerMessage;

      switch (msg.type) {
        case MessageType.STATE_SNAPSHOT:
          setSnapshot(msg);
          setIsSearching(false);
          break;
      }
    };
  }, [code]);

  useEffect(() => {
    connect();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        if (ws.current?.readyState !== WebSocket.OPEN) {
          console.log("reconnecting after tab focus...");
          connect();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      ws.current?.close();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [code, connect]);

  return (
    <div className="h-screen flex flex-col bg-black text-white p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Room: {code}</h1>
        <span className="text-zinc-400">
          {participants.length} participants
        </span>
      </div>

      <p className="text-zinc-400 mb-4">
        You are {userId} {isHost ? "(host)" : ""}
      </p>

      {isHost && (
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={sendSearch}
            disabled={isSearching}
            className="bg-white text-black px-4 py-2 rounded font-semibold disabled:opacity-50"
          >
            {isSearching ? "Searching..." : "Search Nearby"}
          </button>

          <select
            value={range}
            onChange={(e) => setRange(Number(e.target.value))}
            className="bg-zinc-800 px-3 py-2 rounded"
          >
            {Object.entries(RANGE_METERS).map(([key, meters]) => (
              <option key={key} value={key}>
                {meters >= 1000 ? `${meters / 1000}km` : `${meters}m`}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={lunch}
              onChange={(e) => setLunch(e.target.checked)}
              className="w-4 h-4"
            />
            <span>Lunch</span>
          </label>
        </div>
      )}

      <div className="w-full h-[50vh]">
        <Map
          snapshot={snapshot}
          onCenterChange={handleCenterChange}
          hoveredId={hoveredId}
          range={range}
        />
      </div>

      {genres.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            onClick={() => setSelectedGenre(null)}
            className={`px-3 py-1 rounded text-sm ${selectedGenre === null ? "bg-white text-black" : "bg-zinc-700"}`}
          >
            All
          </button>
          {genres.map((genre) => (
            <button
              key={genre}
              onClick={() =>
                setSelectedGenre(genre === selectedGenre ? null : genre)
              }
              className={`px-3 py-1 rounded text-sm ${selectedGenre === genre ? "bg-white text-black" : "bg-zinc-700"}`}
            >
              {genre}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 overflow-hidden flex-1 min-h-0 mt-4">
        <div className="flex flex-col flex-1 min-h-0">
          <h2 className="text-lg font-semibold mb-2">All Restaurants</h2>
          <div className="flex flex-col gap-3 overflow-y-auto flex-1 min-h-0">
            {filtered.map((r) => (
              <RestaurantCard
                key={r.id}
                r={r}
                votes={votes}
                onVote={() =>
                  ws.current?.send(
                    JSON.stringify({
                      type: MessageType.VOTE,
                      restaurantId: r.id,
                    }),
                  )
                }
                onMouseEnter={() => setHoveredId(r.id)}
                onMouseLeave={() => setHoveredId(null)}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col flex-1 min-h-0">
          <h2 className="text-lg font-semibold mb-2">Top Picks</h2>
          <div className="flex flex-col gap-3 overflow-y-auto flex-1 min-h-0">
            {sorted
              .filter((r) => Object.values(votes).some((id) => id === r.id))
              .sort(
                (a, b) =>
                  Object.values(votes).filter((id) => id === b.id).length -
                  Object.values(votes).filter((id) => id === a.id).length,
              )
              .map((r) => (
                <RestaurantCard
                  key={r.id}
                  r={r}
                  votes={votes}
                  onVote={() =>
                    ws.current?.send(
                      JSON.stringify({
                        type: MessageType.VOTE,
                        restaurantId: r.id,
                      }),
                    )
                  }
                  onMouseEnter={() => setHoveredId(r.id)}
                  onMouseLeave={() => setHoveredId(null)}
                />
              ))}
            {Object.keys(votes).length === 0 && (
              <p className="text-zinc-500 text-sm">No votes yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

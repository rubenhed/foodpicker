import type { HotPepperShop } from "@shared/types";
import { MapPin } from "lucide-react";

type Props = {
  r: HotPepperShop;
  votes: Record<string, string>;
  selfVote: string | null;
  onVote: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  distance: string;
  compact: boolean;
};

export default function RestaurantCard({
  r,
  votes,
  selfVote,
  onVote,
  onMouseEnter,
  onMouseLeave,
  distance,
  compact,
}: Props) {
  const voteCount = Object.values(votes).filter((id) => id === r.id).length;
  const isVoted = selfVote === r.id;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`;

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="bg-white border border-stone-200 p-3 rounded-xl flex justify-between items-center gap-3"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <a
            href={r.urls.pc}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-sm text-stone-900 hover:text-orange-500 transition-colors truncate"
          >
            {r.name}
          </a>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-stone-500 hover:text-orange-500 transition-colors shrink-0"
          >
            <MapPin className="w-4 h-4" />
          </a>
        </div>
        {!compact && (
          <p className="text-stone-400 text-xs mt-0.5">{r.genre.name}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full font-medium">
          {distance}
        </span>
        {voteCount > 0 && (
          <span className="text-stone-400 text-xs">{voteCount}</span>
        )}
        <button
          onClick={onVote}
          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
            isVoted
              ? "bg-orange-500 text-white"
              : "bg-stone-100 text-stone-600 hover:bg-stone-200"
          }`}
        >
          {isVoted ? "Voted" : "Vote"}
        </button>
      </div>
    </div>
  );
}

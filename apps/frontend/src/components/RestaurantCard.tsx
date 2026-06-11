import type { HotPepperShop } from "@shared/types";

type Props = {
  r: HotPepperShop;
  votes: Record<string, string>;
  selfVote: string | null;
  onVote: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
};

export default function RestaurantCard({
  r,
  votes,
  selfVote,
  onVote,
  onMouseEnter,
  onMouseLeave,
}: Props) {
  const voteCount = Object.values(votes).filter((id) => id === r.id).length;
  const isVoted = selfVote === r.id;

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="bg-white border border-stone-200 p-3 rounded-xl flex justify-between items-center gap-3"
    >
      <div className="min-w-0">
        <a
          href={r.urls.pc}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-sm text-stone-900 hover:text-orange-500 transition-colors truncate block"
        >
          {r.name}
        </a>
        <p className="text-stone-400 text-xs mt-0.5">{r.genre.name}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
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

import type { HotPepperShop } from "@shared/types";

type Props = {
  r: HotPepperShop;
  votes: Record<string, string>;
  onVote: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
};

export default function RestaurantCard({
  r,
  votes,
  onVote,
  onMouseEnter,
  onMouseLeave,
}: Props) {
  const voteCount = Object.values(votes).filter((id) => id === r.id).length;
  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="bg-zinc-800 p-4 rounded flex justify-between items-center"
    >
      <div>
        <p className="font-semibold">{r.name}</p>
        <p className="text-zinc-400 text-sm">{r.genre.name}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-zinc-400">{voteCount} votes</span>
        <button onClick={onVote} className="bg-zinc-600 px-3 py-1 rounded">
          Vote
        </button>
      </div>
    </div>
  );
}

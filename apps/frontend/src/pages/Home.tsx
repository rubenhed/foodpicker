import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE;

type Mode = null | "create" | "join";

export default function Home() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initialCode = searchParams.get("code")?.toUpperCase() ?? "";

  const [mode, setMode] = useState<Mode>(initialCode ? "join" : null);
  const [name, setName] = useState("");
  const [code, setCode] = useState(initialCode);
  const [isCreating, setIsCreating] = useState(false);

  function reset() {
    setMode(null);
    setName("");
    setCode("");
  }

  async function handleCreate() {
    if (!name.trim()) return;
    setIsCreating(true);
    const res = await fetch(`${API_BASE}/room`, { method: "POST" });
    const data = (await res.json()) as { roomCode: string };
    navigate(`/room/${data.roomCode}`, { state: { name: name.trim() } });
  }

  function handleJoin() {
    if (!name.trim() || !code.trim()) return;
    navigate(`/room/${code.trim().toUpperCase()}`, {
      state: { name: name.trim() },
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Enter") return;
    if (mode === "create") handleCreate();
    if (mode === "join") handleJoin();
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col gap-6">
        {/* Brand */}
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">
            Food<span className="text-orange-500">Picker</span>
          </h1>
          <p className="text-stone-400 text-sm mt-1">
            Pick a restaurant, together.
          </p>
        </div>

        {/* Default: two buttons */}
        {mode === null && (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setMode("create")}
              className="bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-semibold transition-colors"
            >
              Create Room
            </button>
            <button
              onClick={() => setMode("join")}
              className="bg-white hover:bg-stone-100 text-stone-900 border border-stone-200 py-3 rounded-xl font-semibold transition-colors"
            >
              Join Room
            </button>
          </div>
        )}

        {/* Create form */}
        {mode === "create" && (
          <div className="flex flex-col gap-3">
            <input
              className="bg-white border border-stone-200 px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-orange-400 placeholder:text-stone-300"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            <button
              onClick={handleCreate}
              disabled={isCreating || !name.trim()}
              className="bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-semibold disabled:opacity-40 transition-colors"
            >
              {isCreating ? "Creating..." : "Create Room"}
            </button>
            <button
              onClick={reset}
              className="text-stone-400 hover:text-stone-600 text-sm transition-colors"
            >
              Back
            </button>
          </div>
        )}

        {/* Join form */}
        {mode === "join" && (
          <div className="flex flex-col gap-3">
            <input
              className="bg-white border border-stone-200 px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-orange-400 placeholder:text-stone-300"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            <input
              className="bg-white border border-stone-200 px-4 py-3 rounded-xl text-sm uppercase tracking-widest focus:outline-none focus:border-orange-400 placeholder:text-stone-300 placeholder:normal-case placeholder:tracking-normal"
              placeholder="Room code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              maxLength={4}
            />
            <button
              onClick={handleJoin}
              disabled={!name.trim() || !code.trim()}
              className="bg-stone-900 hover:bg-stone-700 text-white py-3 rounded-xl font-semibold disabled:opacity-40 transition-colors"
            >
              Join Room
            </button>
            <button
              onClick={reset}
              className="text-stone-400 hover:text-stone-600 text-sm transition-colors"
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

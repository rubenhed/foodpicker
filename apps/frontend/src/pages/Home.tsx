import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE;

export default function Home() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setIsCreating(true);
    const res = await fetch(`${API_BASE}/room`, { method: "POST" });
    const data = (await res.json()) as { roomCode: string; wsUrl: string };
    navigate(`/room/${data.roomCode}`, { state: { name } });
  }

  function handleJoin() {
    if (!name.trim() || !code.trim()) return;
    navigate(`/room/${code.trim().toUpperCase()}`, { state: { name } });
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-6">
      <h1 className="text-4xl font-bold">FoodPicker</h1>

      <input
        className="bg-zinc-800 px-4 py-2 rounded w-64"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <button
        onClick={handleCreate}
        disabled={isCreating}
        className="bg-white text-black px-6 py-2 rounded font-semibold w-64"
      >
        {isCreating ? "Creating..." : "Create Room"}
      </button>

      <div className="flex gap-2 w-64">
        <input
          className="bg-zinc-800 px-4 py-2 rounded flex-1"
          placeholder="Room code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button
          onClick={handleJoin}
          className="bg-zinc-700 px-4 py-2 rounded font-semibold"
        >
          Join
        </button>
      </div>
    </div>
  );
}

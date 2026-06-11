import { Hono } from "hono";
import { cors } from "hono/cors";
import { Room } from "./room";

type Bindings = {
  ROOM: DurableObjectNamespace<Room>;
  WS_BASE_URL: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", cors());

// Get a randomized room code
app.post("/room", async (c) => {
  const code = Math.random().toString(36).slice(2, 6).toUpperCase();
  return c.json({
    roomCode: code,
    wsUrl: `${c.env.WS_BASE_URL}/room/${code}/ws`,
  });
});

// WebSocket upgrade — forwards to the Room Durable Object
// Lazily creates the room one fetch if it doesnt exist already
app.get("/room/:code/ws", async (c) => {
  const id = c.env.ROOM.idFromName(c.req.param("code"));
  const stub = c.env.ROOM.get(id);
  return stub.fetch(c.req.raw);
});

export default app;
export { Room };

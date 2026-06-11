import { DurableObject } from "cloudflare:workers";
import type { HotPepperResponse, SearchDetails } from "@shared/types";
import { MessageType } from "@shared/constants";

const HOTPEPPER_API_URL =
  "http://webservice.recruit.co.jp/hotpepper/gourmet/v1/";
const SEARCH_INFO_KEY = "searchDetails";

type Session = {
  userId: string;
  name: string;
  isHost: boolean;
  vote: string | null;
};

type Env = {
  HOTPEPPER_KEY: string;
};

export class Room extends DurableObject<Env> {
  sessions = new Map<WebSocket, Session>();
  searchDetails: SearchDetails | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<string>(SEARCH_INFO_KEY);
      if (stored) {
        this.searchDetails = JSON.parse(stored);
      }

      for (const ws of this.ctx.getWebSockets()) {
        const attachedSession = ws.deserializeAttachment();
        if (attachedSession) {
          this.sessions.set(ws, attachedSession as Session);
        }
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("not found", { status: 404 });
    }

    const pair = new WebSocketPair();
    const [client, ws] = Object.values(pair);

    const url = new URL(request.url);
    const name = url.searchParams.get("name") ?? "Anonymous";

    const session: Session = {
      userId: crypto.randomUUID(),
      name,
      isHost: this.sessions.size === 0,
      vote: null,
    };

    this.sessions.set(ws, session);
    ws.serializeAttachment(session);

    this.ctx.acceptWebSocket(ws);

    this.broadcast({
      ...this.getSessionsPayload(),
      searchDetails: this.searchDetails,
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string) {
    const msg = JSON.parse(message);

    switch (msg.type) {
      case MessageType.SEARCH:
        await this.handleSearch(ws, msg);
        break;

      case MessageType.VOTE:
        await this.handleVote(ws, msg.restaurantId);
        break;
    }
  }

  private getSessionsPayload() {
    const sessions = [...this.sessions.values()];
    return {
      votes: Object.fromEntries(sessions.map((s) => [s.userId, s.vote])),
      participants: sessions.map((s) => ({ userId: s.userId, name: s.name })),
      hostId: sessions.find((s) => s.isHost)?.userId ?? null,
    };
  }

  private broadcast(payload: object) {
    for (const [ws, session] of this.sessions) {
      try {
        ws.send(JSON.stringify({ selfId: session.userId, ...payload }));
      } catch (err) {
        console.error("broadcast failed", err);
      }
    }
  }

  private async handleSearch(
    ws: WebSocket,
    msg: {
      lat: number;
      lng: number;
      range: number;
      lunch: boolean;
      genre?: string;
    },
  ) {
    const session = this.sessions.get(ws);
    if (!session?.isHost) return;

    const params = new URLSearchParams({
      key: this.env.HOTPEPPER_KEY,
      lat: String(msg.lat),
      lng: String(msg.lng),
      range: String(msg.range),
      count: "100",
      format: "json",
      ...(msg.lunch && { lunch: "1" }),
      ...(msg.genre && { genre: msg.genre }),
    });

    let data: HotPepperResponse | null = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(`${HOTPEPPER_API_URL}?${params}`);
        data = (await res.json()) as HotPepperResponse;
        break;
      } catch (err) {
        console.error(`Search attempt ${attempt} failed`, err);
        if (attempt === 3) return;
      }
    }

    if (!data) return;

    this.searchDetails = {
      origin: { lat: msg.lat, lng: msg.lng },
      range: msg.range,
      result: data,
    };

    await this.ctx.storage.put(
      SEARCH_INFO_KEY,
      JSON.stringify(this.searchDetails),
    );

    this.broadcast({ searchDetails: this.searchDetails });
  }

  private async handleVote(ws: WebSocket, restaurantId: string) {
    const session = this.sessions.get(ws);
    if (!session) return;

    session.vote = restaurantId;
    ws.serializeAttachment(session);

    this.broadcast(this.getSessionsPayload());
  }

  async webSocketClose(ws: WebSocket) {
    const session = this.sessions.get(ws);
    this.sessions.delete(ws);

    if (!session) return;

    if (session.isHost) {
      const remaining = [...this.sessions.entries()];
      if (remaining.length > 0) {
        const [nextWs, nextSession] = remaining[0];
        nextSession.isHost = true;
        nextWs.serializeAttachment(nextSession);
      }
    }

    this.broadcast(this.getSessionsPayload());
  }
}

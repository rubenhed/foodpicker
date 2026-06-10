import { DurableObject } from "cloudflare:workers";
import type { HotPepperResponse } from "@shared/types";
import { MessageType } from "@shared/constants";

const HOTPEPPER_API_URL =
  "http://webservice.recruit.co.jp/hotpepper/gourmet/v1/";

type Session = {
  userId: string;
  name: string;
};

type Env = {
  HOTPEPPER_KEY: string;
};

export class Room extends DurableObject<Env> {
  hostId: string | null = null;
  counter = 0;
  sessions = new Map<WebSocket, Session>();
  searchResult: HotPepperResponse | null = null;
  votes = new Map<string, string>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    ctx.blockConcurrencyWhile(async () => {
      this.counter = (await this.ctx.storage.get<number>("counter")) ?? 0;

      const storedHostId = await this.ctx.storage.get<string>("hostId");
      if (storedHostId) {
        this.hostId = storedHostId;
      }

      const storedSearchResult =
        await this.ctx.storage.get<string>("searchResult");

      if (storedSearchResult) {
        this.searchResult = JSON.parse(storedSearchResult);
      }

      const storedVotes = await this.ctx.storage.get<string>("votes");

      if (storedVotes) {
        this.votes = new Map(Object.entries(JSON.parse(storedVotes)));
      }

      for (const ws of this.ctx.getWebSockets()) {
        const attachment = ws.deserializeAttachment();

        if (attachment) {
          this.sessions.set(ws, attachment as Session);
        }
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      this.ctx.acceptWebSocket(server);

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    return new Response("not found", {
      status: 404,
    });
  }

  async webSocketMessage(ws: WebSocket, message: string) {
    const msg = JSON.parse(message);

    switch (msg.type) {
      case MessageType.JOIN:
        await this.handleJoin(ws, msg.name);
        break;

      case MessageType.SEARCH:
        await this.handleSearch(ws, msg);
        break;

      case MessageType.VOTE:
        await this.handleVote(ws, msg.restaurantId);
        break;
    }
  }

  private getState() {
    return {
      hostId: this.hostId,
      searchResult: this.searchResult,
      votes: Object.fromEntries(this.votes),
      participantIds: [...this.sessions.values()].map((s) => s.userId),
    };
  }

  private broadcastState() {
    const state = this.getState();

    for (const [socket, session] of this.sessions) {
      try {
        socket.send(
          JSON.stringify({
            type: MessageType.STATE_SNAPSHOT,
            selfId: session.userId,
            ...state,
          }),
        );
      } catch (err) {
        console.error("broadcastState failed", err);
      }
    }
  }

  private async handleJoin(ws: WebSocket, name: string) {
    const userId = `p${++this.counter}`;

    await this.ctx.storage.put("counter", this.counter);

    const session = {
      userId,
      name,
    };

    this.sessions.set(ws, session);
    ws.serializeAttachment(session);

    if (this.hostId === null) {
      this.hostId = userId;

      await this.ctx.storage.put("hostId", userId);
    }

    this.broadcastState();
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

    if (!session || session.userId !== this.hostId) {
      return;
    }

    const params = new URLSearchParams({
      key: this.env.HOTPEPPER_KEY,
      lat: String(msg.lat),
      lng: String(msg.lng),
      range: String(msg.range),
      count: "100",
      format: "json",
      ...(msg.lunch && {
        lunch: "1",
      }),
      ...(msg.genre && {
        genre: msg.genre,
      }),
    });

    let data: HotPepperResponse | null = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(`${HOTPEPPER_API_URL}?${params}`);

        data = (await res.json()) as HotPepperResponse;

        break;
      } catch (err) {
        console.error(`Search attempt ${attempt} failed`, err);

        if (attempt === 3) {
          return;
        }
      }
    }

    if (!data) return;

    this.searchResult = data;

    await this.ctx.storage.put(
      "searchResult",
      JSON.stringify(this.searchResult),
    );

    this.broadcastState();
  }

  private async handleVote(ws: WebSocket, restaurantId: string) {
    const session = this.sessions.get(ws);

    if (!session) return;

    this.votes.set(session.userId, restaurantId);

    await this.ctx.storage.put(
      "votes",
      JSON.stringify(Object.fromEntries(this.votes)),
    );

    this.broadcastState();
  }

  async webSocketClose(ws: WebSocket) {
    const session = this.sessions.get(ws);

    this.sessions.delete(ws);

    if (!session) return;

    if (session.userId === this.hostId) {
      const remaining = [...this.sessions.values()];

      this.hostId = remaining.length > 0 ? remaining[0].userId : null;

      await this.ctx.storage.put("hostId", this.hostId);
    }

    this.votes.delete(session.userId);

    await this.ctx.storage.put(
      "votes",
      JSON.stringify(Object.fromEntries(this.votes)),
    );

    this.broadcastState();
  }
}

import { DurableObject } from "cloudflare:workers";

import type { NotificationEventRealtimeUpdate } from "./notification-event";

interface WebSocketAttachment {
  readonly actorId: string;
  readonly connectedAt: string;
  readonly scope: string;
}

type NotificationEventRealtimeEnv = Record<string, unknown>;

const getStringSearchParam = (
  request: Request,
  key: string,
  fallback: string
): string => {
  const value = new URL(request.url).searchParams.get(key);
  return value && value.length > 0 ? value : fallback;
};

export class NotificationEventRealtimeDurableObject extends DurableObject<NotificationEventRealtimeEnv> {
  constructor(ctx: DurableObjectState, env: NotificationEventRealtimeEnv) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(() => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS stream_events (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          occurred_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS stream_subscriptions (
          actor_id TEXT NOT NULL,
          scope TEXT NOT NULL,
          connected_at TEXT NOT NULL,
          PRIMARY KEY (actor_id, scope)
        );
      `);
      return Promise.resolve();
    });
  }

  fetch(request: Request): Response {
    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }

    const scope = getStringSearchParam(request, "scope", "tenant:default");
    const actorId = getStringSearchParam(request, "actorId", "anonymous");
    const [client, server] = Object.values(new WebSocketPair()) as [
      WebSocket,
      WebSocket,
    ];
    const attachment: WebSocketAttachment = {
      actorId,
      connectedAt: new Date().toISOString(),
      scope,
    };

    server.serializeAttachment(attachment);
    this.ctx.acceptWebSocket(server);
    this.ctx.storage.sql.exec(
      `INSERT OR REPLACE INTO stream_subscriptions
        (actor_id, scope, connected_at)
       VALUES (?, ?, ?)`,
      attachment.actorId,
      attachment.scope,
      attachment.connectedAt
    );

    return new Response(null, { status: 101, webSocket: client });
  }

  broadcast(update: NotificationEventRealtimeUpdate): void {
    this.ctx.storage.sql.exec(
      `INSERT OR REPLACE INTO stream_events
        (id, type, payload_json, occurred_at)
       VALUES (?, ?, ?, ?)`,
      update.id,
      update.type,
      JSON.stringify(update.payload),
      update.occurredAt
    );

    const frame = JSON.stringify(update);

    for (const socket of this.ctx.getWebSockets()) {
      socket.send(frame);
    }
  }

  webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): void {
    const attachment =
      socket.deserializeAttachment() as WebSocketAttachment | null;

    if (attachment) {
      this.ctx.storage.sql.exec(
        `INSERT OR REPLACE INTO stream_subscriptions
          (actor_id, scope, connected_at)
         VALUES (?, ?, ?)`,
        attachment.actorId,
        attachment.scope,
        attachment.connectedAt
      );
    }

    socket.send(
      JSON.stringify({
        actorId: attachment?.actorId,
        receivedAt: new Date().toISOString(),
        scope: attachment?.scope,
        type: "ack",
      })
    );

    void message;
  }

  webSocketClose(socket: WebSocket): void {
    const attachment =
      socket.deserializeAttachment() as WebSocketAttachment | null;

    if (!attachment) {
      return;
    }

    this.ctx.storage.sql.exec(
      `DELETE FROM stream_subscriptions
       WHERE actor_id = ? AND scope = ?`,
      attachment.actorId,
      attachment.scope
    );
  }
}

import { fileURLToPath, URL } from "node:url";

import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { config } from "dotenv";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

const fromPackageRoot = (path: string) =>
  fileURLToPath(new URL(path, import.meta.url));

config({ path: fromPackageRoot("../../.env") });
config({ path: fromPackageRoot("./.env") });
config({ path: fromPackageRoot("../../apps/server/.env") });
config({ path: fromPackageRoot("../../apps/web/.env") });

const compatibility = {
  date: "2026-03-17",
  flags: ["nodejs_compat"],
};

const localServerUrl = "http://localhost:3000";
const localWebUrl = "http://localhost:3001";

const requiredServerConfig = {
  BETTER_AUTH_SECRET: Config.redacted("BETTER_AUTH_SECRET"),
  BETTER_AUTH_URL: Config.string("BETTER_AUTH_URL").pipe(
    Config.withDefault(localServerUrl)
  ),
  CORS_ORIGIN: Config.string("CORS_ORIGIN").pipe(
    Config.withDefault(localWebUrl)
  ),
} as const;

const providers = Layer.mergeAll(Cloudflare.providers());

export const database = Cloudflare.D1Database("Database", {
  migrationsDir: fromPackageRoot("../../packages/db-d1/src/migrations/sql"),
  migrationsTable: "d1_migrations",
});

export const statefulCoordinator = Cloudflare.DurableObjectNamespace(
  "StatefulCoordinatorDurableObject"
);

export const cartCache = Cloudflare.DurableObjectNamespace(
  "CartCacheDurableObject"
);

export const notificationEventQueue = Cloudflare.Queue(
  "NotificationEventQueue",
  {
    name: "notification-event-work",
  }
);

export const notificationEventDeadLetterQueue = Cloudflare.Queue(
  "NotificationEventDeadLetterQueue",
  {
    name: "notification-event-dead-letter",
  }
);

export const notificationEventRealtime = Cloudflare.DurableObjectNamespace(
  "NotificationEventRealtimeDurableObject"
);

export const server = Cloudflare.Worker("Server", {
  main: fromPackageRoot("../../apps/server/src/index.ts"),
  name: "ecommerce-server",
  compatibility,
  dev: {
    port: 3000,
    strictPort: true,
  },
  env: {
    ...requiredServerConfig,
    CART_CACHE: cartCache,
    DB: database,
    NOTIFICATION_EVENT_DEAD_LETTER_QUEUE: notificationEventDeadLetterQueue,
    NOTIFICATION_EVENT_QUEUE: notificationEventQueue,
    NOTIFICATION_EVENT_REALTIME: notificationEventRealtime,
    STATEFUL_COORDINATOR: statefulCoordinator,
  },
  url: true,
});

export const notificationEventQueueConsumer = notificationEventQueue.pipe(
  Effect.flatMap((queue) =>
    Cloudflare.QueueConsumer("NotificationEventQueueConsumer", {
      deadLetterQueue: "notification-event-dead-letter",
      queueId: queue.queueId,
      scriptName: "ecommerce-server",
      settings: {
        batchSize: 10,
        maxRetries: 3,
        maxWaitTimeMs: 5000,
        retryDelay: 30,
      },
    })
  )
);

export const web = Cloudflare.Vite("Web", {
  rootDir: fromPackageRoot("../../apps/web"),
  compatibility,
  dev: {
    port: 3001,
    strictPort: true,
  },
  env: {
    VITE_SERVER_URL: server.pipe(
      Effect.map(({ url }) => url ?? localServerUrl)
    ),
  },
});

export default Alchemy.Stack(
  "ecommerce",
  {
    providers,
    state: Cloudflare.state(),
  },
  Effect.gen(function* deployStack() {
    const db = yield* database;
    const api = yield* server;
    const admin = yield* web;

    return {
      adminUrl: admin.url,
      apiUrl: api.url,
      databaseId: db.databaseId,
      databaseName: db.databaseName,
      notificationEventQueueConsumerId:
        yield* notificationEventQueueConsumer.pipe(
          Effect.map((consumer) => consumer.consumerId)
        ),
    };
  })
);

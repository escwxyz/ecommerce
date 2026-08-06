import { fileURLToPath, URL } from "node:url";

import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { config } from "dotenv";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";

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
const defaultLocalPostgresHost = "127.0.0.1";
const defaultLocalPostgresPort = 5432;
const defaultLocalPostgresDatabase = "ecommerce";
const defaultLocalPostgresUser = "postgres";
const defaultLocalPostgresPassword = "postgres";

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

type EnvironmentSource = Record<string, string | undefined>;
type PostgresOriginConfig = Cloudflare.Hyperdrive.PublicOrigin;

export interface PostgresHyperdriveConfig {
  readonly origin: PostgresOriginConfig;
  readonly dev: Cloudflare.Hyperdrive.DevOrigin;
  readonly originConnectionLimit?: number;
}

const getRequiredEnvValue = (source: EnvironmentSource, name: string) => {
  const value = source[name];

  if (!value) {
    throw new Error(
      `${name} is required to provision the Cloudflare Hyperdrive PostgreSQL connection.`
    );
  }

  return value;
};

const getOptionalNumberEnvValue = (
  source: EnvironmentSource,
  name: string
): number | undefined => {
  const value = source[name];

  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
};

const getDevPostgresOrigin = (
  source: EnvironmentSource
): Cloudflare.Hyperdrive.DevOrigin => ({
  scheme: "postgres",
  host:
    source.POSTGRES_DEV_HOST ??
    source.POSTGRES_HOST ??
    defaultLocalPostgresHost,
  port:
    getOptionalNumberEnvValue(source, "POSTGRES_DEV_PORT") ??
    getOptionalNumberEnvValue(source, "POSTGRES_PORT") ??
    defaultLocalPostgresPort,
  database:
    source.POSTGRES_DEV_DATABASE ??
    source.POSTGRES_DATABASE ??
    defaultLocalPostgresDatabase,
  user:
    source.POSTGRES_DEV_USER ??
    source.POSTGRES_USER ??
    defaultLocalPostgresUser,
  password: Redacted.make(
    source.POSTGRES_DEV_PASSWORD ??
      source.POSTGRES_PASSWORD ??
      defaultLocalPostgresPassword
  ),
  sslmode:
    (source.POSTGRES_DEV_SSLMODE as Cloudflare.Hyperdrive.DevOrigin["sslmode"]) ??
    "disable",
});

export const getPostgresHyperdriveConfig = (
  dev: boolean,
  source: EnvironmentSource = process.env
): PostgresHyperdriveConfig => {
  const devOrigin = getDevPostgresOrigin(source);
  const origin = dev
    ? devOrigin
    : {
        scheme: "postgres" as const,
        host: getRequiredEnvValue(source, "POSTGRES_HOST"),
        port: getOptionalNumberEnvValue(source, "POSTGRES_PORT"),
        database: getRequiredEnvValue(source, "POSTGRES_DATABASE"),
        user: getRequiredEnvValue(source, "POSTGRES_USER"),
        password: Redacted.make(
          getRequiredEnvValue(source, "POSTGRES_PASSWORD")
        ),
      };
  const originConnectionLimit = getOptionalNumberEnvValue(
    source,
    "POSTGRES_ORIGIN_CONNECTION_LIMIT"
  );

  return {
    dev: devOrigin,
    origin,
    ...(originConnectionLimit ? { originConnectionLimit } : {}),
  };
};

export const database = Cloudflare.D1.Database("Database", {
  migrationsDir: fromPackageRoot("../../packages/auth/src/migrations/sql"),
  migrationsTable: "d1_migrations",
});

export const postgresConnection = Effect.gen(
  function* createPostgresConnection() {
    const { dev } = yield* Alchemy.AlchemyContext;
    const postgresConfig = getPostgresHyperdriveConfig(dev);

    return yield* Cloudflare.Hyperdrive.Connection("PostgresConnection", {
      caching: {
        disabled: true,
      },
      ...postgresConfig,
    });
  }
);

export const statefulCoordinator = Cloudflare.DurableObject(
  "KeyedActorDurableObject"
);

export const cartCache = Cloudflare.DurableObject("CartCacheDurableObject");

export const notificationEventQueue = Cloudflare.Queues.Queue(
  "NotificationEventQueue",
  {
    name: "notification-event-work",
  }
);

export const notificationEventDeadLetterQueue = Cloudflare.Queues.Queue(
  "NotificationEventDeadLetterQueue",
  {
    name: "notification-event-dead-letter",
  }
);

export const notificationEventRealtime = Cloudflare.DurableObject(
  "NotificationEventRealtimeDurableObject"
);

export const notificationEventOutboxDrainCrons = ["* * * * *"] as const;

type NotificationEventQueueEnv = Record<
  string,
  typeof notificationEventDeadLetterQueue | typeof notificationEventQueue
>;

export const getNotificationEventQueueEnv = (
  dev: boolean
): NotificationEventQueueEnv => {
  if (dev) {
    return {};
  }

  return {
    NOTIFICATION_EVENT_DEAD_LETTER_QUEUE: notificationEventDeadLetterQueue,
    NOTIFICATION_EVENT_QUEUE: notificationEventQueue,
  };
};

export const server = Effect.gen(function* createServer() {
  const { dev } = yield* Alchemy.AlchemyContext;

  return yield* Cloudflare.Worker("Server", {
    main: fromPackageRoot("../../apps/server/src/index.ts"),
    name: "ecommerce-server",
    compatibility,
    crons: dev ? [] : [...notificationEventOutboxDrainCrons],
    dev: {
      port: 3000,
      strictPort: true,
    },
    env: {
      ...requiredServerConfig,
      ...getNotificationEventQueueEnv(dev),
      CART_CACHE: cartCache,
      COMMERCE_RUNTIME_MODE: dev ? "development" : "production",
      DB: database,
      NOTIFICATION_EVENT_REALTIME: notificationEventRealtime,
      POSTGRES: postgresConnection,
      STATEFUL_COORDINATOR: statefulCoordinator,
    },
    url: true,
  });
});

export const notificationEventQueueConsumer = Effect.gen(
  function* createNotificationEventQueueConsumer() {
    const { dev } = yield* Alchemy.AlchemyContext;

    if (dev) {
      return;
    }

    const queue = yield* notificationEventQueue;
    return yield* Cloudflare.Queues.Consumer("NotificationEventQueueConsumer", {
      deadLetterQueue: "notification-event-dead-letter",
      queueId: queue.queueId,
      scriptName: "ecommerce-server",
      settings: {
        batchSize: 10,
        maxRetries: 3,
        maxWaitTimeMs: 5000,
        retryDelay: 30,
      },
    });
  }
);

export const getLocalWebOutput = (
  dev: boolean
): { readonly url: string } | null => (dev ? { url: localWebUrl } : null);

export const web = Effect.gen(function* createWeb() {
  const { dev } = yield* Alchemy.AlchemyContext;
  const localOutput = getLocalWebOutput(dev);

  if (localOutput) {
    return localOutput;
  }

  return yield* Cloudflare.Website.Vite("Web", {
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
});

export default Alchemy.Stack(
  "ecommerce",
  {
    providers,
    state: Cloudflare.state(),
  },
  Effect.gen(function* deployStack() {
    const db = yield* database;
    const postgres = yield* postgresConnection;
    const api = yield* server;
    const admin = yield* web;

    return {
      adminUrl: admin.url,
      apiUrl: api.url,
      databaseId: db.databaseId,
      databaseName: db.databaseName,
      postgresHyperdriveId: postgres.hyperdriveId,
      postgresHyperdriveName: postgres.name,
      notificationEventQueueConsumerId:
        yield* notificationEventQueueConsumer.pipe(
          Effect.map((consumer) => consumer?.consumerId ?? null)
        ),
    };
  })
);

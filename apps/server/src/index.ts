import { createContext } from "@ecommerce/api/context";
import { createAuth } from "@ecommerce/auth";
import { createInMemoryCartRepository } from "@ecommerce/cart";
import { createD1Database } from "@ecommerce/db-d1";
import { env } from "@ecommerce/env/server";
import {
  createCloudflareCartCacheRepository,
  createCloudflareQueuedNotificationProvider,
  createNotificationEventQueuePublisher,
  createNotificationEventRealtimePublisher,
  processNotificationEventQueueBatch,
} from "@ecommerce/platform-cloudflare";
import type { NotificationEventQueueMessage } from "@ecommerce/platform-cloudflare";
import { CartCacheDurableObject } from "@ecommerce/platform-cloudflare/cart-cache-do";
import { NotificationEventRealtimeDurableObject } from "@ecommerce/platform-cloudflare/notification-event-realtime-do";
import { KeyedActorDurableObject } from "@ecommerce/platform-cloudflare/stateful-do";

import { createServerApp } from "./app";
import {
  createDevelopmentCommerceProviderRegistries,
  createServerCommerceRuntime,
} from "./commerce-runtime";
import {
  isPostgresHyperdriveHealthRequest,
  verifyPostgresHyperdriveConnection,
} from "./postgres-hyperdrive-smoke";

interface CommerceServerEnv {
  readonly BETTER_AUTH_SECRET: string;
  readonly BETTER_AUTH_URL: string;
  readonly CART_CACHE: DurableObjectNamespace;
  readonly COMMERCE_PROVIDER_MODE: "development" | "disabled";
  readonly CORS_ORIGIN: string;
  readonly DB: D1Database;
  readonly NOTIFICATION_EVENT_QUEUE?: Queue<NotificationEventQueueMessage>;
  readonly NOTIFICATION_EVENT_REALTIME: DurableObjectNamespace;
  readonly POSTGRES: Hyperdrive;
  readonly STATEFUL_COORDINATOR: DurableObjectNamespace;
}

const serverEnv = env as unknown as CommerceServerEnv;

export {
  CartCacheDurableObject,
  NotificationEventRealtimeDurableObject,
  KeyedActorDurableObject,
};

const database = createD1Database(serverEnv.DB);
const clock = {
  now: () => new Date(),
};
const cartProjectionRepository = createInMemoryCartRepository();
const notificationEventRealtime = createNotificationEventRealtimePublisher({
  namespace: serverEnv.NOTIFICATION_EVENT_REALTIME as unknown as Parameters<
    typeof createNotificationEventRealtimePublisher
  >[0]["namespace"],
});
const notificationEventQueue = serverEnv.NOTIFICATION_EVENT_QUEUE;
const notificationEventQueuePublisher = notificationEventQueue
  ? createNotificationEventQueuePublisher({
      clock,
      queue: notificationEventQueue,
      realtime: notificationEventRealtime,
    })
  : undefined;
const queuedNotificationProviders = notificationEventQueue
  ? ["email", "sms", "webhook", "in-app"].map((providerKey) =>
      createCloudflareQueuedNotificationProvider({
        clock,
        providerKey,
        queue: notificationEventQueue,
        realtime: notificationEventRealtime,
      })
    )
  : [];

const developmentProviderRegistries =
  serverEnv.COMMERCE_PROVIDER_MODE === "development"
    ? createDevelopmentCommerceProviderRegistries()
    : {};
const runtime = createServerCommerceRuntime({
  ...developmentProviderRegistries,
  clock,
  cartRepository: createCloudflareCartCacheRepository({
    namespace: serverEnv.CART_CACHE,
    projectionRepository: cartProjectionRepository,
  }),
  db: database.db,
  notificationProviders: queuedNotificationProviders,
  notificationRuntime: notificationEventQueuePublisher,
});
const { apiAssembly } = runtime;

const auth = createAuth({
  baseURL: serverEnv.BETTER_AUTH_URL,
  database: database.authDatabase,
  permissionStatement: apiAssembly.permissions.statement,
  secret: serverEnv.BETTER_AUTH_SECRET,
  trustedOrigins: [serverEnv.CORS_ORIGIN],
});

const app = createServerApp({
  apiAssembly,
  auth,
  corsOrigin: serverEnv.CORS_ORIGIN,
  createContext,
  notificationEventRealtime: {
    namespace: serverEnv.NOTIFICATION_EVENT_REALTIME,
  },
});

export default {
  fetch: (
    request: Request,
    requestEnv: CommerceServerEnv,
    executionContext: ExecutionContext
  ) => {
    if (isPostgresHyperdriveHealthRequest(request)) {
      return verifyPostgresHyperdriveConnection(
        requestEnv.POSTGRES ?? serverEnv.POSTGRES
      );
    }

    return app.fetch(request, requestEnv, executionContext);
  },
  queue: (batch: MessageBatch<NotificationEventQueueMessage>) =>
    processNotificationEventQueueBatch(batch, {
      clock,
      notificationProviders: [],
      repository: runtime.repositories.notificationEvent,
      retryPolicy: {
        backoffSeconds: [30, 120, 300],
        maxAttempts: 3,
      },
      realtime: notificationEventRealtime,
    }),
};

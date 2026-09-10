import { createAuth } from "@ecommerce/auth";
import type { CommerceQueueMessage } from "@ecommerce/core";
import { env } from "@ecommerce/env/server";
import type { NotificationEventQueueMessage } from "@ecommerce/platform-cloudflare";
import { CartCacheDurableObject } from "@ecommerce/platform-cloudflare/cart-cache-do";
import { NotificationEventRealtimeDurableObject } from "@ecommerce/platform-cloudflare/notification-event-realtime-do";
import { KeyedActorDurableObject } from "@ecommerce/platform-cloudflare/stateful-do";

import { createEffectHttpWorkerRuntime } from "./effect-http-worker-runtime";
import {
  isPostgresHyperdriveHealthRequest,
  verifyPostgresHyperdriveConnection,
} from "./postgres-hyperdrive-smoke";
import { createProductionCommerceRuntimeComposition } from "./production-commerce-runtime";
import { routeCommerceServerQueueBatch } from "./queue-routing";
import type { CommerceServerQueueMessage } from "./queue-routing";

interface CommerceServerEnv {
  readonly BETTER_AUTH_SECRET: string;
  readonly BETTER_AUTH_URL: string;
  readonly CART_CACHE: DurableObjectNamespace;
  readonly COMMERCE_EVENT_DEAD_LETTER_QUEUE?: Queue<CommerceQueueMessage>;
  readonly COMMERCE_EVENT_QUEUE?: Queue<CommerceQueueMessage>;
  readonly COMMERCE_RUNTIME_MODE: "development" | "production";
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

const composition = createProductionCommerceRuntimeComposition({
  bindings: {
    cartCache: serverEnv.CART_CACHE,
    commerceEventQueue: serverEnv.COMMERCE_EVENT_QUEUE,
    notificationEventQueue: serverEnv.NOTIFICATION_EVENT_QUEUE,
    notificationEventRealtime: serverEnv.NOTIFICATION_EVENT_REALTIME,
    postgres: serverEnv.POSTGRES,
    statefulCoordinator: serverEnv.STATEFUL_COORDINATOR,
  },
  mode: serverEnv.COMMERCE_RUNTIME_MODE,
});

const auth = createAuth({
  baseURL: serverEnv.BETTER_AUTH_URL,
  database: serverEnv.DB,
  permissionStatement: composition.permissions.statement,
  secret: serverEnv.BETTER_AUTH_SECRET,
  trustedOrigins: [serverEnv.CORS_ORIGIN],
});

const effectHttpRuntime = createEffectHttpWorkerRuntime({
  auth,
  contributions: composition.apiGroups,
  corsOrigin: serverEnv.CORS_ORIGIN,
  onDispose: composition.dispose,
  runtimeLayers: [composition.applicationLayer],
});

export default {
  fetch: (
    request: Request,
    requestEnv: CommerceServerEnv,
    _executionContext: ExecutionContext
  ) => {
    if (isPostgresHyperdriveHealthRequest(request)) {
      return verifyPostgresHyperdriveConnection(
        requestEnv.POSTGRES ?? serverEnv.POSTGRES
      );
    }

    if (new URL(request.url).pathname.startsWith("/api/auth/")) {
      return auth.handler(request);
    }

    return effectHttpRuntime.fetch(request);
  },
  scheduled: async () => {
    await Promise.all([
      composition.drainCommerceEventOutbox(),
      composition.drainNotificationEventOutbox(),
    ]);
  },
  queue: (batch: MessageBatch<CommerceServerQueueMessage>) =>
    routeCommerceServerQueueBatch(batch, composition),
};

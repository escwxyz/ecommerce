import {
  builtinPermissionStatement,
  cartEffectHttpApiContribution,
  customerEffectHttpApiContribution,
  inventoryEffectHttpApiContribution,
  orderEffectHttpApiContribution,
  pricingEffectHttpApiContribution,
  productEffectHttpApiContribution,
  promotionEffectHttpApiContribution,
  regionSalesChannelEffectHttpApiContribution,
  storeEffectHttpApiContribution,
  taxEffectHttpApiContribution,
} from "@ecommerce/api";
import { createAuth } from "@ecommerce/auth";
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

interface CommerceServerEnv {
  readonly BETTER_AUTH_SECRET: string;
  readonly BETTER_AUTH_URL: string;
  readonly CART_CACHE: DurableObjectNamespace;
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
  permissionStatement: builtinPermissionStatement,
  secret: serverEnv.BETTER_AUTH_SECRET,
  trustedOrigins: [serverEnv.CORS_ORIGIN],
});

const effectHttpRuntime = createEffectHttpWorkerRuntime({
  auth,
  contributions: [
    ...storeEffectHttpApiContribution.groups,
    ...customerEffectHttpApiContribution.groups,
    ...productEffectHttpApiContribution.groups,
    ...pricingEffectHttpApiContribution.groups,
    ...inventoryEffectHttpApiContribution.groups,
    ...cartEffectHttpApiContribution.groups,
    ...regionSalesChannelEffectHttpApiContribution.groups,
    ...promotionEffectHttpApiContribution.groups,
    ...taxEffectHttpApiContribution.groups,
    ...orderEffectHttpApiContribution.groups,
  ],
  corsOrigin: serverEnv.CORS_ORIGIN,
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
  scheduled: () => composition.drainNotificationEventOutbox(),
  queue: (batch: MessageBatch<NotificationEventQueueMessage>) =>
    composition.processNotificationEventQueue(batch),
};

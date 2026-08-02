import {
  cartEffectHttpApiContribution,
  checkoutEffectHttpApiContribution,
  customerEffectHttpApiContribution,
  fulfillmentEffectHttpApiContribution,
  inventoryEffectHttpApiContribution,
  notificationEventEffectHttpApiContribution,
  orderEffectHttpApiContribution,
  paymentEffectHttpApiContribution,
  pricingEffectHttpApiContribution,
  productEffectHttpApiContribution,
  promotionEffectHttpApiContribution,
  regionSalesChannelEffectHttpApiContribution,
  storeEffectHttpApiContribution,
  taxEffectHttpApiContribution,
  builtinPermissionStatement,
} from "@ecommerce/api";
import { createAuth } from "@ecommerce/auth";
import {
  createCartServiceLayer,
  createInMemoryCartRepository,
} from "@ecommerce/cart";
import { createCheckoutServiceLayer } from "@ecommerce/checkout";
import {
  createCustomerServiceLayer,
  defaultCustomerService,
} from "@ecommerce/customer";
import { createD1Database } from "@ecommerce/db-d1";
import { env } from "@ecommerce/env/server";
import {
  createFulfillmentServiceLayer,
  defaultFulfillmentService,
} from "@ecommerce/fulfillment";
import {
  createInventoryServiceLayer,
  defaultInventoryService,
} from "@ecommerce/inventory";
import {
  createNotificationEventServiceLayer,
  defaultNotificationEventService,
} from "@ecommerce/notification-event";
import { createOrderServiceLayer, defaultOrderService } from "@ecommerce/order";
import { createPaymentServiceLayer } from "@ecommerce/payment";
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
import {
  createPricingServiceLayer,
  defaultPricingService,
} from "@ecommerce/pricing";
import {
  createProductServiceLayer,
  defaultProductService,
} from "@ecommerce/product";
import {
  createPromotionServiceLayer,
  defaultPromotionService,
} from "@ecommerce/promotion";
import {
  createRegionServiceLayer,
  createSalesChannelServiceLayer,
  defaultRegionService,
  defaultSalesChannelService,
} from "@ecommerce/region-sales-channel";
import { createStoreServiceLayer, defaultStoreService } from "@ecommerce/store";
import { createTaxServiceLayer, defaultTaxService } from "@ecommerce/tax";

import {
  createDevelopmentCommerceProviderRegistries,
  createServerCommerceRuntime,
} from "./commerce-runtime";
import { createEffectHttpWorkerRuntime } from "./effect-http-worker-runtime";
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
const checkoutContribution =
  "checkout" in runtime.services && runtime.services.checkout
    ? checkoutEffectHttpApiContribution.groups
    : [];

const auth = createAuth({
  baseURL: serverEnv.BETTER_AUTH_URL,
  database: database.authDatabase,
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
    ...fulfillmentEffectHttpApiContribution.groups,
    ...paymentEffectHttpApiContribution.groups,
    ...checkoutContribution,
    ...orderEffectHttpApiContribution.groups,
    ...notificationEventEffectHttpApiContribution.groups,
  ],
  runtimeLayers: [
    createStoreServiceLayer(defaultStoreService),
    createCustomerServiceLayer(defaultCustomerService),
    createProductServiceLayer(defaultProductService),
    createPricingServiceLayer(defaultPricingService),
    createInventoryServiceLayer(defaultInventoryService),
    createCartServiceLayer(runtime.services.cart),
    createRegionServiceLayer(defaultRegionService),
    createSalesChannelServiceLayer(defaultSalesChannelService),
    createPromotionServiceLayer(defaultPromotionService),
    createTaxServiceLayer(defaultTaxService),
    createFulfillmentServiceLayer(defaultFulfillmentService),
    createPaymentServiceLayer({}),
    ...(runtime.services.checkout
      ? [createCheckoutServiceLayer(runtime.services.checkout)]
      : []),
    createOrderServiceLayer(defaultOrderService),
    createNotificationEventServiceLayer(defaultNotificationEventService),
  ],
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

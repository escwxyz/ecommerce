import {
  cartEffectHttpApiContribution,
  fulfillmentEffectHttpApiContribution,
  notificationEventEffectHttpApiContribution,
  orderEffectHttpApiContribution,
  paymentEffectHttpApiContribution,
  promotionEffectHttpApiContribution,
  taxEffectHttpApiContribution,
} from "@ecommerce/api";
import { createCartServiceLayer, defaultCartService } from "@ecommerce/cart";
import {
  createFulfillmentServiceLayer,
  defaultFulfillmentService,
} from "@ecommerce/fulfillment";
import {
  createNotificationEventServiceLayer,
  defaultNotificationEventService,
} from "@ecommerce/notification-event";
import { createOrderServiceLayer, defaultOrderService } from "@ecommerce/order";
import { createPaymentServiceLayer } from "@ecommerce/payment";
import {
  createPromotionServiceLayer,
  defaultPromotionService,
} from "@ecommerce/promotion";
import { createTaxServiceLayer, defaultTaxService } from "@ecommerce/tax";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";

import { createEffectHttpWorkerHttpEffect } from "./effect-http-worker-runtime";

/**
 * Native Alchemy v2 entrypoint for the canonical Effect HTTP application.
 * Module and plugin contributions are added here as their vertical migrations
 * complete. Cart, fulfillment, notification-event, order, payment, promotion,
 * and tax start with in-memory Layers until Cloudflare runtime composition can
 * provide PostgreSQL/cache-backed Layers explicitly.
 */
const effectHttpWorker = Cloudflare.Worker(
  "CommerceEffectHttpWorker",
  { main: import.meta.url },
  Effect.succeed({
    fetch: createEffectHttpWorkerHttpEffect({
      contributions: [
        ...cartEffectHttpApiContribution.groups,
        ...fulfillmentEffectHttpApiContribution.groups,
        ...notificationEventEffectHttpApiContribution.groups,
        ...orderEffectHttpApiContribution.groups,
        ...paymentEffectHttpApiContribution.groups,
        ...promotionEffectHttpApiContribution.groups,
        ...taxEffectHttpApiContribution.groups,
      ],
      runtimeLayers: [
        createCartServiceLayer(defaultCartService),
        createFulfillmentServiceLayer(defaultFulfillmentService),
        createNotificationEventServiceLayer(defaultNotificationEventService),
        createOrderServiceLayer(defaultOrderService),
        createPaymentServiceLayer({}),
        createPromotionServiceLayer(defaultPromotionService),
        createTaxServiceLayer(defaultTaxService),
      ],
    }),
  })
);

export default effectHttpWorker;

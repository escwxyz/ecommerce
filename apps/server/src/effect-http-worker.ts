import {
  cartEffectHttpApiContribution,
  fulfillmentEffectHttpApiContribution,
  paymentEffectHttpApiContribution,
  promotionEffectHttpApiContribution,
  taxEffectHttpApiContribution,
} from "@ecommerce/api";
import { createCartServiceLayer, defaultCartService } from "@ecommerce/cart";
import {
  createFulfillmentServiceLayer,
  defaultFulfillmentService,
} from "@ecommerce/fulfillment";
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
 * complete. Cart, fulfillment, payment, promotion, and tax start with in-memory Layers until
 * Cloudflare runtime composition can provide PostgreSQL/cache-backed Layers
 * explicitly.
 */
const effectHttpWorker = Cloudflare.Worker(
  "CommerceEffectHttpWorker",
  { main: import.meta.url },
  Effect.succeed({
    fetch: createEffectHttpWorkerHttpEffect({
      contributions: [
        ...cartEffectHttpApiContribution.groups,
        ...fulfillmentEffectHttpApiContribution.groups,
        ...paymentEffectHttpApiContribution.groups,
        ...promotionEffectHttpApiContribution.groups,
        ...taxEffectHttpApiContribution.groups,
      ],
      runtimeLayers: [
        createCartServiceLayer(defaultCartService),
        createFulfillmentServiceLayer(defaultFulfillmentService),
        createPaymentServiceLayer({}),
        createPromotionServiceLayer(defaultPromotionService),
        createTaxServiceLayer(defaultTaxService),
      ],
    }),
  })
);

export default effectHttpWorker;

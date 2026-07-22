import {
  cartEffectHttpApiContribution,
  promotionEffectHttpApiContribution,
  taxEffectHttpApiContribution,
} from "@ecommerce/api";
import { createCartServiceLayer, defaultCartService } from "@ecommerce/cart";
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
 * complete. Cart, promotion, and tax start with in-memory Layers until
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
        ...promotionEffectHttpApiContribution.groups,
        ...taxEffectHttpApiContribution.groups,
      ],
      runtimeLayers: [
        createCartServiceLayer(defaultCartService),
        createPromotionServiceLayer(defaultPromotionService),
        createTaxServiceLayer(defaultTaxService),
      ],
    }),
  })
);

export default effectHttpWorker;

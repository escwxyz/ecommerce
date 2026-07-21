import {
  cartEffectHttpApiContribution,
  promotionEffectHttpApiContribution,
} from "@ecommerce/api";
import { createCartServiceLayer, defaultCartService } from "@ecommerce/cart";
import {
  createPromotionServiceLayer,
  defaultPromotionService,
} from "@ecommerce/promotion";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";

import { createEffectHttpWorkerHttpEffect } from "./effect-http-worker-runtime";

/**
 * Native Alchemy v2 entrypoint for the canonical Effect HTTP application.
 * Module and plugin contributions are added here as their vertical migrations
 * complete. Cart and promotion start with in-memory Layers until Cloudflare
 * runtime composition can provide PostgreSQL/cache-backed Layers explicitly.
 */
const effectHttpWorker = Cloudflare.Worker(
  "CommerceEffectHttpWorker",
  { main: import.meta.url },
  Effect.succeed({
    fetch: createEffectHttpWorkerHttpEffect({
      contributions: [
        ...cartEffectHttpApiContribution.groups,
        ...promotionEffectHttpApiContribution.groups,
      ],
      runtimeLayers: [
        createCartServiceLayer(defaultCartService),
        createPromotionServiceLayer(defaultPromotionService),
      ],
    }),
  })
);

export default effectHttpWorker;

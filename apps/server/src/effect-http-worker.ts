import { cartEffectHttpApiContribution } from "@ecommerce/api";
import { createCartServiceLayer, defaultCartService } from "@ecommerce/cart";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";

import { createEffectHttpWorkerHttpEffect } from "./effect-http-worker-runtime";

/**
 * Native Alchemy v2 entrypoint for the canonical Effect HTTP application.
 * Module and plugin contributions are added here as their vertical migrations
 * complete. Cart starts with the in-memory Layer until Cloudflare runtime
 * composition can provide the PostgreSQL/cache-backed Layer explicitly.
 */
const effectHttpWorker = Cloudflare.Worker(
  "CommerceEffectHttpWorker",
  { main: import.meta.url },
  Effect.succeed({
    fetch: createEffectHttpWorkerHttpEffect({
      contributions: cartEffectHttpApiContribution.groups,
      runtimeLayers: [createCartServiceLayer(defaultCartService)],
    }),
  })
);

export default effectHttpWorker;

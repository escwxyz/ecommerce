import { Effect } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/unstable/http";

export interface EffectWorkerCanary {
  readonly dispose: () => Promise<void>;
  readonly fetch: (request: Request) => Promise<Response>;
}

/** Creates the minimal Fetch-compatible Effect Worker canary. */
export const createEffectWorkerCanary = (): EffectWorkerCanary => {
  const routes = HttpRouter.add(
    "GET",
    "/health",
    Effect.succeed(HttpServerResponse.jsonUnsafe({ status: "ok" }))
  );
  const worker = HttpRouter.toWebHandler(routes, { disableLogger: true });

  return {
    dispose: worker.dispose,
    fetch: worker.handler,
  };
};

import { describe, expect, it } from "bun:test";

import {
  Config,
  ConfigProvider,
  Context,
  Effect,
  Layer,
  Logger,
  Metric,
} from "effect";

class RuntimeCanary extends Context.Service<
  RuntimeCanary,
  { readonly describe: Effect.Effect<string> }
>()("@ecommerce/core/RuntimeCanary") {}

describe("Effect 4 runtime canary", () => {
  it("composes config, scoped Layers, logs, spans, and metrics", async () => {
    const lifecycle: Array<string> = [];
    const logs: Array<unknown> = [];
    const requests = Metric.counter("effect_4_canary_requests");
    const logger = Logger.make(({ message }) => {
      logs.push(message);
    });
    const configLayer = ConfigProvider.layer(
      ConfigProvider.fromUnknown({ "service.name": "commerce" })
    );
    const runtimeLayer = Layer.effect(
      RuntimeCanary,
      Effect.acquireRelease(
        Effect.gen(function* () {
          const name = yield* Config.string("service.name");
          lifecycle.push(`acquire:${name}`);
          return RuntimeCanary.of({
            describe: Effect.succeed(`service:${name}`),
          });
        }),
        () =>
          Effect.sync(() => {
            lifecycle.push("release");
          })
      )
    ).pipe(Layer.provide(configLayer));
    const program = Effect.gen(function* () {
      const description = yield* RuntimeCanary.use(
        (service) => service.describe
      );
      yield* Effect.logInfo("runtime-canary-ready");
      yield* Metric.update(requests, 1);
      return description;
    }).pipe(
      Effect.withSpan("effect-4-runtime-canary"),
      Effect.withLogger(logger),
      Effect.provide(runtimeLayer),
      Effect.scoped
    );

    const description = await Effect.runPromise(program);
    const count = await Effect.runPromise(Metric.value(requests));

    expect(description).toBe("service:commerce");
    expect(lifecycle).toEqual(["acquire:commerce", "release"]);
    expect(logs).toContainEqual(["runtime-canary-ready"]);
    expect(count.count).toBe(1);
  });
});

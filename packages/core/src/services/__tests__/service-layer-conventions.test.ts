import { describe, expect, it } from "bun:test";

import { Context, Effect, Layer } from "effect";

class StoreRepository extends Context.Service<
  StoreRepository,
  {
    readonly findName: (
      storeId: string
    ) => Effect.Effect<string, StoreRepositoryUnavailable>;
  }
>()("@ecommerce/core/test/StoreRepository") {}

class StoreRepositoryUnavailable {
  readonly _tag = "StoreRepositoryUnavailable";
}

class StoreModule extends Context.Service<
  StoreModule,
  {
    readonly describe: (
      storeId: string
    ) => Effect.Effect<string, StoreRepositoryUnavailable>;
  }
>()("@ecommerce/core/test/StoreModule") {}

class RequestContext extends Context.Service<
  RequestContext,
  { readonly requestId: string }
>()("@ecommerce/core/test/RequestContext") {}

class TransactionContext extends Context.Service<
  TransactionContext,
  { readonly transactionId: string }
>()("@ecommerce/core/test/TransactionContext") {}

const StoreModuleLayer = Layer.effect(
  StoreModule,
  Effect.gen(function* () {
    const repository = yield* StoreRepository;

    return StoreModule.of({
      describe: Effect.fn("StoreModule.describe")(function* (storeId: string) {
        const name = yield* repository.findName(storeId);
        return `${storeId}:${name}`;
      }),
    });
  })
);

const describeStore = (storeId: string) =>
  StoreModule.use((service) => service.describe(storeId));

describe("Effect service and Layer conventions", () => {
  it("keeps module services dependent on repository contracts", async () => {
    const repositoryLayer = Layer.succeed(
      StoreRepository,
      StoreRepository.of({
        findName: (storeId) => Effect.succeed(`name-for-${storeId}`),
      })
    );
    const moduleLayer = StoreModuleLayer.pipe(Layer.provide(repositoryLayer));

    const result = await Effect.runPromise(
      describeStore("store_1").pipe(Effect.provide(moduleLayer))
    );

    expect(result).toBe("store_1:name-for-store_1");
  });

  it("replaces adapters through Layers without changing business logic", async () => {
    const makeModuleLayer = (name: string) =>
      StoreModuleLayer.pipe(
        Layer.provide(
          Layer.succeed(
            StoreRepository,
            StoreRepository.of({
              findName: () => Effect.succeed(name),
            })
          )
        )
      );

    const productionResult = await Effect.runPromise(
      describeStore("store_1").pipe(Effect.provide(makeModuleLayer("postgres")))
    );
    const testResult = await Effect.runPromise(
      describeStore("store_1").pipe(
        Effect.provide(makeModuleLayer("in-memory"))
      )
    );

    expect(productionResult).toBe("store_1:postgres");
    expect(testResult).toBe("store_1:in-memory");
  });

  it("provides request context per execution without global mutation", async () => {
    const readRequestId = RequestContext.useSync(
      (context) => context.requestId
    );
    const runRequest = (requestId: string) =>
      Effect.runPromise(
        readRequestId.pipe(
          Effect.provide(
            Layer.succeed(RequestContext, RequestContext.of({ requestId }))
          )
        )
      );

    const results = await Promise.all([
      runRequest("request_a"),
      runRequest("request_b"),
    ]);

    expect(results).toEqual(["request_a", "request_b"]);
  });

  it("scopes transaction acquisition and release around its consumers", async () => {
    const lifecycle: Array<string> = [];
    const transactionLayer = Layer.effect(
      TransactionContext,
      Effect.acquireRelease(
        Effect.sync(() => {
          lifecycle.push("acquire:transaction_1");
          return TransactionContext.of({ transactionId: "transaction_1" });
        }),
        (transaction) =>
          Effect.sync(() => {
            lifecycle.push(`release:${transaction.transactionId}`);
          })
      )
    );
    const program = TransactionContext.useSync((transaction) => {
      lifecycle.push(`use:${transaction.transactionId}`);
      return transaction.transactionId;
    }).pipe(Effect.provide(transactionLayer), Effect.scoped);

    const transactionId = await Effect.runPromise(program);

    expect(transactionId).toBe("transaction_1");
    expect(lifecycle).toEqual([
      "acquire:transaction_1",
      "use:transaction_1",
      "release:transaction_1",
    ]);
  });
});

import { describe, expect, it } from "bun:test";

import {
  clockLayer,
  idGeneratorLayer,
  outboxWriterLayer,
  transactionBoundaryLayer,
} from "@ecommerce/core";
import {
  createInMemoryOutbox,
  createInMemoryTransactionBoundary,
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";
import { Effect, Layer } from "effect";

import { StoreRepositoryService } from "../domain";
import {
  createResettableInMemoryStoreRepository,
  storeRepositoryTransactionResource,
} from "../repositories";
import {
  STORE_SETTINGS_UPDATED_EVENT,
  StoreService,
  createStoreService,
  createStoreServiceFromDependenciesLayer,
} from "../services";

describe("store Effect service and Layer boundary", () => {
  it("commits updated settings and outbox intent through one public mutation", async () => {
    const repository = createResettableInMemoryStoreRepository();
    const outbox = createInMemoryOutbox({
      now: new Date("2026-01-01T00:00:00.000Z"),
      recordIds: ["outbox_layer"],
    });
    const transactionBoundary = createInMemoryTransactionBoundary({
      resources: [storeRepositoryTransactionResource(repository), outbox],
      transactionIds: ["transaction_layer"],
    });
    const dependencies = Layer.mergeAll(
      clockLayer(createStaticClock(new Date("2026-01-01T00:00:00.000Z"))),
      idGeneratorLayer(createSequenceIdGenerator(["store_layer", "evt_layer"])),
      outboxWriterLayer(outbox.writer),
      transactionBoundaryLayer(transactionBoundary),
      // Exercise the same repository instance through the public service and
      // the transaction rollback resource.
      Layer.succeed(StoreRepositoryService, repository)
    );
    const serviceLayer = createStoreServiceFromDependenciesLayer().pipe(
      Layer.provide(dependencies)
    );
    const program = StoreService.use((service) =>
      Effect.gen(function* () {
        const defaults = yield* service.getStoreDefaults;
        const updated = yield* service.updateStoreSettings({
          defaultCurrencyCode: "EUR",
          supportedCurrencyCodes: ["USD", "EUR"],
        });

        return { defaults, updated };
      })
    );

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(serviceLayer))
    );

    expect(result.defaults).toMatchObject({
      defaultCurrencyCode: "USD",
      supportedCurrencyCodes: ["USD"],
    });
    expect(result.updated).toMatchObject({
      defaultCurrencyCode: "EUR",
      id: "store_layer",
      supportedCurrencyCodes: ["USD", "EUR"],
    });
    expect(outbox.records).toHaveLength(1);
    expect(outbox.records[0]).toMatchObject({
      idempotencyKey:
        "store.settings.updated:store_layer:2026-01-01T00:00:00.000Z",
      status: "pending",
      topic: "commerce.events",
      transactionId: "transaction_layer",
      event: {
        id: "evt_layer",
        name: STORE_SETTINGS_UPDATED_EVENT,
      },
    });
  });

  it("rolls back settings when outbox persistence fails", async () => {
    const repository = createResettableInMemoryStoreRepository();
    const outbox = createInMemoryOutbox({ failEnqueue: true });
    const transactionBoundary = createInMemoryTransactionBoundary({
      resources: [storeRepositoryTransactionResource(repository), outbox],
      transactionIds: ["transaction_rollback"],
    });
    const service = createStoreService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator(["store_atomic", "evt_atomic"]),
      outboxWriter: outbox.writer,
      repository,
      transactionBoundary,
    });

    const exit = await Effect.runPromiseExit(
      service.updateStoreSettings({
        defaultCurrencyCode: "EUR",
        supportedCurrencyCodes: ["USD", "EUR"],
      })
    );

    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure") {
      expect(String(exit.cause)).toContain("TransactionalMutationFailure");
    }
    expect(await Effect.runPromise(repository.snapshot)).toBeNull();
    expect(outbox.records).toEqual([]);
  });

  it("translates commit failure and leaves neither state nor outbox intent", async () => {
    const repository = createResettableInMemoryStoreRepository();
    const outbox = createInMemoryOutbox();
    const service = createStoreService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator(["store_commit", "evt_commit"]),
      outboxWriter: outbox.writer,
      repository,
      transactionBoundary: createInMemoryTransactionBoundary({
        failCommit: true,
        resources: [storeRepositoryTransactionResource(repository), outbox],
      }),
    });

    await expect(
      Effect.runPromise(
        service.updateStoreSettings({
          defaultCurrencyCode: "EUR",
          supportedCurrencyCodes: ["USD", "EUR"],
        })
      )
    ).rejects.toMatchObject({
      _tag: "TransactionalMutationFailure",
      moduleName: "store",
      operation: "updateStoreSettings",
      stage: "transaction",
    });
    expect(await Effect.runPromise(repository.snapshot)).toBeNull();
    expect(outbox.records).toEqual([]);
  });
});

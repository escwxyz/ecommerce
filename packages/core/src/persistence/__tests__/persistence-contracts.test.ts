import { describe, expect, it } from "bun:test";

import { Context, Effect, Layer, Schema } from "effect";

import { createEventEnvelope } from "../../events/index";
import {
  CurrentTransactionService,
  MigrationService,
  OutboxClaimerService,
  OutboxWriterService,
  RepositoryUnavailable,
  TransactionBoundaryService,
  currentTransactionLayer,
  migrationServiceLayer,
  outboxClaimerLayer,
  outboxWriterLayer,
  transactionBoundaryLayer,
  type CommerceRepository,
  type MigrationRecord,
  type OutboxMessage,
  type OutboxRecord,
} from "../index";

class StoreRepository extends Context.Service<
  StoreRepository,
  CommerceRepository & {
    readonly findName: (storeId: string) => Effect.Effect<string>;
  }
>()("@ecommerce/core/test/StoreRepository") {}

const fixedDate = new Date("2026-01-01T00:00:00.000Z");

describe("Effect persistence contracts", () => {
  it("keeps shared persistence failures schema-backed and matchable", () => {
    const failure = new RepositoryUnavailable({
      adapter: "postgres",
      operation: "read",
      repository: "StoreRepository",
    });
    const recovered = Effect.runSync(
      Effect.fail(failure).pipe(
        Effect.catchTag("RepositoryUnavailable", (error) =>
          Effect.succeed(`${error.adapter}:${error.repository}`)
        )
      )
    );

    expect(Schema.encodeSync(RepositoryUnavailable)(failure)).toEqual({
      _tag: "RepositoryUnavailable",
      adapter: "postgres",
      operation: "read",
      repository: "StoreRepository",
    });
    expect(recovered).toBe("postgres:StoreRepository");
  });

  it("keeps module repositories runtime-neutral and replaceable by Layer", async () => {
    const describeStore = StoreRepository.use((repository) =>
      Effect.map(repository.findName("store_1"), (name) => ({
        moduleName: repository.moduleName,
        name,
        repositoryName: repository.repositoryName,
      }))
    );
    const makeLayer = (name: string) =>
      Layer.succeed(
        StoreRepository,
        StoreRepository.of({
          findName: () => Effect.succeed(name),
          moduleName: "store",
          repositoryName: "StoreRepository",
        })
      );

    const productionResult = await Effect.runPromise(
      describeStore.pipe(Effect.provide(makeLayer("postgres")))
    );
    const testResult = await Effect.runPromise(
      describeStore.pipe(Effect.provide(makeLayer("in-memory")))
    );

    expect(productionResult).toEqual({
      moduleName: "store",
      name: "postgres",
      repositoryName: "StoreRepository",
    });
    expect(testResult).toEqual({
      moduleName: "store",
      name: "in-memory",
      repositoryName: "StoreRepository",
    });
  });

  it("writes outbox records inside a local transaction boundary", async () => {
    const records: OutboxRecord[] = [];
    const transaction = CurrentTransactionService.of({
      adapter: "in-memory",
      startedAt: fixedDate,
      transactionId: "transaction_1",
    });
    const transactionLayer = transactionBoundaryLayer(
      TransactionBoundaryService.of({
        withTransaction: (effect) =>
          effect.pipe(Effect.provide(currentTransactionLayer(transaction))),
      })
    );
    const writerLayer = outboxWriterLayer(
      OutboxWriterService.of({
        enqueue: <EventName extends string, Payload>(
          message: OutboxMessage<EventName, Payload>
        ) =>
          CurrentTransactionService.use((currentTransaction) =>
            Effect.sync(() => {
              const record: OutboxRecord<EventName, Payload> = {
                ...message,
                attempts: 0,
                createdAt: fixedDate,
                recordId: "outbox_1",
                status: "pending",
                transactionId: currentTransaction.transactionId,
              };
              records.push(record);
              return { record };
            })
          ),
      })
    );
    const event = createEventEnvelope({
      id: "event_1",
      name: "store.created",
      payload: { storeId: "store_1" },
    });
    const program = TransactionBoundaryService.use((boundary) =>
      boundary.withTransaction(
        OutboxWriterService.use((writer) =>
          writer.enqueue({
            event,
            idempotencyKey: "store_1:create",
            topic: "commerce.events",
          })
        )
      )
    ).pipe(Effect.provide(Layer.merge(transactionLayer, writerLayer)));

    const result = await Effect.runPromise(program);

    expect(result.record.transactionId).toBe("transaction_1");
    expect(records).toHaveLength(1);
    expect(records[0]?.event.name).toBe("store.created");
  });

  it("exposes migration status without leaking adapter execution details", async () => {
    const migration: MigrationRecord = {
      checksum: "sha256:001",
      description: "create store tables",
      dialect: "postgres",
      id: "001_store",
      moduleName: "store",
      status: "pending",
    };
    const layer = migrationServiceLayer(
      MigrationService.of({
        applyPending: () =>
          Effect.succeed({
            applied: [
              { ...migration, appliedAt: fixedDate, status: "applied" },
            ],
            status: {
              adapter: "postgres",
              checkedAt: fixedDate,
              records: [
                { ...migration, appliedAt: fixedDate, status: "applied" },
              ],
            },
          }),
        getStatus: () =>
          Effect.succeed({
            adapter: "postgres",
            checkedAt: fixedDate,
            records: [migration],
          }),
      })
    );

    const status = await Effect.runPromise(
      MigrationService.use((service) => service.getStatus()).pipe(
        Effect.provide(layer)
      )
    );

    expect(status.records).toEqual([migration]);
    expect(status.records[0]?.dialect).toBe("postgres");
  });

  it("separates post-commit outbox claiming from transaction-scoped writes", async () => {
    const pendingRecord: OutboxRecord = {
      attempts: 0,
      createdAt: fixedDate,
      event: createEventEnvelope({
        id: "event_1",
        name: "store.created",
        payload: { storeId: "store_1" },
      }),
      idempotencyKey: "store_1:create",
      recordId: "outbox_1",
      status: "pending",
      topic: "commerce.events",
      transactionId: "transaction_1",
    };
    const deliveries: string[] = [];
    const failures: string[] = [];
    const layer = outboxClaimerLayer(
      OutboxClaimerService.of({
        claimPending: ({ limit, topic }) =>
          Effect.succeed({
            claimedAt: fixedDate,
            claimId: "claim_1",
            records:
              limit > 0 && topic === pendingRecord.topic ? [pendingRecord] : [],
          }),
        markDelivered: (recordId) =>
          Effect.sync(() => {
            deliveries.push(recordId);
          }),
        markFailed: ({ reason }) =>
          Effect.sync(() => {
            failures.push(reason);
          }),
      })
    );
    const program = Effect.gen(function* () {
      const claimer = yield* OutboxClaimerService;
      const claim = yield* claimer.claimPending({
        limit: 1,
        topic: "commerce.events",
      });
      yield* claimer.markDelivered("outbox_1");
      return claim;
    }).pipe(Effect.provide(layer));

    const claim = await Effect.runPromise(program);

    expect(claim.records).toEqual([pendingRecord]);
    expect(deliveries).toEqual(["outbox_1"]);
    expect(failures).toEqual([]);
  });
});

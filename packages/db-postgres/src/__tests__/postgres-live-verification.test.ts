import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";

import { createEventEnvelope } from "@ecommerce/core";
import {
  CurrentTransactionService,
  OutboxClaimerService,
  OutboxWriterService,
  currentTransactionLayer,
} from "@ecommerce/core/persistence";
import { PgClient } from "@effect/sql-pg";
import { sql } from "drizzle-orm";
import { Cause, Effect, Exit, Layer, ManagedRuntime, Redacted } from "effect";
import type { Effect as EffectValue } from "effect/Effect";
import type { SqlClient } from "effect/unstable/sql/SqlClient";
import type { SqlError } from "effect/unstable/sql/SqlError";

import {
  PostgresDrizzleService,
  buildPostgresOutboxInsert,
  commerceOutbox,
  commerceOutboxTableName,
  createPostgresClientLayer,
  createPostgresDrizzleLayer,
  createPostgresOutboxLayer,
  createPostgresPoolConfig,
  getPostgresMigrationStatus,
  resetPostgresDevelopmentDatabase,
  runPostgresMigrations,
} from "../index";
import { localPostgresContractUrlEnv } from "../repository-contract-harness";

const livePostgresUrl = process.env[localPostgresContractUrlEnv];
const liveVerificationClock = new Date("2026-07-12T12:00:00.000Z");
let liveSequence = 0;

const describeLivePostgres = livePostgresUrl ? describe : describe.skip;
type LiveRuntimeRequirement =
  | OutboxClaimerService
  | OutboxWriterService
  | PgClient.PgClient
  | PostgresDrizzleService
  | SqlClient;

const nextIdentifier = (prefix: string) =>
  Effect.sync(() => `${prefix}_${++liveSequence}`);

const createLiveRuntimeLayer = () => {
  const clientLayer = createPostgresClientLayer(
    createPostgresPoolConfig({
      applicationName: "@ecommerce/db-postgres:live-verification",
      maxConnections: 4,
      url: Redacted.make(livePostgresUrl ?? "postgres://missing"),
    })
  );
  const databaseLayer = Layer.merge(
    clientLayer,
    createPostgresDrizzleLayer().pipe(Layer.provide(clientLayer))
  );

  return Layer.merge(
    databaseLayer,
    createPostgresOutboxLayer({
      nextClaimId: nextIdentifier("claim_live"),
      nextDeadLetterId: nextIdentifier("dead_letter_live"),
      nextRecordId: nextIdentifier("outbox_live"),
      now: Effect.succeed(liveVerificationClock),
    }).pipe(Layer.provide(databaseLayer))
  );
};

const liveRuntime = ManagedRuntime.make(createLiveRuntimeLayer());

const runLiveEffect = <A, E, R extends LiveRuntimeRequirement>(
  effect: EffectValue<A, E, R>
): Promise<A> => liveRuntime.runPromise(effect);

const runLiveExit = <A, E, R extends LiveRuntimeRequirement>(
  effect: EffectValue<A, E, R>
): Promise<Exit.Exit<A, E | SqlError>> => liveRuntime.runPromiseExit(effect);

const resetAndMigrate = () =>
  runLiveEffect(
    resetPostgresDevelopmentDatabase({
      allowDestructive: true,
    }).pipe(Effect.andThen(runPostgresMigrations()))
  );

const hasQueryRows = <TRow>(
  value: unknown
): value is {
  readonly rows: readonly TRow[];
} =>
  typeof value === "object" &&
  value !== null &&
  Array.isArray(Reflect.get(value, "rows"));

const normalizeQueryRows = <TRow>(value: unknown): readonly TRow[] =>
  Array.isArray(value) ? value : hasQueryRows<TRow>(value) ? value.rows : [];

const countOutboxRows = () =>
  PostgresDrizzleService.use((service) =>
    service.database.execute<{ count: number }>(
      sql`SELECT COUNT(*)::int AS "count" FROM ${commerceOutbox}`
    )
  ).pipe(
    Effect.map(
      (result) => normalizeQueryRows<{ count: number }>(result)[0]?.count ?? 0
    )
  );

const readOutboxStatuses = () =>
  PostgresDrizzleService.use((service) =>
    service.database.execute<{ status: string }>(
      sql`SELECT status FROM ${commerceOutbox} ORDER BY record_id ASC`
    )
  ).pipe(
    Effect.map((result) => normalizeQueryRows<{ status: string }>(result))
  );

const insertOutboxRecord = ({
  idempotencyKey,
  recordId,
}: {
  readonly idempotencyKey: string;
  readonly recordId: string;
}) =>
  PostgresDrizzleService.use((service) =>
    service.database.insert(commerceOutbox).values(
      buildPostgresOutboxInsert({
        message: {
          event: createEventEnvelope({
            id: `${recordId}_event`,
            name: "store.created",
            payload: {
              ordinal: Number.parseInt(recordId.replace(/\D+/g, ""), 10) || 0,
            },
            sourceModule: "store",
            subject: {
              id: "store_1",
              type: "store",
            },
          }),
          idempotencyKey,
          topic: "commerce.events",
        },
        now: liveVerificationClock,
        recordId,
        transactionId: "transaction_live",
      })
    )
  );

const withLiveTransaction = <A, E, R>(
  transactionId: string,
  effect: EffectValue<A, E, R | CurrentTransactionService>
) =>
  PostgresDrizzleService.use((service) =>
    service.withTransaction(() =>
      effect.pipe(
        Effect.provide(
          currentTransactionLayer(
            CurrentTransactionService.of({
              adapter: "effect-postgres",
              startedAt: liveVerificationClock,
              transactionId,
            })
          )
        )
      )
    )
  );

describe("live PostgreSQL verification", () => {
  it("skips live verification when POSTGRES_URL is absent", () => {
    if (livePostgresUrl) {
      expect(typeof livePostgresUrl).toBe("string");
      return;
    }

    expect(livePostgresUrl).toBeUndefined();
  });
});

describeLivePostgres("live PostgreSQL verification", () => {
  beforeAll(async () => {
    await resetAndMigrate();
  });

  beforeEach(async () => {
    await resetAndMigrate();
  });

  afterAll(async () => {
    await liveRuntime.dispose();
  });

  it("applies the checked-in migration baseline and reports clean status", async () => {
    const status = await runLiveEffect(getPostgresMigrationStatus());
    const tables = await runLiveEffect(
      PostgresDrizzleService.use((service) =>
        service.database.execute<{ exists: string | null }>(
          sql`SELECT to_regclass(${`public.${commerceOutboxTableName}`}) AS "exists"`
        )
      ).pipe(
        Effect.map((result) =>
          normalizeQueryRows<{ exists: string | null }>(result)
        )
      )
    );

    expect(status.adapter).toBe("effect-postgres");
    expect(status.appliedCount).toBeGreaterThan(0);
    expect(status.failedCount).toBe(0);
    expect(status.pendingCount).toBe(0);
    expect(tables[0]?.exists).toBe(commerceOutboxTableName);
  });

  it("commits outbox writes inside a transaction and rolls them back on failure", async () => {
    await runLiveEffect(
      withLiveTransaction(
        "transaction_commit",
        OutboxWriterService.use((writer) =>
          writer.enqueue({
            event: createEventEnvelope({
              id: "event_commit",
              name: "store.created",
              payload: { storeId: "store_1" },
              sourceModule: "store",
            }),
            idempotencyKey: "store_1:commit",
            topic: "commerce.events",
          })
        )
      )
    );

    expect(await runLiveEffect(countOutboxRows())).toBe(1);

    const rollbackExit = await runLiveExit(
      withLiveTransaction(
        "transaction_rollback",
        OutboxWriterService.use((writer) =>
          writer
            .enqueue({
              event: createEventEnvelope({
                id: "event_rollback",
                name: "store.created",
                payload: { storeId: "store_2" },
                sourceModule: "store",
              }),
              idempotencyKey: "store_2:rollback",
              topic: "commerce.events",
            })
            .pipe(Effect.andThen(Effect.fail("force-rollback")))
        )
      )
    );

    expect(Exit.isFailure(rollbackExit)).toBe(true);
    expect(await runLiveEffect(countOutboxRows())).toBe(1);
  });

  it("surfaces PostgreSQL constraint failures from duplicate records", async () => {
    await runLiveEffect(
      insertOutboxRecord({
        idempotencyKey: "duplicate:key",
        recordId: "outbox_duplicate",
      })
    );

    const duplicateExit = await runLiveExit(
      insertOutboxRecord({
        idempotencyKey: "duplicate:key:second",
        recordId: "outbox_duplicate",
      })
    );

    expect(Exit.isFailure(duplicateExit)).toBe(true);

    if (Exit.isFailure(duplicateExit)) {
      const failure = Cause.pretty(duplicateExit.cause);
      expect(failure).toContain("duplicate");
    }
  });

  it("decodes claimed outbox rows and splits concurrent claims without overlap", async () => {
    await runLiveEffect(
      Effect.forEach(
        [1, 2, 3, 4] as const,
        (ordinal) =>
          withLiveTransaction(
            `transaction_${ordinal}`,
            OutboxWriterService.use((writer) =>
              writer.enqueue({
                event: createEventEnvelope({
                  id: `event_${ordinal}`,
                  name: "store.created",
                  payload: { ordinal },
                  sourceModule: "store",
                  subject: {
                    id: `store_${ordinal}`,
                    type: "store",
                  },
                }),
                idempotencyKey: `store_${ordinal}:create`,
                topic: "commerce.events",
              })
            )
          ),
        { concurrency: "unbounded" }
      ).pipe(Effect.asVoid)
    );

    const [firstClaim, secondClaim] = await runLiveEffect(
      Effect.all(
        [
          OutboxClaimerService.use((claimer) =>
            claimer.claimPending({
              limit: 2,
              topic: "commerce.events",
            })
          ),
          OutboxClaimerService.use((claimer) =>
            claimer.claimPending({
              limit: 2,
              topic: "commerce.events",
            })
          ),
        ],
        { concurrency: "unbounded" }
      )
    );

    const claimedRecordIds = [
      ...firstClaim.records,
      ...secondClaim.records,
    ].map((record) => record.recordId);
    const uniqueClaimedRecordIds = new Set(claimedRecordIds);
    const claimedOrdinals = [...firstClaim.records, ...secondClaim.records].map(
      (record) =>
        typeof record.event.payload === "object" &&
        record.event.payload !== null &&
        "ordinal" in record.event.payload
          ? record.event.payload.ordinal
          : null
    );

    expect(firstClaim.records).toHaveLength(2);
    expect(secondClaim.records).toHaveLength(2);
    expect(uniqueClaimedRecordIds.size).toBe(4);
    expect(claimedOrdinals.sort()).toEqual([1, 2, 3, 4]);
    expect(firstClaim.records[0]?.createdAt).toBeInstanceOf(Date);
    expect(firstClaim.records[0]?.event.emittedAt).toBeInstanceOf(Date);
    expect(firstClaim.records[0]?.status).toBe("claimed");

    const statuses = await runLiveEffect(readOutboxStatuses());

    expect(statuses.map((row) => row.status)).toEqual([
      "claimed",
      "claimed",
      "claimed",
      "claimed",
    ]);
  });
});

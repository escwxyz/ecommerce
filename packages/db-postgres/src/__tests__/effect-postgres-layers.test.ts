import { describe, expect, it } from "bun:test";

import {
  CurrentTransactionService,
  TransactionFailure,
  TransactionBoundaryService,
} from "@ecommerce/core";
import { Effect, Layer, Redacted } from "effect";
import { SqlError, UnknownError } from "effect/unstable/sql/SqlError";

import {
  CurrentPostgresTransactionService,
  type PostgresDrizzleService as PostgresDrizzleServiceShape,
  PostgresDrizzleService,
  createDrizzlePgTypes,
  createPostgresClientLayer,
  createPostgresDatabaseLayer,
  createPostgresDrizzleLayer,
  createPostgresTransactionBoundaryLayer,
  createPostgresPoolConfig,
  drizzleRawTextTypeOids,
  postgresAdapterTarget,
} from "../index";

const createFakeDrizzleLayer = (
  withTransaction: PostgresDrizzleServiceShape["withTransaction"]
) =>
  Layer.succeed(
    PostgresDrizzleService,
    PostgresDrizzleService.of({
      database: {} as PostgresDrizzleServiceShape["database"],
      withTransaction,
    })
  );

const createFakeBoundaryLayer = (
  withTransaction: PostgresDrizzleServiceShape["withTransaction"]
) =>
  createPostgresTransactionBoundaryLayer({
    nextTransactionId: Effect.succeed("transaction_postgres"),
    now: Effect.succeed(new Date("2026-01-01T00:00:00.000Z")),
  }).pipe(Layer.provide(createFakeDrizzleLayer(withTransaction)));

const createSqlError = (message: string) =>
  new SqlError({
    reason: new UnknownError({
      cause: new Error(message),
      message,
    }),
  });

describe("Effect PostgreSQL and Drizzle Layers", () => {
  it("configures pg parsers so Drizzle owns date/time normalization", () => {
    const parser = createDrizzlePgTypes().getTypeParser(
      drizzleRawTextTypeOids[0]
    );

    expect(parser("2026-01-01 12:00:00+00")).toBe("2026-01-01 12:00:00+00");
  });

  it("preserves regular pg parser fallback behavior", () => {
    const parser = createDrizzlePgTypes().getTypeParser(23);

    expect(parser("42")).toBe(42);
  });

  it("redacts URL-based pool configuration at composition boundaries", () => {
    const config = createPostgresPoolConfig({
      applicationName: "@ecommerce/db-postgres:test",
      maxConnections: 1,
      url: "postgres://user:password@example.test:5432/ecommerce",
    });

    expect(Redacted.isRedacted(config.url)).toBe(true);
    expect(String(config.url)).toBe("<redacted>");
    expect(config.applicationName).toBe("@ecommerce/db-postgres:test");
  });

  it("constructs scoped client and Drizzle database Layers without opening a socket", () => {
    const postgres = createPostgresPoolConfig({
      applicationName: "@ecommerce/db-postgres:test",
      maxConnections: 1,
      url: "postgres://user:password@example.test:5432/ecommerce",
    });

    expect(Layer.isLayer(createPostgresClientLayer(postgres))).toBe(true);
    expect(Layer.isLayer(createPostgresDrizzleLayer())).toBe(true);
    expect(
      Layer.isLayer(
        createPostgresDatabaseLayer({
          postgres,
        })
      )
    ).toBe(true);
  });

  it("exposes a Drizzle service whose transaction operation stays in Effect", () => {
    const program = PostgresDrizzleService.use((service) =>
      service.withTransaction((transaction) =>
        Effect.succeed({
          adapter: postgresAdapterTarget,
          hasTransaction: Boolean(transaction),
        })
      )
    );

    expect(Effect.isEffect(program)).toBe(true);
  });

  it("exposes the active Drizzle transaction through an adapter-local service", () => {
    const program = PostgresDrizzleService.use((service) =>
      service.withTransaction((transaction) =>
        CurrentPostgresTransactionService.use((currentTransaction) =>
          Effect.succeed(currentTransaction === transaction)
        )
      )
    );

    expect(Effect.isEffect(program)).toBe(true);
  });

  it("provides runtime-neutral transaction metadata through the PostgreSQL boundary", () => {
    const program = TransactionBoundaryService.use((boundary) =>
      boundary.withTransaction(
        CurrentTransactionService.use((transaction) =>
          Effect.succeed({
            adapter: transaction.adapter,
            transactionId: transaction.transactionId,
          })
        )
      )
    );
    const layer = createPostgresTransactionBoundaryLayer({
      nextTransactionId: Effect.succeed("transaction_postgres"),
      now: Effect.succeed(new Date("2026-01-01T00:00:00.000Z")),
    });

    expect(Effect.isEffect(program.pipe(Effect.provide(layer)))).toBe(true);
  });

  it("preserves repository SqlError failures from inside the transaction body", async () => {
    const repositoryFailure = createSqlError("repository insert failed");
    const layer = createFakeBoundaryLayer((use) => use({} as never));
    const program = TransactionBoundaryService.use((boundary) =>
      boundary.withTransaction(Effect.fail(repositoryFailure))
    ).pipe(Effect.provide(layer));

    const failure = await Effect.runPromise(Effect.flip(program));

    expect(failure).toBe(repositoryFailure);
  });

  it("converts transaction begin, commit, and rollback SqlErrors to TransactionFailure", async () => {
    const beginFailure = createSqlError("begin failed");
    const commitFailure = createSqlError("commit failed");
    const rollbackFailure = createSqlError("rollback failed");
    const beginLayer = createFakeBoundaryLayer(() => Effect.fail(beginFailure));
    const commitLayer = createFakeBoundaryLayer((use) =>
      use({} as never).pipe(Effect.andThen(Effect.fail(commitFailure)))
    );
    const rollbackLayer = createFakeBoundaryLayer((use) =>
      Effect.exit(use({} as never)).pipe(
        Effect.andThen(Effect.fail(rollbackFailure))
      )
    );
    const runBoundaryFailure = (layer: typeof beginLayer) =>
      Effect.runPromise(
        Effect.flip(
          TransactionBoundaryService.use((boundary) =>
            boundary.withTransaction(Effect.succeed("ok"))
          ).pipe(Effect.provide(layer))
        )
      );
    const runRollbackFailure = () =>
      Effect.runPromise(
        Effect.flip(
          TransactionBoundaryService.use((boundary) =>
            boundary.withTransaction(Effect.fail("body failed"))
          ).pipe(Effect.provide(rollbackLayer))
        )
      );

    const failures = await Promise.all([
      runBoundaryFailure(beginLayer),
      runBoundaryFailure(commitLayer),
      runRollbackFailure(),
    ]);

    expect(
      failures.map((failure) =>
        failure instanceof TransactionFailure ? failure.operation : "unchanged"
      )
    ).toEqual(["begin", "commit", "rollback"]);
  });
});

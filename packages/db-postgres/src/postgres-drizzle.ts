import * as PgDrizzle from "drizzle-orm/effect-postgres";
import { Context, Effect, Layer } from "effect";
import type { Effect as EffectValue, Success } from "effect/Effect";
import type { SqlError } from "effect/unstable/sql/SqlError";

/** Drizzle Effect PostgreSQL configuration accepted by the adapter Layer. */
export type PostgresDrizzleConfig = Parameters<
  typeof PgDrizzle.makeWithDefaults
>[0];

/** Drizzle Effect PostgreSQL database type exposed to repository adapters. */
export type PostgresDrizzleDatabase = Awaited<
  Success<ReturnType<typeof PgDrizzle.makeWithDefaults>>
>;

/** Drizzle Effect PostgreSQL transaction type exposed to repository adapters. */
export type PostgresDrizzleTransaction = Parameters<
  PostgresDrizzleDatabase["transaction"]
>[0] extends (
  transaction: infer Transaction
) => EffectValue<unknown, unknown, unknown>
  ? Transaction
  : never;

/**
 * Adapter-local transaction handle made available inside
 * `PostgresDrizzleService.withTransaction`. Core transaction metadata remains
 * runtime-neutral; PostgreSQL repositories and the transactional outbox use
 * this tag to execute SQL against the active Drizzle transaction.
 */
export const CurrentPostgresTransactionService =
  Context.Service<PostgresDrizzleTransaction>(
    "@ecommerce/db-postgres/CurrentPostgresTransactionService"
  );

/** Service provided to PostgreSQL repository adapters. */
export interface PostgresDrizzleService {
  readonly database: PostgresDrizzleDatabase;
  readonly withTransaction: <A, E, R>(
    use: (transaction: PostgresDrizzleTransaction) => EffectValue<A, E, R>
  ) => EffectValue<A, E | SqlError, R>;
}

/** Effect tag for the PostgreSQL Drizzle database service. */
export const PostgresDrizzleService = Context.Service<PostgresDrizzleService>(
  "@ecommerce/db-postgres/PostgresDrizzleService"
);

const createPostgresDrizzleService = (
  database: PostgresDrizzleDatabase
): PostgresDrizzleService =>
  PostgresDrizzleService.of({
    database,
    withTransaction: (use) =>
      database.transaction((transaction) =>
        use(transaction).pipe(
          Effect.provideService(CurrentPostgresTransactionService, transaction)
        )
      ),
  });

/** Creates the Drizzle database Layer backed by an Effect SQL PostgreSQL client. */
export const createPostgresDrizzleLayer = (config?: PostgresDrizzleConfig) =>
  Layer.effect(
    PostgresDrizzleService,
    Effect.map(PgDrizzle.makeWithDefaults(config), createPostgresDrizzleService)
  );

import { PgClient } from "@effect/sql-pg";
import * as PgDrizzle from "drizzle-orm/effect-postgres";
import { Context, Effect, Layer, Redacted } from "effect";
import type { Effect as EffectValue, Success } from "effect/Effect";
import type { SqlError } from "effect/unstable/sql/SqlError";
import { types as pgTypes } from "pg";
import type { CustomTypesConfig } from "pg";

/**
 * PostgreSQL adapter package. It composes `@effect/sql-pg` with Drizzle's
 * Effect PostgreSQL driver while keeping concrete database types outside core.
 */
export const postgresAdapterTarget = "effect-postgres" as const;

/** PostgreSQL type OIDs that Drizzle should receive as raw strings. */
export const drizzleRawTextTypeOids = [
  1184, 1114, 1082, 1186, 1231, 1115, 1185, 1187, 1182,
] as const;

/** Drizzle Effect PostgreSQL configuration accepted by the adapter Layer. */
export type PostgresDrizzleConfig = Parameters<
  typeof PgDrizzle.makeWithDefaults
>[0];

/** Effect SQL PostgreSQL pool configuration accepted by the adapter Layer. */
export type PostgresPoolConfig = PgClient.PgPoolConfig;

/** Effect PostgreSQL client service type exposed by the adapter package. */
export type EffectPostgresClient = PgClient.PgClient;

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

/**
 * Creates pg type parsers that leave date/time-ish PostgreSQL values as raw
 * text so Drizzle's PostgreSQL codecs own value normalization.
 */
export const createDrizzlePgTypes = (
  fallbackTypes: CustomTypesConfig = pgTypes
): CustomTypesConfig => ({
  getTypeParser: (typeId, format) => {
    if (typeof typeId === "number" && isDrizzleRawTextTypeOid(typeId)) {
      return (value: string) => value;
    }

    return fallbackTypes.getTypeParser(typeId, format);
  },
});

const isDrizzleRawTextTypeOid = (typeId: number): boolean =>
  drizzleRawTextTypeOids.some((rawTypeId) => rawTypeId === typeId);

/** Adds Drizzle-safe pg parsers to an Effect SQL PostgreSQL pool config. */
export const withDrizzlePgTypes = (
  config: PostgresPoolConfig
): PostgresPoolConfig => ({
  ...config,
  types: createDrizzlePgTypes(config.types),
});

/** Creates a redacted URL-based PostgreSQL pool config for composition roots. */
export const createPostgresPoolConfig = ({
  url,
  ...config
}: Omit<PostgresPoolConfig, "url"> & {
  readonly url: Redacted.Redacted | string;
}): PostgresPoolConfig => ({
  ...config,
  url: typeof url === "string" ? Redacted.make(url) : url,
});

/** Creates the scoped Effect SQL PostgreSQL client Layer. */
export const createPostgresClientLayer = (config: PostgresPoolConfig) =>
  PgClient.layer(withDrizzlePgTypes(config));

const createPostgresDrizzleService = (
  database: PostgresDrizzleDatabase
): PostgresDrizzleService =>
  PostgresDrizzleService.of({
    database,
    withTransaction: (use) => database.transaction(use),
  });

/** Creates the Drizzle database Layer backed by an Effect SQL PostgreSQL client. */
export const createPostgresDrizzleLayer = (config?: PostgresDrizzleConfig) =>
  Layer.effect(
    PostgresDrizzleService,
    Effect.map(PgDrizzle.makeWithDefaults(config), createPostgresDrizzleService)
  );

/** Creates the full PostgreSQL adapter Layer used by runtime composition roots. */
export const createPostgresDatabaseLayer = ({
  drizzle,
  postgres,
}: {
  readonly drizzle?: PostgresDrizzleConfig;
  readonly postgres: PostgresPoolConfig;
}) =>
  createPostgresDrizzleLayer(drizzle).pipe(
    Layer.provide(createPostgresClientLayer(postgres))
  );

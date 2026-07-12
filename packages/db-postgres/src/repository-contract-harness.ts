import { createRepositoryContractHarness } from "@ecommerce/core/testing";
import type { RepositoryContractHarness } from "@ecommerce/core/testing";
import { Effect, Layer, Redacted } from "effect";

import type {
  PostgresDrizzleConfig,
  PostgresDrizzleService,
} from "./postgres-drizzle";
import type { PostgresPoolConfig } from "./index";
import {
  createPostgresDatabaseLayer,
  createPostgresPoolConfig,
  postgresAdapterTarget,
  runPostgresMigrations,
} from "./index";

/** Environment variable used by opt-in local PostgreSQL contract suites. */
export const localPostgresContractUrlEnv = "POSTGRES_URL" as const;

/** Source used to resolve a local PostgreSQL contract database URL. */
export type LocalPostgresContractUrlSource = "explicit" | "POSTGRES_URL";

/** Options for a repository Layer that runs on the PostgreSQL adapter service. */
export interface LocalPostgresRepositoryContractHarnessOptions<Identifier> {
  readonly databaseUrl?: string;
  readonly drizzle?: PostgresDrizzleConfig;
  readonly migrateBeforeEach?: boolean;
  readonly postgres?: Omit<PostgresPoolConfig, "url">;
  readonly repositoryLayer: Layer.Layer<
    Identifier,
    unknown,
    PostgresDrizzleService
  >;
  readonly repositoryName: string;
  readonly reset?: Effect.Effect<void, unknown, PostgresDrizzleService>;
}

/** Available local PostgreSQL repository harness. */
export interface AvailableLocalPostgresRepositoryContractHarness<Identifier> {
  readonly _tag: "available";
  readonly databaseUrlSource: LocalPostgresContractUrlSource;
  readonly harness: RepositoryContractHarness<Identifier>;
}

/** Skipped local PostgreSQL repository harness when no database URL is present. */
export interface SkippedLocalPostgresRepositoryContractHarness {
  readonly _tag: "skipped";
  readonly reason: "missing-postgres-url";
}

/** Local PostgreSQL repository harness creation result. */
export type LocalPostgresRepositoryContractHarness<Identifier> =
  | AvailableLocalPostgresRepositoryContractHarness<Identifier>
  | SkippedLocalPostgresRepositoryContractHarness;

const resolveDatabaseUrl = (
  databaseUrl: string | undefined
):
  | {
      readonly source: LocalPostgresContractUrlSource;
      readonly url: string;
    }
  | undefined => {
  if (databaseUrl) {
    return {
      source: "explicit",
      url: databaseUrl,
    };
  }

  const environmentUrl = process.env[localPostgresContractUrlEnv];

  if (!environmentUrl) {
    return undefined;
  }

  return {
    source: localPostgresContractUrlEnv,
    url: environmentUrl,
  };
};

/**
 * Creates the local PostgreSQL repository contract harness.
 *
 * Live execution is opt-in through an explicit URL or `POSTGRES_URL`. Without a
 * URL the result is a skipped harness, allowing credential-free unit tests to
 * assert contract wiring without opening sockets.
 */
export const createLocalPostgresRepositoryContractHarness = <Identifier>({
  databaseUrl,
  drizzle,
  migrateBeforeEach = true,
  postgres,
  repositoryLayer,
  repositoryName,
  reset = Effect.void,
}: LocalPostgresRepositoryContractHarnessOptions<Identifier>): LocalPostgresRepositoryContractHarness<Identifier> => {
  const resolved = resolveDatabaseUrl(databaseUrl);

  if (!resolved) {
    return {
      _tag: "skipped",
      reason: "missing-postgres-url",
    };
  }

  const databaseLayer = createPostgresDatabaseLayer({
    drizzle,
    postgres: createPostgresPoolConfig({
      applicationName: "@ecommerce/db-postgres:repository-contracts",
      maxConnections: 1,
      ...postgres,
      url: Redacted.make(resolved.url),
    }),
  });
  const layer = repositoryLayer.pipe(Layer.provide(databaseLayer));
  const prepareDatabase = migrateBeforeEach
    ? runPostgresMigrations().pipe(Effect.andThen(reset))
    : reset;

  return {
    _tag: "available",
    databaseUrlSource: resolved.source,
    harness: createRepositoryContractHarness({
      adapter: postgresAdapterTarget,
      layer,
      repositoryName,
      reset: prepareDatabase.pipe(Effect.provide(databaseLayer)),
    }),
  };
};

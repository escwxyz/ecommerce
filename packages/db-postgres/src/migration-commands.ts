import { PgClient } from "@effect/sql-pg";
import { readMigrationFiles } from "drizzle-orm/migrator";
import type { MigrationMeta } from "drizzle-orm/migrator";
import { Effect, Schema } from "effect";
import type { SqlError } from "effect/unstable/sql/SqlError";

import { postgresAdapterTarget } from "./adapter-constants";
import {
  defaultPostgresMigrationsFolder,
  defaultPostgresMigrationsTable,
} from "./migration-config";
import type { PostgresMigrationRunnerOptions } from "./migration-config";
import {
  commerceMigrationAuditTableName,
  commerceOutboxDeadLetterTableName,
  commerceOutboxTableName,
} from "./schema/index";

export type PostgresMigrationCommand =
  | "apply"
  | "rollback-development"
  | "reset-development"
  | "status";

export type PostgresMigrationCommandPhase =
  | "connection"
  | "destructive-confirmation"
  | "local-migrations"
  | "status-query";

/** Expected command failure emitted by the PostgreSQL migration command layer. */
export class PostgresMigrationCommandFailure extends Schema.TaggedErrorClass<PostgresMigrationCommandFailure>()(
  "PostgresMigrationCommandFailure",
  {
    command: Schema.Literals([
      "apply",
      "rollback-development",
      "reset-development",
      "status",
    ]),
    message: Schema.NonEmptyString,
    phase: Schema.Literals([
      "connection",
      "destructive-confirmation",
      "local-migrations",
      "status-query",
    ]),
  }
) {}

export interface PostgresMigrationConfigResolved {
  readonly migrationsFolder: string;
  readonly migrationsSchema: string;
  readonly migrationsTable: string;
}

export interface PostgresLocalMigrationRecord {
  readonly checksum: string;
  readonly createdAtMillis: number;
  readonly name: string;
}

export interface PostgresAppliedMigrationRow {
  readonly appliedAt: Date | string | null;
  readonly createdAt: number | string | null;
  readonly hash: string;
  readonly id: number;
  readonly name: string | null;
}

export type PostgresMigrationRecordStatus = "applied" | "failed" | "pending";

export interface PostgresMigrationStatusRecord {
  readonly appliedAt: Date | string | null;
  readonly checksum: string;
  readonly createdAtMillis: number;
  readonly failureMessage?: string;
  readonly name: string;
  readonly status: PostgresMigrationRecordStatus;
}

export interface PostgresMigrationStatusResult {
  readonly adapter: typeof postgresAdapterTarget;
  readonly appliedCount: number;
  readonly checkedAt: Date;
  readonly failedCount: number;
  readonly pendingCount: number;
  readonly records: readonly PostgresMigrationStatusRecord[];
}

export interface PostgresDevelopmentMigrationCommandOptions extends PostgresMigrationRunnerOptions {
  readonly allowDestructive?: boolean;
}

export interface PostgresDevelopmentMigrationCommandPlan {
  readonly command: "rollback-development" | "reset-development";
  readonly requiresConfirmation: true;
  readonly statements: readonly string[];
}

const drizzleDefaultMigrationsSchema = "drizzle";
const nonEmptyFallbackMessage = "PostgreSQL migration command failed";

const toFailureMessage = (cause: unknown): string => {
  if (cause instanceof Error && cause.message.length > 0) {
    return cause.message;
  }

  if (typeof cause === "string" && cause.length > 0) {
    return cause;
  }

  return nonEmptyFallbackMessage;
};

/** Resolves Drizzle migration command defaults, including Drizzle's schema default. */
export const resolvePostgresMigrationCommandConfig = ({
  migrationsFolder = defaultPostgresMigrationsFolder,
  migrationsSchema = drizzleDefaultMigrationsSchema,
  migrationsTable = defaultPostgresMigrationsTable,
}: PostgresMigrationRunnerOptions = {}): PostgresMigrationConfigResolved => ({
  migrationsFolder,
  migrationsSchema,
  migrationsTable,
});

/** Reads checked-in Drizzle migrations without opening a database connection. */
export const readPostgresLocalMigrations = (
  options?: PostgresMigrationRunnerOptions
) =>
  Effect.try({
    try: () =>
      readMigrationFiles(resolvePostgresMigrationCommandConfig(options)).map(
        toLocalMigrationRecord
      ),
    catch: (cause) =>
      new PostgresMigrationCommandFailure({
        command: "status",
        message: toFailureMessage(cause),
        phase: "local-migrations",
      }),
  });

const toLocalMigrationRecord = (
  migration: MigrationMeta
): PostgresLocalMigrationRecord => ({
  checksum: migration.hash,
  createdAtMillis: migration.folderMillis,
  name: migration.name,
});

/** Builds the status result from local and database migration records. */
export const summarizePostgresMigrationStatus = ({
  appliedMigrations,
  checkedAt,
  localMigrations,
}: {
  readonly appliedMigrations: readonly PostgresAppliedMigrationRow[];
  readonly checkedAt: Date;
  readonly localMigrations: readonly PostgresLocalMigrationRecord[];
}): PostgresMigrationStatusResult => {
  const appliedByName = new Map(
    appliedMigrations.flatMap((migration) =>
      migration.name === null ? [] : [[migration.name, migration]]
    )
  );
  const localNames = new Set(
    localMigrations.map((migration) => migration.name)
  );
  const records: PostgresMigrationStatusRecord[] = [];

  for (const migration of localMigrations) {
    const applied = appliedByName.get(migration.name);
    if (!applied) {
      records.push({
        appliedAt: null,
        checksum: migration.checksum,
        createdAtMillis: migration.createdAtMillis,
        name: migration.name,
        status: "pending",
      });
      continue;
    }

    const checksumMatches = applied.hash === migration.checksum;
    records.push({
      appliedAt: applied.appliedAt,
      checksum: migration.checksum,
      createdAtMillis: migration.createdAtMillis,
      ...(checksumMatches
        ? {}
        : { failureMessage: "Applied migration checksum differs from local" }),
      name: migration.name,
      status: checksumMatches ? "applied" : "failed",
    });
  }

  for (const migration of appliedMigrations) {
    if (migration.name !== null && localNames.has(migration.name)) {
      continue;
    }

    records.push({
      appliedAt: migration.appliedAt,
      checksum: migration.hash,
      createdAtMillis: Number(migration.createdAt ?? 0),
      failureMessage: "Database migration is not present in local baseline",
      name: migration.name ?? `database-migration-${migration.id}`,
      status: "failed",
    });
  }

  const appliedCount = records.filter(
    (record) => record.status === "applied"
  ).length;
  const failedCount = records.filter(
    (record) => record.status === "failed"
  ).length;
  const pendingCount = records.filter(
    (record) => record.status === "pending"
  ).length;

  return {
    adapter: postgresAdapterTarget,
    appliedCount,
    checkedAt,
    failedCount,
    pendingCount,
    records,
  };
};

/** Reads migration status from the Drizzle migration journal. */
export const getPostgresMigrationStatus = (
  options?: PostgresMigrationRunnerOptions
) =>
  Effect.gen(function* getPostgresMigrationStatusGenerator() {
    const config = resolvePostgresMigrationCommandConfig(options);
    const localMigrations = yield* readPostgresLocalMigrations(config);
    const appliedMigrations = yield* readAppliedPostgresMigrations(config);

    return summarizePostgresMigrationStatus({
      appliedMigrations,
      checkedAt: new Date(),
      localMigrations,
    });
  });

const readAppliedPostgresMigrations = (
  config: PostgresMigrationConfigResolved
) =>
  Effect.gen(function* readAppliedPostgresMigrationsGenerator() {
    const sql = yield* PgClient.PgClient;
    const tableExistsRows = yield* sql.unsafe<{
      readonly exists: string | null;
    }>('SELECT to_regclass($1) AS "exists"', [
      qualifyPostgresObjectName(
        config.migrationsSchema,
        config.migrationsTable
      ),
    ]);
    const tableExists = tableExistsRows.some((row) => row.exists !== null);

    if (!tableExists) {
      const noAppliedMigrations: PostgresAppliedMigrationRow[] = [];
      return noAppliedMigrations;
    }

    return yield* sql.unsafe<PostgresAppliedMigrationRow>(
      `SELECT id, hash, created_at AS "createdAt", name, applied_at AS "appliedAt"
       FROM ${quoteQualifiedPostgresName(
         config.migrationsSchema,
         config.migrationsTable
       )}
       ORDER BY created_at ASC, id ASC`
    );
  }).pipe(Effect.mapError(toPostgresStatusQueryFailure));

/** Returns the destructive SQL plan used by development reset/rollback commands. */
export const createPostgresDevelopmentResetPlan = (
  command: "rollback-development" | "reset-development",
  options?: PostgresMigrationRunnerOptions
): PostgresDevelopmentMigrationCommandPlan => {
  const config = resolvePostgresMigrationCommandConfig(options);

  return {
    command,
    requiresConfirmation: true,
    statements: [
      `DROP TABLE IF EXISTS ${quotePostgresIdentifier(
        commerceOutboxDeadLetterTableName
      )} CASCADE`,
      `DROP TABLE IF EXISTS ${quotePostgresIdentifier(
        commerceOutboxTableName
      )} CASCADE`,
      `DROP TABLE IF EXISTS ${quotePostgresIdentifier(
        commerceMigrationAuditTableName
      )} CASCADE`,
      `DROP SCHEMA IF EXISTS ${quotePostgresIdentifier(
        config.migrationsSchema
      )} CASCADE`,
    ],
  };
};

/** Validates the explicit confirmation required by destructive development commands. */
export const requirePostgresDevelopmentResetConfirmation = (
  command: "rollback-development" | "reset-development",
  allowDestructive: boolean
) => {
  if (allowDestructive) {
    return Effect.void;
  }

  return Effect.fail(
    new PostgresMigrationCommandFailure({
      command,
      message:
        "Development reset requires explicit destructive confirmation before it can run",
      phase: "destructive-confirmation",
    })
  );
};

/** Resets the development PostgreSQL schema after explicit confirmation. */
export const resetPostgresDevelopmentDatabase = ({
  allowDestructive = false,
  ...options
}: PostgresDevelopmentMigrationCommandOptions = {}) =>
  Effect.flatMap(
    requirePostgresDevelopmentResetConfirmation(
      "reset-development",
      allowDestructive
    ),
    () =>
      runDevelopmentResetPlan(
        "reset-development",
        createPostgresDevelopmentResetPlan("reset-development", options)
      )
  );

/** Rollback is a development-only reset because this migration has no production data. */
export const rollbackPostgresDevelopmentDatabase = ({
  allowDestructive = false,
  ...options
}: PostgresDevelopmentMigrationCommandOptions = {}) =>
  Effect.flatMap(
    requirePostgresDevelopmentResetConfirmation(
      "rollback-development",
      allowDestructive
    ),
    () =>
      runDevelopmentResetPlan(
        "rollback-development",
        createPostgresDevelopmentResetPlan("rollback-development", options)
      )
  );

const runDevelopmentResetPlan = (
  command: "rollback-development" | "reset-development",
  plan: PostgresDevelopmentMigrationCommandPlan
) =>
  Effect.gen(function* runDevelopmentResetPlanGenerator() {
    const sql = yield* PgClient.PgClient;
    for (const statement of plan.statements) {
      yield* sql.unsafe(statement);
    }

    return plan;
  }).pipe(Effect.mapError(toPostgresDevelopmentResetFailure(command)));

const toPostgresStatusQueryFailure = (
  error: SqlError
): PostgresMigrationCommandFailure =>
  new PostgresMigrationCommandFailure({
    command: "status",
    message: toFailureMessage(error),
    phase: "status-query",
  });

const toPostgresDevelopmentResetFailure =
  (command: "rollback-development" | "reset-development") =>
  (error: SqlError): PostgresMigrationCommandFailure =>
    new PostgresMigrationCommandFailure({
      command,
      message: toFailureMessage(error),
      phase: "connection",
    });

const quotePostgresIdentifier = (value: string): string =>
  `"${value.replaceAll('"', '""')}"`;

const quoteQualifiedPostgresName = (schema: string, table: string): string =>
  `${quotePostgresIdentifier(schema)}.${quotePostgresIdentifier(table)}`;

const qualifyPostgresObjectName = (schema: string, table: string): string =>
  `${schema}.${table}`;

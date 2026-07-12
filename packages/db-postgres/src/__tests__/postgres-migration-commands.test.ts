import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Cause, Effect, Exit } from "effect";

import {
  createPostgresDevelopmentResetPlan,
  defaultPostgresMigrationsFolder,
  defaultPostgresMigrationsTable,
  getPostgresMigrationStatus,
  readPostgresLocalMigrations,
  requirePostgresDevelopmentResetConfirmation,
  resetPostgresDevelopmentDatabase,
  resolvePostgresMigrationCommandConfig,
  rollbackPostgresDevelopmentDatabase,
  summarizePostgresMigrationStatus,
} from "../index";

describe("PostgreSQL migration commands", () => {
  it("resolves command defaults with Drizzle's effective migration schema", () => {
    expect(resolvePostgresMigrationCommandConfig()).toEqual({
      migrationsFolder: defaultPostgresMigrationsFolder,
      migrationsSchema: "drizzle",
      migrationsTable: defaultPostgresMigrationsTable,
    });
  });

  it("summarizes pending, applied, drifted, and database-only migrations", () => {
    const checkedAt = new Date("2026-07-12T00:00:00.000Z");
    const status = summarizePostgresMigrationStatus({
      appliedMigrations: [
        {
          appliedAt: "2026-07-12T00:01:00.000Z",
          createdAt: 1,
          hash: "checksum_applied",
          id: 1,
          name: "20260712000000_applied",
        },
        {
          appliedAt: "2026-07-12T00:02:00.000Z",
          createdAt: 2,
          hash: "database_checksum",
          id: 2,
          name: "20260712000001_drifted",
        },
        {
          appliedAt: "2026-07-12T00:03:00.000Z",
          createdAt: 3,
          hash: "database_only_checksum",
          id: 3,
          name: "20260712000003_database_only",
        },
      ],
      checkedAt,
      localMigrations: [
        {
          checksum: "checksum_applied",
          createdAtMillis: 1,
          name: "20260712000000_applied",
        },
        {
          checksum: "local_checksum",
          createdAtMillis: 2,
          name: "20260712000001_drifted",
        },
        {
          checksum: "pending_checksum",
          createdAtMillis: 4,
          name: "20260712000004_pending",
        },
      ],
    });

    expect(status).toMatchObject({
      appliedCount: 1,
      checkedAt,
      failedCount: 2,
      pendingCount: 1,
    });
    expect(status.records.map((record) => record.status)).toEqual([
      "applied",
      "failed",
      "pending",
      "failed",
    ]);
  });

  it("reads local Drizzle migration files without opening a connection", () => {
    const migrations = Effect.runSync(readPostgresLocalMigrations());

    expect(migrations).toEqual([
      expect.objectContaining({
        name: "20260712000000_initial_foundation",
      }),
    ]);
  });

  it("constructs status command effects without opening a connection", () => {
    expect(Effect.isEffect(getPostgresMigrationStatus())).toBe(true);
  });

  it("requires explicit confirmation before development reset or rollback", () => {
    const resetExit = Effect.runSyncExit(
      requirePostgresDevelopmentResetConfirmation("reset-development", false)
    );
    const rollbackExit = Effect.runSyncExit(
      requirePostgresDevelopmentResetConfirmation("rollback-development", false)
    );

    expect(extractFailureTags(resetExit)).toEqual([
      "PostgresMigrationCommandFailure",
    ]);
    expect(extractFailureTags(rollbackExit)).toEqual([
      "PostgresMigrationCommandFailure",
    ]);
  });

  it("creates a development reset SQL plan for adapter-owned objects only", () => {
    const plan = createPostgresDevelopmentResetPlan("reset-development");

    expect(plan.requiresConfirmation).toBe(true);
    expect(plan.statements).toEqual([
      'DROP TABLE IF EXISTS "commerce_outbox_dead_letter" CASCADE',
      'DROP TABLE IF EXISTS "commerce_outbox" CASCADE',
      'DROP TABLE IF EXISTS "commerce_migration_audit" CASCADE',
      'DROP SCHEMA IF EXISTS "drizzle" CASCADE',
    ]);
    expect(Effect.isEffect(resetPostgresDevelopmentDatabase())).toBe(true);
    expect(Effect.isEffect(rollbackPostgresDevelopmentDatabase())).toBe(true);
  });

  it("exposes package-local migration command scripts", () => {
    const packageJson = JSON.parse(
      readFileSync(join(import.meta.dir, "../../package.json"), "utf8")
    );

    expect(packageJson.scripts).toMatchObject({
      "db:migrate": "bun ./src/cli.ts migrate",
      "db:reset-development": "bun ./src/cli.ts reset-development",
      "db:rollback-development": "bun ./src/cli.ts rollback-development",
      "db:status": "bun ./src/cli.ts status",
    });
  });
});

const extractFailureTags = (exit: Exit.Exit<unknown, unknown>) => {
  if (!Exit.isFailure(exit)) {
    return [];
  }

  return exit.cause.reasons
    .filter(Cause.isFailReason)
    .map((reason) =>
      typeof reason.error === "object" &&
      reason.error !== null &&
      "_tag" in reason.error
        ? reason.error._tag
        : "UnknownFailure"
    );
};

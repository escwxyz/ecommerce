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
      expect.objectContaining({
        name: "20260719000000_store_module",
      }),
      expect.objectContaining({
        name: "20260720000000_customer_module",
      }),
      expect.objectContaining({
        name: "20260721000000_product_module",
      }),
      expect.objectContaining({
        name: "20260722000000_region_sales_channel_module",
      }),
      expect.objectContaining({
        name: "20260723000000_pricing_module",
      }),
      expect.objectContaining({
        name: "20260724000000_inventory_module",
      }),
      expect.objectContaining({
        name: "20260725000000_cart_module",
      }),
      expect.objectContaining({
        name: "20260726000000_promotion_module",
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
      'DROP TABLE IF EXISTS "cart_adjustment" CASCADE',
      'DROP TABLE IF EXISTS "cart_line_item" CASCADE',
      'DROP TABLE IF EXISTS "cart" CASCADE',
      'DROP TABLE IF EXISTS "promotion_redemption" CASCADE',
      'DROP TABLE IF EXISTS "promotion_usage_limit" CASCADE',
      'DROP TABLE IF EXISTS "promotion_rule" CASCADE',
      'DROP TABLE IF EXISTS "promotion_promotion" CASCADE',
      'DROP TABLE IF EXISTS "promotion_campaign" CASCADE',
      'DROP TABLE IF EXISTS "inventory_adjustment_event" CASCADE',
      'DROP TABLE IF EXISTS "inventory_reservation" CASCADE',
      'DROP TABLE IF EXISTS "inventory_level" CASCADE',
      'DROP TABLE IF EXISTS "inventory_stock_location" CASCADE',
      'DROP TABLE IF EXISTS "inventory_item" CASCADE',
      'DROP TABLE IF EXISTS "sales_channel_product" CASCADE',
      'DROP TABLE IF EXISTS "sales_channel" CASCADE',
      'DROP TABLE IF EXISTS "region_country" CASCADE',
      'DROP TABLE IF EXISTS "region" CASCADE',
      'DROP TABLE IF EXISTS "pricing_price_preference" CASCADE',
      'DROP TABLE IF EXISTS "pricing_price_rule" CASCADE',
      'DROP TABLE IF EXISTS "pricing_money_amount" CASCADE',
      'DROP TABLE IF EXISTS "pricing_price_list" CASCADE',
      'DROP TABLE IF EXISTS "pricing_price_set" CASCADE',
      'DROP TABLE IF EXISTS "pricing_currency" CASCADE',
      'DROP TABLE IF EXISTS "product" CASCADE',
      'DROP TABLE IF EXISTS "customer_group_customer" CASCADE',
      'DROP TABLE IF EXISTS "customer_group" CASCADE',
      'DROP TABLE IF EXISTS "customer_address" CASCADE',
      'DROP TABLE IF EXISTS "customer" CASCADE',
      'DROP TABLE IF EXISTS "store" CASCADE',
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

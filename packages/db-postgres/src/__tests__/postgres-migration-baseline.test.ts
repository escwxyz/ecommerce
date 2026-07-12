import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { Effect } from "effect";

import {
  commerceMigrationAuditTableName,
  commerceOutboxDeadLetterTableName,
  commerceOutboxTableName,
  createPostgresMigrationConfig,
  defaultPostgresMigrationsFolder,
  defaultPostgresMigrationsTable,
  postgresFoundationSchema,
  runPostgresMigrations,
} from "../index";

const baselineMigrationFolder = "20260712000000_initial_foundation";

describe("PostgreSQL Drizzle migration baseline", () => {
  it("exports the clean foundation schema tables", () => {
    expect(postgresFoundationSchema.commerceMigrationAudit).toBeDefined();
    expect(postgresFoundationSchema.commerceOutbox).toBeDefined();
    expect(postgresFoundationSchema.commerceOutboxDeadLetter).toBeDefined();
    expect(commerceMigrationAuditTableName).toBe("commerce_migration_audit");
    expect(commerceOutboxTableName).toBe("commerce_outbox");
    expect(commerceOutboxDeadLetterTableName).toBe(
      "commerce_outbox_dead_letter"
    );
  });

  it("ships a Drizzle runtime migration folder in the rc migrator format", () => {
    const migrationPath = join(
      defaultPostgresMigrationsFolder,
      baselineMigrationFolder,
      "migration.sql"
    );

    expect(existsSync(migrationPath)).toBe(true);

    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "commerce_outbox"');
    expect(sql).toContain("--> statement-breakpoint");
    expect(sql).not.toContain("kysely");
  });

  it("resolves default migration runner options", () => {
    expect(createPostgresMigrationConfig()).toEqual({
      migrationsFolder: defaultPostgresMigrationsFolder,
      migrationsSchema: undefined,
      migrationsTable: defaultPostgresMigrationsTable,
    });
  });

  it("constructs an Effect migration runner without opening a connection", () => {
    const program = runPostgresMigrations();

    expect(Effect.isEffect(program)).toBe(true);
  });
});

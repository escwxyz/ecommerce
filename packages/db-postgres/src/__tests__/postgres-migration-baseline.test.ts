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
  postgresCustomerTableName,
  postgresProductTableName,
  postgresStoreTableName,
  postgresFoundationSchema,
  runPostgresMigrations,
} from "../index";

const baselineMigrationFolder = "20260712000000_initial_foundation";
const storeMigrationFolder = "20260719000000_store_module";
const customerMigrationFolder = "20260720000000_customer_module";
const productMigrationFolder = "20260721000000_product_module";

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

  it("ships the store module PostgreSQL migration", () => {
    const migrationPath = join(
      defaultPostgresMigrationsFolder,
      storeMigrationFolder,
      "migration.sql"
    );

    expect(existsSync(migrationPath)).toBe(true);

    const sql = readFileSync(migrationPath, "utf8");

    expect(postgresStoreTableName).toBe("store");
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "store"');
    expect(sql).toContain('"supported_currency_codes_json" jsonb NOT NULL');
    expect(sql).toContain("--> statement-breakpoint");
    expect(sql).not.toContain("kysely");
  });

  it("ships the customer module PostgreSQL migration", () => {
    const migrationPath = join(
      defaultPostgresMigrationsFolder,
      customerMigrationFolder,
      "migration.sql"
    );

    expect(existsSync(migrationPath)).toBe(true);

    const sql = readFileSync(migrationPath, "utf8");

    expect(postgresCustomerTableName).toBe("customer");
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "customer"');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "customer_address"');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "customer_group"');
    expect(sql).toContain("--> statement-breakpoint");
    expect(sql).not.toContain("kysely");
  });

  it("ships the product module PostgreSQL migration", () => {
    const migrationPath = join(
      defaultPostgresMigrationsFolder,
      productMigrationFolder,
      "migration.sql"
    );

    expect(existsSync(migrationPath)).toBe(true);

    const sql = readFileSync(migrationPath, "utf8");

    expect(postgresProductTableName).toBe("product");
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "product"');
    expect(sql).toContain('"catalog_json" jsonb NOT NULL');
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

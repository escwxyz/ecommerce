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
  postgresCartTableName,
  postgresCustomerTableName,
  postgresInventoryItemTableName,
  postgresFulfillmentTableName,
  postgresProductTableName,
  postgresPromotionTableName,
  postgresTaxRegionTableName,
  postgresStoreTableName,
  postgresFoundationSchema,
  runPostgresMigrations,
} from "../index";

const baselineMigrationFolder = "20260712000000_initial_foundation";
const storeMigrationFolder = "20260719000000_store_module";
const customerMigrationFolder = "20260720000000_customer_module";
const productMigrationFolder = "20260721000000_product_module";
const inventoryMigrationFolder = "20260724000000_inventory_module";
const cartMigrationFolder = "20260725000000_cart_module";
const promotionMigrationFolder = "20260726000000_promotion_module";
const taxMigrationFolder = "20260727000000_tax_module";
const fulfillmentMigrationFolder = "20260728000000_fulfillment_module";

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

  it("ships the inventory module PostgreSQL migration", () => {
    const migrationPath = join(
      defaultPostgresMigrationsFolder,
      inventoryMigrationFolder,
      "migration.sql"
    );

    expect(existsSync(migrationPath)).toBe(true);

    const sql = readFileSync(migrationPath, "utf8");

    expect(postgresInventoryItemTableName).toBe("inventory_item");
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "inventory_item"');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "inventory_level"');
    expect(sql).toContain("--> statement-breakpoint");
    expect(sql).not.toContain("kysely");
  });

  it("ships the cart module PostgreSQL migration", () => {
    const migrationPath = join(
      defaultPostgresMigrationsFolder,
      cartMigrationFolder,
      "migration.sql"
    );

    expect(existsSync(migrationPath)).toBe(true);

    const sql = readFileSync(migrationPath, "utf8");

    expect(postgresCartTableName).toBe("cart");
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "cart"');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "cart_line_item"');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "cart_adjustment"');
    expect(sql).toContain("--> statement-breakpoint");
    expect(sql).not.toContain("kysely");
  });

  it("ships the promotion module PostgreSQL migration", () => {
    const migrationPath = join(
      defaultPostgresMigrationsFolder,
      promotionMigrationFolder,
      "migration.sql"
    );

    expect(existsSync(migrationPath)).toBe(true);

    const sql = readFileSync(migrationPath, "utf8");

    expect(postgresPromotionTableName).toBe("promotion_promotion");
    expect(sql).toContain('CREATE TABLE "promotion_campaign"');
    expect(sql).toContain('CREATE TABLE "promotion_promotion"');
    expect(sql).toContain('CREATE TABLE "promotion_rule"');
    expect(sql).toContain('CREATE TABLE "promotion_usage_limit"');
    expect(sql).toContain('CREATE TABLE "promotion_redemption"');
    expect(sql).toContain("--> statement-breakpoint");
    expect(sql).not.toContain("kysely");
  });

  it("ships the tax module PostgreSQL migration", () => {
    const migrationPath = join(
      defaultPostgresMigrationsFolder,
      taxMigrationFolder,
      "migration.sql"
    );

    expect(existsSync(migrationPath)).toBe(true);

    const sql = readFileSync(migrationPath, "utf8");

    expect(postgresTaxRegionTableName).toBe("tax_region");
    expect(sql).toContain('CREATE TABLE "tax_category"');
    expect(sql).toContain('CREATE TABLE "tax_provider_config"');
    expect(sql).toContain('CREATE TABLE "tax_region"');
    expect(sql).toContain('CREATE TABLE "tax_rate"');
    expect(sql).toContain("--> statement-breakpoint");
    expect(sql).not.toContain("kysely");
  });

  it("ships the fulfillment module PostgreSQL migration", () => {
    const migrationPath = join(
      defaultPostgresMigrationsFolder,
      fulfillmentMigrationFolder,
      "migration.sql"
    );

    expect(existsSync(migrationPath)).toBe(true);

    const sql = readFileSync(migrationPath, "utf8");

    expect(postgresFulfillmentTableName).toBe("fulfillment");
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "fulfillment_provider"');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "fulfillment_set"');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "shipping_option"');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "fulfillment"');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "shipment"');
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

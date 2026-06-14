import { Database, type SQLQueryBindings } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { D1Database } from "@cloudflare/workers-types";
import { columnExists, indexExists, tableExists } from "@ecommerce/db";

import { createD1Database, migrateD1ToLatest } from "./index";

const createFakeBinding = (): D1Database =>
  ({
    prepare: () => ({
      bind: () => ({
        all: () =>
          Promise.resolve({
            meta: { changes: 0, last_row_id: 0 },
            results: [],
            success: true,
          }),
      }),
    }),
  }) as unknown as D1Database;

const createSqliteBackedFakeBinding = (sqlite: Database): D1Database =>
  ({
    batch: async (statements: readonly FakeD1PreparedStatement[]) =>
      Promise.all(statements.map((statement) => statement.all())),
    exec: async (query: string) => {
      sqlite.exec(query);
      return { count: 0, duration: 0 };
    },
    prepare: (query: string) => new FakeD1PreparedStatement(sqlite, query),
  }) as unknown as D1Database;

class FakeD1PreparedStatement {
  readonly #query: string;
  readonly #sqlite: Database;
  readonly #values: readonly SQLQueryBindings[];

  constructor(
    sqlite: Database,
    query: string,
    values: readonly SQLQueryBindings[] = []
  ) {
    this.#query = query;
    this.#sqlite = sqlite;
    this.#values = values;
  }

  bind(...values: readonly SQLQueryBindings[]): FakeD1PreparedStatement {
    return new FakeD1PreparedStatement(this.#sqlite, this.#query, values);
  }

  all() {
    const normalizedQuery = this.#query.trim().toLowerCase();
    const statement = this.#sqlite.query(this.#query);

    if (
      normalizedQuery.startsWith("select") ||
      normalizedQuery.startsWith("pragma")
    ) {
      return Promise.resolve({
        meta: { changes: 0, last_row_id: 0 },
        results: statement.all(...this.#values),
        success: true,
      });
    }

    const result = statement.run(...this.#values);
    return Promise.resolve({
      meta: {
        changes: result.changes,
        last_row_id: Number(result.lastInsertRowid),
      },
      results: [],
      success: true,
    });
  }
}

describe("db d1 adapter", () => {
  it("creates a Kysely runtime from an explicit D1 binding", () => {
    const database = createD1Database(createFakeBinding());

    expect(database.db).toBeDefined();
    expect(database.authDatabase).toBeDefined();
    expect(database.supportsRequestScope).toBe(true);
    expect(database.type).toBe("sqlite");
  });

  it("exposes a migration runner for the D1-backed Kysely runtime", async () => {
    const database = createD1Database(createFakeBinding());
    const result = await migrateD1ToLatest(database.db);

    expect(result).toHaveProperty("results");
    await expect(tableExists(database.db, "product")).resolves.toBe(false);
  });

  it("applies the commerce auth and product migrations on D1-compatible SQLite", async () => {
    const sqlite = new Database(":memory:");
    const database = createD1Database(createSqliteBackedFakeBinding(sqlite));

    const result = await migrateD1ToLatest(database.db);

    expect(result.error).toBeUndefined();
    await expect(tableExists(database.db, "user")).resolves.toBe(true);
    await expect(tableExists(database.db, "session")).resolves.toBe(true);
    await expect(tableExists(database.db, "account")).resolves.toBe(true);
    await expect(tableExists(database.db, "verification")).resolves.toBe(true);
    await expect(tableExists(database.db, "product")).resolves.toBe(true);
    await expect(columnExists(database.db, "user", "role")).resolves.toBe(true);
    await expect(columnExists(database.db, "user", "banned")).resolves.toBe(
      true
    );
    await expect(
      columnExists(database.db, "session", "impersonatedBy")
    ).resolves.toBe(true);
    await expect(indexExists(database.db, "session_userId_idx")).resolves.toBe(
      true
    );
    await expect(tableExists(database.db, "store")).resolves.toBe(true);
    await expect(indexExists(database.db, "product_handle_idx")).resolves.toBe(
      true
    );
    await expect(tableExists(database.db, "customer")).resolves.toBe(true);
    await expect(tableExists(database.db, "customer_address")).resolves.toBe(
      true
    );
    await expect(tableExists(database.db, "customer_group")).resolves.toBe(
      true
    );
    await expect(
      tableExists(database.db, "customer_group_customer")
    ).resolves.toBe(true);
    await expect(indexExists(database.db, "customer_email_idx")).resolves.toBe(
      true
    );
    await expect(
      indexExists(database.db, "customer_auth_user_id_idx")
    ).resolves.toBe(true);
    await expect(tableExists(database.db, "region")).resolves.toBe(true);
    await expect(tableExists(database.db, "sales_channel")).resolves.toBe(true);
    await expect(tableExists(database.db, "pricing_currency")).resolves.toBe(
      true
    );
    await expect(tableExists(database.db, "promotion_promotion")).resolves.toBe(
      true
    );
    await expect(tableExists(database.db, "tax_region")).resolves.toBe(true);
    await expect(tableExists(database.db, "tax_rate")).resolves.toBe(true);
    await expect(tableExists(database.db, "payment_collection")).resolves.toBe(
      true
    );
    await expect(tableExists(database.db, "payment_session")).resolves.toBe(
      true
    );
    await expect(
      indexExists(database.db, "payment_provider_intent_idx")
    ).resolves.toBe(true);

    sqlite.close();
  });

  it("ships SQL migrations for normalized product catalog tables", () => {
    const sqlite = new Database(":memory:");
    const migrationsDir = join(import.meta.dir, "migrations", "sql");

    sqlite.exec(readFileSync(join(migrationsDir, "0001_product.sql"), "utf8"));
    sqlite.exec(
      readFileSync(join(migrationsDir, "0002_product_catalog.sql"), "utf8")
    );

    expect(
      sqlite
        .query("select name from sqlite_master where type = 'table'")
        .all()
        .map((row) => (row as { name: string }).name)
    ).toEqual(
      expect.arrayContaining([
        "product",
        "product_variant",
        "product_option",
        "product_option_value",
        "product_variant_option",
        "product_collection",
        "product_collection_product",
        "product_category",
        "product_category_product",
        "product_media",
        "product_tag",
        "product_tags",
        "product_type",
        "product_type_product",
      ])
    );

    sqlite.close();
  });

  it("ships SQL migrations for promotion tables", () => {
    const sqlite = new Database(":memory:");
    const migrationsDir = join(import.meta.dir, "migrations", "sql");

    sqlite.exec(readFileSync(join(migrationsDir, "0001_product.sql"), "utf8"));
    sqlite.exec(
      readFileSync(join(migrationsDir, "0002_product_catalog.sql"), "utf8")
    );
    sqlite.exec(
      readFileSync(join(migrationsDir, "0003_promotion.sql"), "utf8")
    );

    expect(
      sqlite
        .query("select name from sqlite_master where type = 'table'")
        .all()
        .map((row) => (row as { name: string }).name)
    ).toEqual(
      expect.arrayContaining([
        "promotion_campaign",
        "promotion_promotion",
        "promotion_rule",
        "promotion_usage_limit",
        "promotion_redemption",
      ])
    );
    expect(
      sqlite
        .query("select name from sqlite_master where type = 'index'")
        .all()
        .map((row) => (row as { name: string }).name)
    ).toEqual(
      expect.arrayContaining([
        "promotion_code_idx",
        "promotion_rule_promotion_idx",
        "promotion_usage_limit_promotion_idx",
        "promotion_redemption_promotion_idx",
      ])
    );

    sqlite.close();
  });

  it("ships SQL migrations for pricing tables", () => {
    const sqlite = new Database(":memory:");
    const migrationsDir = join(import.meta.dir, "migrations", "sql");

    sqlite.exec(readFileSync(join(migrationsDir, "0001_product.sql"), "utf8"));
    sqlite.exec(
      readFileSync(join(migrationsDir, "0002_product_catalog.sql"), "utf8")
    );
    sqlite.exec(
      readFileSync(join(migrationsDir, "0003_promotion.sql"), "utf8")
    );
    sqlite.exec(readFileSync(join(migrationsDir, "0004_pricing.sql"), "utf8"));

    expect(
      sqlite
        .query("select name from sqlite_master where type = 'table'")
        .all()
        .map((row) => (row as { name: string }).name)
    ).toEqual(
      expect.arrayContaining([
        "pricing_currency",
        "pricing_price_set",
        "pricing_price_list",
        "pricing_money_amount",
        "pricing_price_rule",
        "pricing_price_preference",
      ])
    );
    expect(
      sqlite
        .query("select name from sqlite_master where type = 'index'")
        .all()
        .map((row) => (row as { name: string }).name)
    ).toEqual(
      expect.arrayContaining([
        "pricing_money_amount_price_set_idx",
        "pricing_price_rule_price_list_idx",
        "pricing_price_preference_scope_idx",
      ])
    );

    sqlite.close();
  });

  it("ships SQL migrations for store and region sales-channel tables", () => {
    const sqlite = new Database(":memory:");
    const migrationsDir = join(import.meta.dir, "migrations", "sql");

    sqlite.exec(readFileSync(join(migrationsDir, "0005_store.sql"), "utf8"));
    sqlite.exec(
      readFileSync(join(migrationsDir, "0006_region_sales_channel.sql"), "utf8")
    );

    expect(
      sqlite
        .query("select name from sqlite_master where type = 'table'")
        .all()
        .map((row) => (row as { name: string }).name)
    ).toEqual(
      expect.arrayContaining([
        "store",
        "region",
        "region_country",
        "sales_channel",
        "sales_channel_product",
      ])
    );
    expect(
      sqlite
        .query("select name from sqlite_master where type = 'index'")
        .all()
        .map((row) => (row as { name: string }).name)
    ).toEqual(
      expect.arrayContaining([
        "region_country_region_idx",
        "sales_channel_product_channel_idx",
      ])
    );

    sqlite.close();
  });

  it("ships SQL migrations for customer tables", () => {
    const sqlite = new Database(":memory:");
    const migrationsDir = join(import.meta.dir, "migrations", "sql");

    sqlite.exec(readFileSync(join(migrationsDir, "0007_customer.sql"), "utf8"));

    expect(
      sqlite
        .query("select name from sqlite_master where type = 'table'")
        .all()
        .map((row) => (row as { name: string }).name)
    ).toEqual(
      expect.arrayContaining([
        "customer",
        "customer_address",
        "customer_group",
        "customer_group_customer",
      ])
    );
    expect(
      sqlite
        .query("select name from sqlite_master where type = 'index'")
        .all()
        .map((row) => (row as { name: string }).name)
    ).toEqual(
      expect.arrayContaining([
        "customer_email_idx",
        "customer_auth_user_id_idx",
        "customer_address_customer_id_idx",
        "customer_group_handle_idx",
      ])
    );

    sqlite.close();
  });

  it("ships SQL migrations for inventory tables", () => {
    const sqlite = new Database(":memory:");
    const migrationsDir = join(import.meta.dir, "migrations", "sql");

    sqlite.exec(
      readFileSync(join(migrationsDir, "0008_inventory.sql"), "utf8")
    );

    expect(
      sqlite
        .query("select name from sqlite_master where type = 'table'")
        .all()
        .map((row) => (row as { name: string }).name)
    ).toEqual(
      expect.arrayContaining([
        "inventory_item",
        "inventory_stock_location",
        "inventory_level",
        "inventory_reservation",
        "inventory_adjustment_event",
      ])
    );
    expect(
      sqlite
        .query("select name from sqlite_master where type = 'index'")
        .all()
        .map((row) => (row as { name: string }).name)
    ).toEqual(
      expect.arrayContaining([
        "inventory_item_sku_idx",
        "inventory_level_scope_idx",
        "inventory_reservation_idempotency_idx",
        "inventory_reservation_level_idx",
      ])
    );

    sqlite.close();
  });

  it("ships SQL migrations for tax tables", () => {
    const sqlite = new Database(":memory:");
    const migrationsDir = join(import.meta.dir, "migrations", "sql");

    sqlite.exec(readFileSync(join(migrationsDir, "0009_tax.sql"), "utf8"));

    expect(
      sqlite
        .query("select name from sqlite_master where type = 'table'")
        .all()
        .map((row) => (row as { name: string }).name)
    ).toEqual(
      expect.arrayContaining([
        "tax_category",
        "tax_provider_config",
        "tax_region",
        "tax_rate",
        "tax_calculation_policy",
      ])
    );
    expect(
      sqlite
        .query("select name from sqlite_master where type = 'index'")
        .all()
        .map((row) => (row as { name: string }).name)
    ).toEqual(
      expect.arrayContaining([
        "tax_category_code_idx",
        "tax_provider_config_key_idx",
        "tax_region_code_idx",
        "tax_rate_region_idx",
        "tax_rate_category_idx",
      ])
    );

    sqlite.close();
  });

  it("applies the SQL migration directory used by db:push through tax", () => {
    const sqlite = new Database(":memory:");
    const migrationsDir = join(import.meta.dir, "migrations", "sql");

    for (const migrationFile of readdirSync(migrationsDir).sort()) {
      if (migrationFile.endsWith(".sql")) {
        sqlite.exec(readFileSync(join(migrationsDir, migrationFile), "utf8"));
      }
    }

    expect(
      sqlite
        .query("select name from sqlite_master where type = 'table'")
        .all()
        .map((row) => (row as { name: string }).name)
    ).toEqual(
      expect.arrayContaining([
        "customer",
        "customer_address",
        "customer_group",
        "customer_group_customer",
        "product",
        "store",
        "region",
        "inventory_item",
        "inventory_level",
        "inventory_reservation",
        "tax_category",
        "tax_provider_config",
        "tax_region",
        "tax_rate",
        "tax_calculation_policy",
      ])
    );

    sqlite.close();
  });
});

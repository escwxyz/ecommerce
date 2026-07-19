import { Database, type SQLQueryBindings } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { D1Database } from "@cloudflare/workers-types";
import { columnExists, indexExists, tableExists } from "@ecommerce/db/legacy";

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

  it("applies the commerce auth and legacy module migrations on D1-compatible SQLite", async () => {
    const sqlite = new Database(":memory:");
    const database = createD1Database(createSqliteBackedFakeBinding(sqlite));

    const result = await migrateD1ToLatest(database.db);

    expect(result.error).toBeUndefined();
    await expect(tableExists(database.db, "user")).resolves.toBe(true);
    await expect(tableExists(database.db, "session")).resolves.toBe(true);
    await expect(tableExists(database.db, "account")).resolves.toBe(true);
    await expect(tableExists(database.db, "verification")).resolves.toBe(true);
    await expect(tableExists(database.db, "product")).resolves.toBe(false);
    await expect(tableExists(database.db, "product_variant")).resolves.toBe(
      false
    );
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
    await expect(tableExists(database.db, "region")).resolves.toBe(false);
    await expect(tableExists(database.db, "sales_channel")).resolves.toBe(
      false
    );
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
    await expect(tableExists(database.db, "fulfillment_set")).resolves.toBe(
      true
    );
    await expect(tableExists(database.db, "shipping_option")).resolves.toBe(
      true
    );
    await expect(tableExists(database.db, "shipment")).resolves.toBe(true);
    await expect(
      indexExists(database.db, "fulfillment_idempotency_idx")
    ).resolves.toBe(true);
    await expect(tableExists(database.db, "event_outbox")).resolves.toBe(true);
    await expect(tableExists(database.db, "event_dead_letter")).resolves.toBe(
      true
    );
    await expect(
      tableExists(database.db, "notification_dispatch")
    ).resolves.toBe(true);
    await expect(
      indexExists(database.db, "notification_dispatch_idempotency_idx")
    ).resolves.toBe(true);
    await expect(tableExists(database.db, "cart")).resolves.toBe(true);
    await expect(tableExists(database.db, "cart_line_item")).resolves.toBe(
      true
    );
    await expect(tableExists(database.db, "cart_adjustment")).resolves.toBe(
      true
    );
    await expect(indexExists(database.db, "cart_customer_idx")).resolves.toBe(
      true
    );
    await expect(tableExists(database.db, "order_record")).resolves.toBe(true);
    await expect(tableExists(database.db, "order_line_item")).resolves.toBe(
      true
    );
    await expect(tableExists(database.db, "order_transaction")).resolves.toBe(
      true
    );
    await expect(
      tableExists(database.db, "order_state_transition")
    ).resolves.toBe(true);
    await expect(
      tableExists(database.db, "order_post_purchase_operation")
    ).resolves.toBe(true);
    await expect(indexExists(database.db, "order_cart_id_idx")).resolves.toBe(
      true
    );
    await expect(
      indexExists(database.db, "order_line_item_order_id_idx")
    ).resolves.toBe(true);

    sqlite.close();
  });

  it("ships SQL migrations for promotion tables", () => {
    const sqlite = new Database(":memory:");
    const migrationsDir = join(import.meta.dir, "migrations", "sql");

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

  it("ships SQL migrations for payment tables", () => {
    const sqlite = new Database(":memory:");
    const migrationsDir = join(import.meta.dir, "migrations", "sql");

    sqlite.exec(readFileSync(join(migrationsDir, "0010_payment.sql"), "utf8"));

    expect(
      sqlite
        .query("select name from sqlite_master where type = 'table'")
        .all()
        .map((row) => (row as { name: string }).name)
    ).toEqual(
      expect.arrayContaining([
        "payment_provider",
        "payment_account_holder",
        "payment_method",
        "payment_collection",
        "payment_session",
        "payment",
        "payment_capture",
        "payment_refund",
      ])
    );
    expect(
      sqlite
        .query("select name from sqlite_master where type = 'index'")
        .all()
        .map((row) => (row as { name: string }).name)
    ).toEqual(
      expect.arrayContaining([
        "payment_provider_key_idx",
        "payment_account_holder_provider_idx",
        "payment_method_account_holder_idx",
        "payment_collection_status_idx",
        "payment_session_collection_idx",
        "payment_provider_intent_idx",
        "payment_capture_idempotency_idx",
        "payment_refund_idempotency_idx",
      ])
    );

    sqlite.close();
  });

  it("ships SQL migrations for fulfillment tables", () => {
    const sqlite = new Database(":memory:");
    const migrationsDir = join(import.meta.dir, "migrations", "sql");

    sqlite.exec(
      readFileSync(join(migrationsDir, "0011_fulfillment.sql"), "utf8")
    );

    expect(
      sqlite
        .query("select name from sqlite_master where type = 'table'")
        .all()
        .map((row) => (row as { name: string }).name)
    ).toEqual(
      expect.arrayContaining([
        "fulfillment_provider",
        "fulfillment_set",
        "shipping_profile",
        "service_zone",
        "shipping_option",
        "fulfillment",
        "shipment",
        "return_shipment_link",
      ])
    );
    expect(
      sqlite
        .query("select name from sqlite_master where type = 'index'")
        .all()
        .map((row) => (row as { name: string }).name)
    ).toEqual(
      expect.arrayContaining([
        "fulfillment_provider_key_idx",
        "shipping_profile_set_idx",
        "service_zone_set_idx",
        "shipping_option_set_idx",
        "shipping_option_provider_idx",
        "fulfillment_idempotency_idx",
        "fulfillment_order_idx",
        "shipment_fulfillment_idx",
        "return_shipment_fulfillment_idx",
      ])
    );

    sqlite.close();
  });

  it("ships SQL migrations for notification-event tables", () => {
    const sqlite = new Database(":memory:");
    const migrationsDir = join(import.meta.dir, "migrations", "sql");

    sqlite.exec(
      readFileSync(join(migrationsDir, "0012_notification_event.sql"), "utf8")
    );

    expect(
      sqlite
        .query("select name from sqlite_master where type = 'table'")
        .all()
        .map((row) => (row as { name: string }).name)
    ).toEqual(
      expect.arrayContaining([
        "event_outbox",
        "event_dead_letter",
        "notification_template",
        "notification_dispatch",
        "notification_provider",
      ])
    );
    expect(
      sqlite
        .query("select name from sqlite_master where type = 'index'")
        .all()
        .map((row) => (row as { name: string }).name)
    ).toEqual(
      expect.arrayContaining([
        "event_outbox_status_idx",
        "event_dead_letter_event_idx",
        "notification_template_key_idx",
        "notification_provider_key_idx",
        "notification_dispatch_idempotency_idx",
      ])
    );

    sqlite.close();
  });

  it("ships SQL migrations for cart tables", () => {
    const sqlite = new Database(":memory:");
    const migrationsDir = join(import.meta.dir, "migrations", "sql");

    sqlite.exec(readFileSync(join(migrationsDir, "0013_cart.sql"), "utf8"));

    expect(
      sqlite
        .query("select name from sqlite_master where type = 'table'")
        .all()
        .map((row) => (row as { name: string }).name)
    ).toEqual(
      expect.arrayContaining(["cart", "cart_line_item", "cart_adjustment"])
    );
    expect(
      sqlite
        .query("select name from sqlite_master where type = 'index'")
        .all()
        .map((row) => (row as { name: string }).name)
    ).toEqual(
      expect.arrayContaining([
        "cart_customer_idx",
        "cart_line_item_cart_idx",
        "cart_line_item_idempotency_idx",
        "cart_adjustment_cart_idx",
        "cart_adjustment_idempotency_idx",
      ])
    );

    sqlite.close();
  });

  it("ships SQL migrations for order tables", () => {
    const sqlite = new Database(":memory:");
    const migrationsDir = join(import.meta.dir, "migrations", "sql");

    sqlite.exec(readFileSync(join(migrationsDir, "0014_order.sql"), "utf8"));

    expect(
      sqlite
        .query("select name from sqlite_master where type = 'table'")
        .all()
        .map((row) => (row as { name: string }).name)
    ).toEqual(
      expect.arrayContaining([
        "order_record",
        "order_line_item",
        "order_transaction",
        "order_state_transition",
        "order_post_purchase_operation",
      ])
    );
    expect(
      sqlite
        .query("select name from sqlite_master where type = 'index'")
        .all()
        .map((row) => (row as { name: string }).name)
    ).toEqual(
      expect.arrayContaining([
        "order_cart_id_idx",
        "order_customer_id_idx",
        "order_line_item_order_id_idx",
        "order_transaction_order_id_idx",
      ])
    );

    sqlite.close();
  });

  it("applies the SQL migration directory used by db:push through order", () => {
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
        "inventory_item",
        "inventory_level",
        "inventory_reservation",
        "tax_category",
        "tax_provider_config",
        "tax_region",
        "tax_rate",
        "tax_calculation_policy",
        "payment_provider",
        "payment_account_holder",
        "payment_method",
        "payment_collection",
        "payment_session",
        "payment",
        "payment_capture",
        "payment_refund",
        "fulfillment_provider",
        "fulfillment_set",
        "shipping_profile",
        "service_zone",
        "shipping_option",
        "fulfillment",
        "shipment",
        "return_shipment_link",
        "event_outbox",
        "event_dead_letter",
        "notification_template",
        "notification_dispatch",
        "notification_provider",
        "cart",
        "cart_line_item",
        "cart_adjustment",
        "order_record",
        "order_line_item",
        "order_transaction",
        "order_state_transition",
        "order_post_purchase_operation",
      ])
    );

    sqlite.close();
  });
});

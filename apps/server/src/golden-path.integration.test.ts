import { Database, type SQLQueryBindings } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { AuthService } from "@ecommerce/auth";
import { createStoreAdminAuthSession } from "@ecommerce/auth/testing";
import { createD1Database } from "@ecommerce/db-d1";
import {
  developmentSeedIds,
  generateDevelopmentSeedSql,
} from "@ecommerce/db-d1/seed";
import { Effect } from "effect";

import {
  createDevelopmentCommerceProviderRegistries,
  createServerCommerceRuntime,
} from "./commerce-runtime";

const auth = {
  api: {
    getSession: async () => null,
  },
  handler: () => new Response("auth-mounted"),
} as AuthService;

const adminSession = createStoreAdminAuthSession({
  permissions: ["cart:read", "cart:write", "checkout:execute", "checkout:read"],
});

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

const createFakeD1Binding = (sqlite: Database) => ({
  batch: async (statements: readonly FakeD1PreparedStatement[]) =>
    Promise.all(statements.map((statement) => statement.all())),
  exec: async (query: string) => {
    sqlite.exec(query);
    return { count: 0, duration: 0 };
  },
  prepare: (query: string) => new FakeD1PreparedStatement(sqlite, query),
});

const createMigratedSeededDatabase = (): Database => {
  const sqlite = new Database(":memory:");
  const migrationsDirectory = join(
    import.meta.dir,
    "../../../packages/db-d1/src/migrations/sql"
  );

  sqlite.exec("PRAGMA foreign_keys = ON;");
  for (const migrationFile of readdirSync(migrationsDirectory).sort()) {
    if (migrationFile.endsWith(".sql")) {
      sqlite.exec(
        readFileSync(join(migrationsDirectory, migrationFile), "utf8")
      );
    }
  }
  sqlite.exec(generateDevelopmentSeedSql());
  return sqlite;
};

const createDeterministicIdGenerator = () => {
  let sequence = 0;
  return {
    nextId: () => {
      sequence += 1;
      return `golden_${sequence}`;
    },
  };
};

describe("server golden checkout path", () => {
  it("persists checkout outcomes through the Effect checkout boundary with temporary downstream facade support", async () => {
    const sqlite = createMigratedSeededDatabase();
    const database = createD1Database(
      createFakeD1Binding(sqlite) as unknown as D1Database
    );
    const runtime = createServerCommerceRuntime({
      ...createDevelopmentCommerceProviderRegistries(),
      clock: { now: () => new Date("2026-01-02T00:00:00.000Z") },
      db: database.db,
      idGenerator: createDeterministicIdGenerator(),
    });
    expect(
      auth.handler(new Request("https://commerce.example/auth"))
    ).toBeInstanceOf(Response);
    expect(adminSession.user.permissions).toContain("checkout:execute");
    const checkoutService = runtime.services.checkout;
    if (!checkoutService) {
      throw new Error("Expected checkout service to be configured.");
    }
    try {
      const cart = await Effect.runPromise(
        runtime.services.cart.createCart({
          currencyCode: "USD",
          customerId: developmentSeedIds.customer,
          email: "ada.dev@example.com",
          regionId: developmentSeedIds.region,
          salesChannelId: developmentSeedIds.salesChannel,
        })
      );
      await Effect.runPromise(
        runtime.services.cart.setAddresses({
          cartId: cart.id,
          correlationId: "golden-address",
          idempotencyKey: "golden-address",
          shippingAddress: {
            address1: "1 Development Way",
            city: "New York",
            countryCode: "US",
            firstName: "Ada",
            lastName: "Lovelace",
            postalCode: "10001",
            province: "NY",
          },
        })
      );
      await Effect.runPromise(
        runtime.services.cart.addLineItem({
          cartId: cart.id,
          correlationId: "golden-line",
          idempotencyKey: "golden-line",
          metadata: {
            inventoryItemId: developmentSeedIds.inventoryItem,
            priceSetId: developmentSeedIds.priceSet,
            sku: "DEV-TSHIRT-BLACK",
            stockLocationId: developmentSeedIds.stockLocation,
            taxCategoryId: developmentSeedIds.taxCategory,
          },
          productId: developmentSeedIds.product,
          quantity: 1,
          title: "Development T-Shirt - Black",
          unitPrice: 2500,
          variantId: developmentSeedIds.productVariant,
        })
      );

      const checkout = await Effect.runPromise(
        checkoutService.completeCheckout({
          cartId: cart.id,
          correlationId: "golden-checkout",
          idempotencyKey: "golden-checkout",
          payment: {
            capture: true,
            providerKey: "manual",
          },
          shippingOptionId: developmentSeedIds.fulfillmentOption,
        })
      );
      const retry = await Effect.runPromise(
        checkoutService.completeCheckout({
          cartId: cart.id,
          correlationId: "golden-checkout-retry",
          idempotencyKey: "golden-checkout",
          payment: {
            capture: true,
            providerKey: "manual",
          },
          shippingOptionId: developmentSeedIds.fulfillmentOption,
        })
      );

      expect(checkout).toMatchObject({
        cartId: cart.id,
        status: "completed",
        workflowRunId: "golden-checkout",
      });
      expect(checkout.orderId).toStartWith("ord_");
      expect(checkout.paymentId).toStartWith("pay_");
      expect(checkout.fulfillmentIds).toHaveLength(1);
      expect(retry).toEqual(checkout);

      const persisted = sqlite
        .query<
          {
            event_name: string;
            order_cart_id: string;
            order_customer_id: string;
            order_id: string;
            order_product_id: string;
          },
          [string]
        >(
          `SELECT
            o.id AS order_id,
            o.cart_id AS order_cart_id,
            o.customer_id AS order_customer_id,
            json_extract(oli.item_snapshot, '$.productId') AS order_product_id,
            eo.event_name AS event_name
          FROM order_record o
          JOIN order_line_item oli ON oli.order_id = o.id
          JOIN event_outbox eo ON eo.workflow_run_id = 'golden-checkout'
            AND eo.event_name = 'checkout.completed'
          WHERE o.cart_id = ?`
        )
        .get(cart.id);

      const completedCart = await Effect.runPromise(
        runtime.services.cart.getCart(cart.id)
      );

      expect(completedCart?.cart.paymentCollectionId).toStartWith("paycol_");
      expect(completedCart?.cart).toMatchObject({
        customerId: developmentSeedIds.customer,
        currencyCode: "USD",
        regionId: developmentSeedIds.region,
        salesChannelId: developmentSeedIds.salesChannel,
        shippingOptionId: developmentSeedIds.fulfillmentOption,
      });
      expect({
        ...completedCart?.cart.totals,
        adjustmentTotal: Math.abs(
          completedCart?.cart.totals.adjustmentTotal ?? 0
        ),
      }).toEqual({
        adjustmentTotal: 0,
        currencyCode: "USD",
        discountTotal: 0,
        giftCardTotal: 0,
        itemSubtotal: 2500,
        shippingTotal: 500,
        subtotal: 2500,
        taxTotal: 206,
        total: 3206,
      });

      expect(persisted).toMatchObject({
        event_name: "checkout.completed",
        order_cart_id: cart.id,
        order_customer_id: developmentSeedIds.customer,
        order_id: checkout.orderId,
        order_product_id: developmentSeedIds.product,
      });
    } finally {
      await database.db.destroy();
      sqlite.close();
    }
  });
});

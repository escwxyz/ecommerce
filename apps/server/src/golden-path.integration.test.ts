import { Database, type SQLQueryBindings } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { authorizationEvaluator } from "@ecommerce/api";
import type { AuthService } from "@ecommerce/auth";
import { createStoreAdminAuthSession } from "@ecommerce/auth/testing";
import { createD1Database } from "@ecommerce/db-d1";
import {
  developmentSeedIds,
  generateDevelopmentSeedSql,
} from "@ecommerce/db-d1/seed";
import { Effect } from "effect";

import { createServerApp } from "./app";
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

const callRpc = async <Output>({
  app,
  input,
  operation,
}: {
  readonly app: ReturnType<typeof createServerApp>;
  readonly input: unknown;
  readonly operation: string;
}): Promise<Output> => {
  const response = await app.request(`/rpc/${operation}`, {
    body: JSON.stringify({ json: input }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(
      `RPC ${operation} failed with ${response.status}: ${await response.text()}`
    );
  }

  const payload = (await response.json()) as { readonly json: Output };
  return payload.json;
};

describe("server golden checkout path", () => {
  it("persists checkout outcomes through the server transport with temporary fulfillment facade support", async () => {
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
    const app = createServerApp({
      apiAssembly: runtime.apiAssembly,
      auth,
      corsOrigin: "http://localhost:3001",
      createContext: async ({ auth: requestAuth }) => ({
        auth: requestAuth,
        authorization: authorizationEvaluator,
        session: adminSession,
      }),
    });
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

      const checkout = await callRpc<{
        readonly cartId: string;
        readonly fulfillmentIds: readonly string[];
        readonly orderId: string;
        readonly paymentId: string;
        readonly status: string;
        readonly workflowRunId: string;
      }>({
        app,
        operation: "checkoutComplete",
        input: {
          cartId: cart.id,
          correlationId: "golden-checkout",
          idempotencyKey: "golden-checkout",
          payment: {
            capture: true,
            providerKey: "manual",
          },
          shippingOptionId: developmentSeedIds.fulfillmentOption,
        },
      });
      const retry = await callRpc<typeof checkout>({
        app,
        operation: "checkoutComplete",
        input: {
          cartId: cart.id,
          correlationId: "golden-checkout-retry",
          idempotencyKey: "golden-checkout",
          payment: {
            capture: true,
            providerKey: "manual",
          },
          shippingOptionId: developmentSeedIds.fulfillmentOption,
        },
      });

      expect(checkout).toMatchObject({
        cartId: cart.id,
        status: "completed",
        workflowRunId: "golden-checkout",
      });
      expect(checkout.orderId).toStartWith("ord_");
      expect(checkout.paymentId).toStartWith("pay_");
      expect(checkout.fulfillmentIds).toHaveLength(1);
      expect(retry).toEqual(checkout);

      const retryCounts = sqlite
        .query<
          {
            collection_count: number;
            session_count: number;
          },
          [string]
        >(
          `SELECT
            COUNT(DISTINCT pcl.id) AS collection_count,
            COUNT(DISTINCT ps.id) AS session_count
          FROM payment_collection pcl
          JOIN payment_session ps ON ps.collection_id = pcl.id
          WHERE pcl.cart_id = ?`
        )
        .get(cart.id);
      expect(retryCounts).toEqual({
        collection_count: 1,
        session_count: 1,
      });

      const persisted = sqlite
        .query<
          {
            capture_status: string;
            event_name: string;
            order_cart_id: string;
            order_customer_id: string;
            order_id: string;
            order_product_id: string;
            payment_collection_status: string;
            payment_id: string;
            payment_session_status: string;
            payment_status: string;
          },
          [string]
        >(
          `SELECT
            o.id AS order_id,
            o.cart_id AS order_cart_id,
            o.customer_id AS order_customer_id,
            json_extract(oli.item_snapshot, '$.productId') AS order_product_id,
            pcl.status AS payment_collection_status,
            ps.status AS payment_session_status,
            p.id AS payment_id,
            p.status AS payment_status,
            pc.status AS capture_status,
            eo.event_name AS event_name
          FROM order_record o
          JOIN order_line_item oli ON oli.order_id = o.id
          JOIN payment_collection pcl ON pcl.cart_id = o.cart_id
          JOIN payment_session ps ON ps.collection_id = pcl.id
          JOIN payment p ON p.collection_id = pcl.id AND p.session_id = ps.id
          JOIN payment_capture pc ON pc.payment_id = p.id
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
        capture_status: "succeeded",
        event_name: "checkout.completed",
        order_cart_id: cart.id,
        order_customer_id: developmentSeedIds.customer,
        order_id: checkout.orderId,
        order_product_id: developmentSeedIds.product,
        payment_collection_status: "captured",
        payment_id: checkout.paymentId,
        payment_session_status: "authorized",
        payment_status: "captured",
      });
    } finally {
      await database.db.destroy();
      sqlite.close();
    }
  });
});

import { Database, type SQLQueryBindings } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { checkoutEffectHttpApiContribution } from "@ecommerce/api";
import { CheckoutService } from "@ecommerce/checkout";
import { createD1Database } from "@ecommerce/db-d1";
import {
  developmentSeedIds,
  generateDevelopmentSeedSql,
} from "@ecommerce/db-d1/seed";
import { Effect, Layer } from "effect";

import {
  createDevelopmentCommerceProviderRegistries,
  createServerCommerceRuntime,
} from "./commerce-runtime";
import { createEffectHttpWorkerRuntime } from "./effect-http-worker-runtime";

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

const fixedAuthDate = new Date("2026-01-01T00:00:00.000Z");
const checkoutAdminAuth = {
  api: {
    getSession: () =>
      Promise.resolve({
        session: {
          createdAt: fixedAuthDate,
          expiresAt: new Date("2027-01-02T00:00:00.000Z"),
          id: "session_golden",
          token: "session-token",
          updatedAt: fixedAuthDate,
          userId: "user_golden",
        },
        user: {
          email: "ada.dev@example.com",
          emailVerified: true,
          id: "user_golden",
          name: "Ada Dev",
          permissions: ["checkout:execute"],
          role: "admin",
        },
      }),
  },
};

describe("server golden checkout path", () => {
  it("persists checkout outcomes through the Effect HTTP checkout transport", async () => {
    const sqlite = createMigratedSeededDatabase();
    const database = createD1Database(
      createFakeD1Binding(sqlite) as unknown as D1Database
    );
    const publishedEventNames: string[] = [];
    const runtime = createServerCommerceRuntime({
      ...createDevelopmentCommerceProviderRegistries(),
      clock: { now: () => new Date("2026-01-02T00:00:00.000Z") },
      db: database.db,
      idGenerator: createDeterministicIdGenerator(),
      notificationRuntime: {
        eventPublished: (result) => {
          publishedEventNames.push(result.envelope.name);
        },
      },
    });
    if (!runtime.services.checkout) {
      throw new Error("Golden checkout runtime did not configure checkout.");
    }
    const effectHttpRuntime = createEffectHttpWorkerRuntime({
      auth: checkoutAdminAuth,
      contributions: [...checkoutEffectHttpApiContribution.groups],
      runtimeLayers: [Layer.succeed(CheckoutService, runtime.services.checkout)],
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

      const checkoutResponse = await effectHttpRuntime.fetch(
        new Request("https://commerce.example/admin/checkout/complete", {
          body: JSON.stringify({
            cartId: cart.id,
            correlationId: "golden-checkout",
            idempotencyKey: "golden-checkout",
          payment: {
            capture: true,
            providerKey: "manual",
            },
            shippingOptionId: developmentSeedIds.fulfillmentOption,
          }),
          headers: {
            "content-type": "application/json",
            cookie: "better-auth.session=token",
          },
          method: "POST",
        })
      );
      if (!checkoutResponse.ok) {
        throw new Error(
          `Effect HTTP checkout failed with ${checkoutResponse.status}: ${await checkoutResponse.text()}`
        );
      }
      const checkout = (
        (await checkoutResponse.json()) as {
          readonly data: {
            readonly cartId: string;
            readonly fulfillmentIds: readonly string[];
            readonly orderId: string;
            readonly paymentId: string;
            readonly status: string;
            readonly workflowRunId: string;
          };
        }
      ).data;
      const retryResponse = await effectHttpRuntime.fetch(
        new Request("https://commerce.example/admin/checkout/complete", {
          body: JSON.stringify({
            cartId: cart.id,
            correlationId: "golden-checkout-retry",
            idempotencyKey: "golden-checkout",
          payment: {
            capture: true,
            providerKey: "manual",
            },
            shippingOptionId: developmentSeedIds.fulfillmentOption,
          }),
          headers: {
            "content-type": "application/json",
            cookie: "better-auth.session=token",
          },
          method: "POST",
        })
      );
      if (!retryResponse.ok) {
        throw new Error(
          `Effect HTTP checkout retry failed with ${retryResponse.status}: ${await retryResponse.text()}`
        );
      }
      const retry = (
        (await retryResponse.json()) as { readonly data: typeof checkout }
      ).data;

      expect(checkout).toMatchObject({
        cartId: cart.id,
        status: "completed",
        workflowRunId: "golden-checkout",
      });
      expect(checkout.orderId).toStartWith("ord_");
      expect(checkout.paymentId).toStartWith("pay_");
      expect(checkout.fulfillmentIds).toHaveLength(1);
      expect(retry).toEqual(checkout);

      const completedCart = await Effect.runPromise(
        runtime.services.cart.getCart(cart.id)
      );
      const persistedOrder = await Effect.runPromise(
        runtime.services.order.getOrder(checkout.orderId)
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

      expect(persistedOrder).toMatchObject({
        lineItems: [
          {
            itemSnapshot: {
              productId: developmentSeedIds.product,
            },
          },
        ],
        order: {
          cartId: cart.id,
          customerId: developmentSeedIds.customer,
          id: checkout.orderId,
        },
      });
      expect(publishedEventNames).toContain("checkout.completed");
    } finally {
      await effectHttpRuntime.dispose();
      await database.db.destroy();
      sqlite.close();
    }
  });
});

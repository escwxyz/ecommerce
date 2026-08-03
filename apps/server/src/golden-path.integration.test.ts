import { describe, expect, it } from "bun:test";

import { checkoutEffectHttpApiContribution } from "@ecommerce/api";
import { CheckoutService } from "@ecommerce/checkout";
import { Effect, Layer } from "effect";

import {
  createDevelopmentCommerceProviderRegistries,
  createServerCommerceRuntime,
} from "./commerce-runtime";
import { developmentSeedIds } from "./development-seed";
import { createEffectHttpWorkerRuntime } from "./effect-http-worker-runtime";

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
    const publishedEventNames: string[] = [];
    const runtime = createServerCommerceRuntime({
      ...createDevelopmentCommerceProviderRegistries(),
      clock: { now: () => new Date("2026-01-02T00:00:00.000Z") },
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
      runtimeLayers: [
        Layer.succeed(CheckoutService, runtime.services.checkout),
      ],
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
    }
  });
});

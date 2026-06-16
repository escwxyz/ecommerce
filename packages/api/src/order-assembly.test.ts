import { describe, expect, it } from "bun:test";

import { createStoreAdminAuthSession } from "@ecommerce/auth/testing";
import {
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";
import { createInMemoryOrderRepository } from "@ecommerce/order/repository";
import { call } from "@orpc/server";

import { createAdminMetadataModel } from "./admin-metadata";
import {
  authorizationEvaluator,
  builtinPermissionStatement,
} from "./permissions";
import { createBuiltinRouteFragments } from "./routers";

describe("order API and admin assembly", () => {
  it("includes order permissions in builtin permission composition", () => {
    expect(builtinPermissionStatement.order).toEqual(["read", "write"]);
  });

  it("includes order route fragments in builtin API composition", () => {
    const orderFragment = createBuiltinRouteFragments().find(
      (fragment) => fragment.key === "module:order"
    );

    expect(Object.keys(orderFragment?.router ?? {})).toContain(
      "orderCreateFromCheckout"
    );
    expect(Object.keys(orderFragment?.router ?? {})).toContain(
      "orderTransitionStatus"
    );
  });

  it("uses injected request-scoped order route service options", async () => {
    const repository = createInMemoryOrderRepository();
    const orderFragment = createBuiltinRouteFragments({
      order: {
        createServiceOptionsForContext: (context) => {
          expect(context.session?.user).toBeDefined();

          return {
            clock: createStaticClock(new Date("2026-06-16T10:00:00.000Z")),
            idGenerator: createSequenceIdGenerator([
              "ord_api_injected",
              "ordli_api_injected",
              "evt_api_injected",
            ]),
            repository,
          };
        },
      },
    }).find((fragment) => fragment.key === "module:order");

    if (!orderFragment) {
      throw new Error("Expected order fragment to be assembled.");
    }

    if (!("orderCreateFromCheckout" in orderFragment.router)) {
      throw new Error(
        "Expected order fragment router to expose orderCreateFromCheckout."
      );
    }

    const order = await call(
      orderFragment.router.orderCreateFromCheckout,
      {
        cartId: "cart_1",
        correlationId: "corr_1",
        idempotencyKey: "order_create_1",
        lineItems: [
          {
            itemSnapshot: {
              productId: "prod_1",
              productTitle: "Hat",
              variantId: "variant_1",
              variantTitle: "Default",
            },
            quantity: 1,
            title: "Hat",
            total: 1000,
            unitPrice: 1000,
          },
        ],
        totals: {
          adjustmentTotal: 0,
          currencyCode: "USD",
          discountTotal: 0,
          giftCardTotal: 0,
          itemSubtotal: 1000,
          shippingTotal: 0,
          subtotal: 1000,
          taxTotal: 0,
          total: 1000,
        },
      },
      {
        context: {
          auth: {},
          authorization: authorizationEvaluator,
          session: createStoreAdminAuthSession({
            permissions: ["order:write"],
          }),
        },
      }
    );

    expect(order.order.id).toBe("ord_api_injected");
    await expect(repository.listOrders()).resolves.toHaveLength(1);
  });

  it("exposes order admin metadata through shared module contracts", () => {
    const metadata = createAdminMetadataModel({
      auth: {},
      authorization: authorizationEvaluator,
      session: {
        user: {
          permissions: ["order:read", "order:write"],
        },
      },
    });

    expect(
      metadata.surfaces.some((surface) => surface.source.key === "order")
    ).toBe(true);
    expect(
      metadata.surfaces.find((surface) => surface.source.key === "order")
        ?.permission?.resource
    ).toBe("order");
  });
});

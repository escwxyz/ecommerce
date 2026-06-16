import { describe, expect, it } from "bun:test";

import { createStoreAdminAuthSession } from "@ecommerce/auth/testing";
import { createResettableInMemoryCartRepository } from "@ecommerce/cart/repository";
import {
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";
import { call } from "@orpc/server";

import { createAdminMetadataModel } from "./admin-metadata";
import {
  authorizationEvaluator,
  builtinPermissionStatement,
} from "./permissions";
import { createBuiltinRouteFragments } from "./routers";

describe("cart API and admin assembly", () => {
  it("includes cart permissions in builtin permission composition", () => {
    expect(builtinPermissionStatement.cart).toEqual(["read", "write"]);
  });

  it("includes cart route fragments in builtin API composition", () => {
    const cartFragment = createBuiltinRouteFragments().find(
      (fragment) => fragment.key === "module:cart"
    );

    expect(Object.keys(cartFragment?.router ?? {})).toContain("cartCreate");
    expect(Object.keys(cartFragment?.router ?? {})).toContain(
      "cartAddLineItem"
    );
  });

  it("uses injected request-scoped cart route service options", async () => {
    const repository = createResettableInMemoryCartRepository();
    const cartFragment = createBuiltinRouteFragments({
      cart: {
        createServiceOptionsForContext: (context) => {
          expect(context.session?.user).toBeDefined();

          return {
            clock: createStaticClock(new Date("2026-06-16T10:00:00.000Z")),
            idGenerator: createSequenceIdGenerator(["cart_api_injected"]),
            repository,
          };
        },
      },
    }).find((fragment) => fragment.key === "module:cart");

    if (!cartFragment) {
      throw new Error("Expected cart fragment to be assembled.");
    }

    if (!("cartCreate" in cartFragment.router)) {
      throw new Error("Expected cart fragment router to expose cartCreate.");
    }

    const cart = await call(
      cartFragment.router.cartCreate,
      {
        currencyCode: "USD",
      },
      {
        context: {
          auth: {},
          authorization: authorizationEvaluator,
          session: createStoreAdminAuthSession({
            permissions: ["cart:write"],
          }),
        },
      }
    );

    expect(cart.id).toBe("cart_api_injected");
    await expect(repository.listCarts()).resolves.toHaveLength(1);
  });

  it("exposes cart admin metadata through shared module contracts", () => {
    const metadata = createAdminMetadataModel({
      auth: {},
      authorization: authorizationEvaluator,
      session: {
        user: {
          permissions: ["cart:read", "cart:write"],
        },
      },
    });

    expect(
      metadata.surfaces.some((surface) => surface.source.key === "cart")
    ).toBe(true);
    expect(
      metadata.surfaces.find((surface) => surface.source.key === "cart")
        ?.permission?.resource
    ).toBe("cart");
  });
});

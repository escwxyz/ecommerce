import { describe, expect, it } from "bun:test";

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

import { describe, expect, it } from "bun:test";

import { createAdminMetadataModel } from "./admin-metadata";
import {
  adminHttpApi,
  cartEffectHttpApiContribution,
  createEffectHttpApiAssembly,
} from "./index";
import {
  authorizationEvaluator,
  builtinPermissionStatement,
} from "./permissions";

describe("cart API and admin assembly", () => {
  it("includes cart permissions in builtin permission composition", () => {
    expect(builtinPermissionStatement.cart).toEqual(["read", "write"]);
  });

  it("includes cart Effect HTTP operations in canonical admin composition", () => {
    const admin = createEffectHttpApiAssembly({
      contributions: cartEffectHttpApiContribution.groups,
      root: adminHttpApi,
      surface: "admin",
    });

    expect(admin.routes.map((route) => route.routeKey)).toEqual([
      "POST /admin/carts/line-items",
      "PATCH /admin/carts/addresses",
      "POST /admin/carts/adjustments",
      "PATCH /admin/carts/checkout-references",
      "POST /admin/carts",
      "POST /admin/carts/get",
      "PATCH /admin/carts/line-items",
      "PATCH /admin/carts/region-channel",
      "PATCH /admin/carts/totals",
    ]);
    expect(cartEffectHttpApiContribution.moduleName).toBe("cart");
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

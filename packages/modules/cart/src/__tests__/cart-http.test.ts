import { describe, expect, it } from "bun:test";

import { adminHttpApi } from "@ecommerce/api/effect-http-api";
import { createEffectHttpApiAssembly } from "@ecommerce/api/effect-http-api-assembly";
import { OpenApi } from "effect/unstable/httpapi";

import { cartEffectHttpApiContribution } from "../http/api";
import { cartModule } from "../module";

describe("cart HTTP contribution", () => {
  it("attaches its executable HTTP group and permissions to its module", () => {
    expect(cartModule.contributions?.apiGroups).toBe(
      cartEffectHttpApiContribution.groups
    );
    expect(cartEffectHttpApiContribution.groups[0]?.surface).toBe("admin");
    expect(cartEffectHttpApiContribution.groups[0]?.handlers).toBeDefined();
    expect(
      cartModule.contributions?.apiGroups?.map((group) => group.key)
    ).toEqual(["module:cart.admin"]);
    expect(
      cartModule.contributions?.permissions?.map((permission) => permission.key)
    ).toEqual(["cart:read", "cart:write"]);
    expect(cartModule.contributions?.adminSurfaces?.length).toBeGreaterThan(0);
  });

  it("preserves the admin routes through generic assembly", () => {
    const assembly = createEffectHttpApiAssembly({
      contributions: cartEffectHttpApiContribution.groups,
      root: adminHttpApi,
      surface: "admin",
    });

    expect(assembly.routes.map((route) => route.routeKey)).toEqual([
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
    expect(
      Object.keys(OpenApi.fromApi(assembly.api).paths).length
    ).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from "bun:test";

import { adminHttpApi } from "@ecommerce/api/effect-http-api";
import { createEffectHttpApiAssembly } from "@ecommerce/api/effect-http-api-assembly";
import { OpenApi } from "effect/unstable/httpapi";

import { pricingEffectHttpApiContribution } from "../http/api";
import { pricingModule } from "../module";
import { pricingPermissionList } from "../permissions";

describe("pricing HTTP contribution", () => {
  it("registers its own admin handlers and preserves the API contract", () => {
    const groups = pricingModule.contributions?.apiGroups ?? [];
    expect(groups).toEqual(pricingEffectHttpApiContribution.groups);
    expect(groups[0]?.key).toBe("module:pricing.admin");
    expect(groups[0]?.handlers).toBeDefined();
    const assembly = createEffectHttpApiAssembly({
      contributions: pricingEffectHttpApiContribution.groups,
      root: adminHttpApi,
      surface: "admin",
    });
    expect(assembly.routes.map((route) => route.routeKey)).toEqual([
      "POST /admin/pricing/calculate",
      "POST /admin/pricing/currencies",
      "GET /admin/pricing/currencies",
      "POST /admin/pricing/money-amounts",
      "POST /admin/pricing/price-lists",
      "POST /admin/pricing/price-preferences",
      "POST /admin/pricing/price-rules",
      "POST /admin/pricing/price-sets",
    ]);
    expect(
      OpenApi.fromApi(assembly.api as typeof adminHttpApi).paths[
        "/admin/pricing/calculate"
      ]?.post
    ).toBeDefined();
    expect(pricingPermissionList.map(({ action }) => action)).toEqual([
      "read",
      "write",
    ]);
  });
});

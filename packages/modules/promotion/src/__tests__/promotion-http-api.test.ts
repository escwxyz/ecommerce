import { describe, expect, it } from "bun:test";

import { adminHttpApi } from "@ecommerce/api/effect-http-api";
import { createEffectHttpApiAssembly } from "@ecommerce/api/effect-http-api-assembly";
import { OpenApi } from "effect/unstable/httpapi";

import { promotionEffectHttpApiContribution } from "../http/api";
import { promotionModule } from "../module";
import { promotionPermissionList } from "../permissions";

describe("promotion HTTP contribution", () => {
  it("registers its own admin handlers and preserves the API contract", () => {
    const groups = promotionModule.contributions?.apiGroups ?? [];
    expect(groups).toEqual(promotionEffectHttpApiContribution.groups);
    expect(groups[0]?.key).toBe("module:promotion.admin");
    expect(groups[0]?.handlers).toBeDefined();
    const assembly = createEffectHttpApiAssembly({
      contributions: promotionEffectHttpApiContribution.groups,
      root: adminHttpApi,
      surface: "admin",
    });
    expect(assembly.routes.map((route) => route.routeKey)).toEqual([
      "POST /admin/promotions/adjustments/calculate",
      "POST /admin/promotions/campaigns",
      "POST /admin/promotions",
      "POST /admin/promotions/redemptions",
      "POST /admin/promotions/rules",
      "POST /admin/promotions/usage-limits",
    ]);
    expect(
      OpenApi.fromApi(assembly.api as typeof adminHttpApi).paths[
        "/admin/promotions"
      ]?.post
    ).toBeDefined();
    expect(promotionPermissionList.map(({ action }) => action)).toEqual([
      "read",
      "write",
    ]);
  });
});

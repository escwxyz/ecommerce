import { describe, expect, it } from "bun:test";

import { adminHttpApi } from "@ecommerce/api/effect-http-api";
import { createEffectHttpApiAssembly } from "@ecommerce/api/effect-http-api-assembly";
import { OpenApi } from "effect/unstable/httpapi";

import { inventoryEffectHttpApiContribution } from "../http/api";
import { inventoryModule } from "../module";
import { inventoryPermissionList } from "../permissions";

describe("inventory HTTP contribution", () => {
  it("registers its own admin handlers and preserves the API contract", () => {
    const groups = inventoryModule.contributions?.apiGroups ?? [];
    expect(groups).toEqual(inventoryEffectHttpApiContribution.groups);
    expect(groups[0]?.key).toBe("module:inventory.admin");
    expect(groups[0]?.handlers).toBeDefined();
    const assembly = createEffectHttpApiAssembly({
      contributions: inventoryEffectHttpApiContribution.groups,
      root: adminHttpApi,
      surface: "admin",
    });
    expect(assembly.routes.map((route) => route.routeKey)).toEqual([
      "POST /admin/inventory/adjustments",
      "POST /admin/inventory/availability",
      "POST /admin/inventory/items",
      "PUT /admin/inventory/levels",
      "POST /admin/inventory/reservations",
      "POST /admin/inventory/stock-locations",
    ]);
    expect(
      OpenApi.fromApi(assembly.api as typeof adminHttpApi).paths[
        "/admin/inventory/items"
      ]?.post
    ).toBeDefined();
    expect(inventoryPermissionList.map(({ action }) => action)).toEqual([
      "read",
      "write",
    ]);
  });
});

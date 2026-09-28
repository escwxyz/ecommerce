import { describe, expect, it } from "bun:test";

import { adminHttpApi } from "@ecommerce/api/effect-http-api";
import { createEffectHttpApiAssembly } from "@ecommerce/api/effect-http-api-assembly";
import { OpenApi } from "effect/unstable/httpapi";

import { orderEffectHttpApiContribution } from "../http/api";
import { orderModule } from "../module";

describe("order HTTP contribution", () => {
  it("attaches its executable HTTP group and permissions to its module", () => {
    expect(orderModule.contributions?.apiGroups).toBe(
      orderEffectHttpApiContribution.groups
    );
    expect(orderEffectHttpApiContribution.groups[0]?.surface).toBe("admin");
    expect(orderEffectHttpApiContribution.groups[0]?.handlers).toBeDefined();
    expect(
      orderModule.contributions?.apiGroups?.map((group) => group.key)
    ).toEqual(["module:order.admin"]);
    expect(
      orderModule.contributions?.permissions?.map(
        (permission) => permission.key
      )
    ).toEqual(["order:read", "order:write"]);
    expect(orderModule.contributions?.adminSurfaces?.length).toBeGreaterThan(0);
  });

  it("preserves the admin routes through generic assembly", () => {
    const assembly = createEffectHttpApiAssembly({
      contributions: orderEffectHttpApiContribution.groups,
      root: adminHttpApi,
      surface: "admin",
    });

    expect(assembly.routes.map((route) => route.routeKey)).toEqual([
      "POST /admin/orders",
      "GET /admin/orders/:id",
      "GET /admin/orders",
      "POST /admin/orders/:orderId/transactions",
      "POST /admin/orders/:orderId/status",
    ]);
    expect(orderEffectHttpApiContribution.moduleName).toBe("order");
    expect(
      Object.keys(OpenApi.fromApi(assembly.api).paths).length
    ).toBeGreaterThan(0);
  });
});

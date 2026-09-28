import { describe, expect, it } from "bun:test";

import { adminHttpApi } from "@ecommerce/api/effect-http-api";
import { createEffectHttpApiAssembly } from "@ecommerce/api/effect-http-api-assembly";
import { OpenApi } from "effect/unstable/httpapi";

import { fulfillmentEffectHttpApiContribution } from "../http/api";
import { fulfillmentModule } from "../module";

describe("fulfillment HTTP contribution", () => {
  it("attaches its executable HTTP group and permissions to its module", () => {
    expect(fulfillmentModule.contributions?.apiGroups).toBe(
      fulfillmentEffectHttpApiContribution.groups
    );
    expect(fulfillmentEffectHttpApiContribution.groups[0]?.surface).toBe(
      "admin"
    );
    expect(
      fulfillmentEffectHttpApiContribution.groups[0]?.handlers
    ).toBeDefined();
    expect(
      fulfillmentModule.contributions?.apiGroups?.map((group) => group.key)
    ).toEqual(["module:fulfillment.admin"]);
    expect(
      fulfillmentModule.contributions?.permissions?.map(
        (permission) => permission.key
      )
    ).toEqual(["fulfillment:read", "fulfillment:write"]);
    expect(
      fulfillmentModule.contributions?.adminSurfaces?.length
    ).toBeGreaterThan(0);
  });

  it("preserves the admin routes through generic assembly", () => {
    const assembly = createEffectHttpApiAssembly({
      contributions: fulfillmentEffectHttpApiContribution.groups,
      root: adminHttpApi,
      surface: "admin",
    });

    expect(assembly.routes.map((route) => route.routeKey)).toEqual([
      "POST /admin/fulfillment/fulfillments/cancel",
      "POST /admin/fulfillment/fulfillments",
      "GET /admin/fulfillment/fulfillments",
      "POST /admin/fulfillment/providers",
      "POST /admin/fulfillment/service-zones",
      "POST /admin/fulfillment/sets",
      "POST /admin/fulfillment/shipping-options",
      "POST /admin/fulfillment/shipping-options/query",
      "POST /admin/fulfillment/shipping-options/rate",
      "POST /admin/fulfillment/shipping-profiles",
      "POST /admin/fulfillment/shipments/track",
    ]);
    expect(fulfillmentEffectHttpApiContribution.moduleName).toBe("fulfillment");
    expect(
      Object.keys(OpenApi.fromApi(assembly.api).paths).length
    ).toBeGreaterThan(0);
  });
});

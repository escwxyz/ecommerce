import { describe, expect, it } from "bun:test";

import { createAdminMetadataModel } from "./admin-metadata";
import {
  adminHttpApi,
  createEffectHttpApiAssembly,
  fulfillmentEffectHttpApiContribution,
} from "./index";
import {
  authorizationEvaluator,
  builtinPermissionStatement,
} from "./permissions";

describe("fulfillment API and admin assembly", () => {
  it("includes fulfillment permissions in builtin permission composition", () => {
    expect(builtinPermissionStatement.fulfillment).toEqual(["read", "write"]);
  });

  it("includes fulfillment Effect HTTP operations in canonical admin composition", () => {
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
  });

  it("exposes fulfillment admin metadata through shared module contracts", () => {
    const metadata = createAdminMetadataModel({
      auth: {},
      authorization: authorizationEvaluator,
      session: {
        user: {
          permissions: ["fulfillment:read", "fulfillment:write"],
        },
      },
    });

    expect(
      metadata.surfaces.some((surface) => surface.source.key === "fulfillment")
    ).toBe(true);
    expect(
      metadata.surfaces.find((surface) => surface.source.key === "fulfillment")
        ?.permission?.resource
    ).toBe("fulfillment");
  });
});

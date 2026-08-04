import { describe, expect, it } from "bun:test";

import { createAdminMetadataModel } from "./admin-metadata";
import {
  adminHttpApi,
  createEffectHttpApiAssembly,
  orderEffectHttpApiContribution,
} from "./index";
import {
  authorizationEvaluator,
  builtinPermissionStatement,
} from "./permissions";

describe("order API and admin assembly", () => {
  it("includes order permissions in builtin permission composition", () => {
    expect(builtinPermissionStatement.order).toEqual(["read", "write"]);
  });

  it("includes order Effect HTTP operations in canonical admin composition", () => {
    const assembly = createEffectHttpApiAssembly({
      contributions: orderEffectHttpApiContribution.groups,
      root: adminHttpApi,
      surface: "admin",
    });

    expect(assembly.contributions.map((group) => group.key)).toEqual([
      "module:order.admin",
    ]);
    expect(assembly.routes.map((route) => route.routeKey)).toEqual([
      "POST /admin/orders",
      "GET /admin/orders/:id",
      "GET /admin/orders",
      "POST /admin/orders/:orderId/transactions",
      "POST /admin/orders/:orderId/status",
    ]);
    expect(orderEffectHttpApiContribution.moduleName).toBe("order");
  });

  it("exposes order admin metadata through shared module contracts", () => {
    const metadata = createAdminMetadataModel({
      auth: {},
      authorization: authorizationEvaluator,
      session: {
        user: {
          permissions: ["order:read", "order:write"],
        },
      },
    });

    expect(
      metadata.surfaces.some((surface) => surface.source.key === "order")
    ).toBe(true);
    expect(
      metadata.surfaces.find((surface) => surface.source.key === "order")
        ?.permission?.resource
    ).toBe("order");
  });
});

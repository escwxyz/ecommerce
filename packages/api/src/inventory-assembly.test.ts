import { describe, expect, it } from "bun:test";

import { createAdminMetadataModel } from "./admin-metadata";
import {
  adminHttpApi,
  createEffectHttpApiAssembly,
  inventoryEffectHttpApiContribution,
} from "./index";
import {
  builtinPermissionStatement,
  authorizationEvaluator,
} from "./permissions";

describe("inventory API and admin assembly", () => {
  it("includes inventory permissions in builtin permission composition", () => {
    expect(builtinPermissionStatement.inventory).toEqual(["read", "write"]);
  });

  it("includes inventory Effect HTTP operations in canonical admin composition", () => {
    const admin = createEffectHttpApiAssembly({
      contributions: inventoryEffectHttpApiContribution.groups,
      root: adminHttpApi,
      surface: "admin",
    });

    expect(admin.routes.map((route) => route.routeKey)).toEqual([
      "POST /admin/inventory/adjustments",
      "POST /admin/inventory/availability",
      "POST /admin/inventory/items",
      "PUT /admin/inventory/levels",
      "POST /admin/inventory/reservations",
      "POST /admin/inventory/stock-locations",
    ]);
    expect(inventoryEffectHttpApiContribution.moduleName).toBe("inventory");
  });

  it("exposes inventory admin metadata through shared module contracts", () => {
    const metadata = createAdminMetadataModel({
      auth: {},
      authorization: authorizationEvaluator,
      session: {
        user: {
          permissions: ["inventory:read", "inventory:write"],
        },
      },
    });

    expect(
      metadata.surfaces.some((surface) => surface.source.key === "inventory")
    ).toBe(true);
    expect(
      metadata.surfaces.find((surface) => surface.source.key === "inventory")
        ?.permission?.resource
    ).toBe("inventory");
  });
});

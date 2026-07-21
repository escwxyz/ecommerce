import { describe, expect, it } from "bun:test";

import { createAdminMetadataModel } from "./admin-metadata";
import {
  adminHttpApi,
  createEffectHttpApiAssembly,
  promotionEffectHttpApiContribution,
} from "./index";
import {
  authorizationEvaluator,
  builtinPermissionStatement,
} from "./permissions";

describe("promotion API and admin assembly", () => {
  it("includes promotion permissions in builtin permission composition", () => {
    expect(builtinPermissionStatement.promotion).toEqual(["read", "write"]);
  });

  it("includes promotion Effect HTTP operations in canonical admin composition", () => {
    const admin = createEffectHttpApiAssembly({
      contributions: promotionEffectHttpApiContribution.groups,
      root: adminHttpApi,
      surface: "admin",
    });

    expect(admin.routes.map((route) => route.routeKey)).toEqual([
      "POST /admin/promotions/adjustments/calculate",
      "POST /admin/promotions/campaigns",
      "POST /admin/promotions",
      "POST /admin/promotions/redemptions",
      "POST /admin/promotions/rules",
      "POST /admin/promotions/usage-limits",
    ]);
    expect(promotionEffectHttpApiContribution.moduleName).toBe("promotion");
  });

  it("exposes promotion admin metadata through shared module contracts", () => {
    const metadata = createAdminMetadataModel({
      auth: {},
      authorization: authorizationEvaluator,
      session: {
        user: {
          permissions: ["promotion:read"],
        },
      },
    });

    expect(
      metadata.surfaces.some((surface) => surface.source.key === "promotion")
    ).toBe(true);
    expect(
      metadata.surfaces.find((surface) => surface.source.key === "promotion")
        ?.permission?.resource
    ).toBe("promotion");
  });
});

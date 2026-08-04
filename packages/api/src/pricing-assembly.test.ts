import { describe, expect, it } from "bun:test";

import { createAdminMetadataModel } from "./admin-metadata";
import {
  adminHttpApi,
  createEffectHttpApiAssembly,
  pricingEffectHttpApiContribution,
} from "./index";
import {
  authorizationEvaluator,
  builtinPermissionStatement,
} from "./permissions";

describe("pricing API and admin assembly", () => {
  it("includes pricing permissions in builtin composition", () => {
    expect(builtinPermissionStatement.pricing).toEqual(["read", "write"]);
  });

  it("includes pricing Effect HTTP operations in canonical admin composition", () => {
    const admin = createEffectHttpApiAssembly({
      contributions: pricingEffectHttpApiContribution.groups,
      root: adminHttpApi,
      surface: "admin",
    });

    expect(admin.routes.map((route) => route.routeKey)).toEqual([
      "POST /admin/pricing/calculate",
      "POST /admin/pricing/currencies",
      "GET /admin/pricing/currencies",
      "POST /admin/pricing/money-amounts",
      "POST /admin/pricing/price-lists",
      "POST /admin/pricing/price-preferences",
      "POST /admin/pricing/price-rules",
      "POST /admin/pricing/price-sets",
    ]);
    expect(pricingEffectHttpApiContribution.moduleName).toBe("pricing");
  });

  it("exposes pricing admin metadata through shared module contracts", () => {
    const metadata = createAdminMetadataModel({
      auth: {},
      authorization: authorizationEvaluator,
      session: {
        user: {
          permissions: ["pricing:read", "pricing:write"],
        },
      },
    });

    expect(
      metadata.surfaces.some((surface) => surface.source.key === "pricing")
    ).toBe(true);
    expect(
      metadata.surfaces.find((surface) => surface.source.key === "pricing")
        ?.permission?.resource
    ).toBe("pricing");
  });
});

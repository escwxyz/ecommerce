import { describe, expect, it } from "bun:test";

import { createAdminMetadataModel } from "./admin-metadata";
import {
  adminHttpApi,
  createEffectHttpApiAssembly,
  productEffectHttpApiContribution,
} from "./index";
import {
  authorizationEvaluator,
  builtinPermissionStatement,
} from "./permissions";

describe("product API and admin assembly", () => {
  it("includes product permissions in builtin permission composition", () => {
    expect(builtinPermissionStatement.product).toEqual(["read", "write"]);
  });

  it("includes product Effect HTTP operations in canonical admin composition", () => {
    const admin = createEffectHttpApiAssembly({
      contributions: productEffectHttpApiContribution.groups,
      root: adminHttpApi,
      surface: "admin",
    });

    expect(admin.routes.map((route) => route.routeKey)).toEqual([
      "PATCH /admin/products/catalog",
      "POST /admin/products",
      "POST /admin/products/get",
      "GET /admin/products",
      "POST /admin/products/variants/validate",
    ]);
    expect(productEffectHttpApiContribution.moduleName).toBe("product");
  });

  it("exposes product admin metadata through shared module contracts", () => {
    const metadata = createAdminMetadataModel({
      auth: {},
      authorization: authorizationEvaluator,
      session: {
        user: {
          permissions: ["product:read", "product:write"],
        },
      },
    });

    expect(
      metadata.surfaces.some((surface) => surface.source.key === "product")
    ).toBe(true);
    expect(
      metadata.surfaces.find((surface) => surface.source.key === "product")
        ?.permission?.resource
    ).toBe("product");
  });
});

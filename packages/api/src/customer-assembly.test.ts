import { describe, expect, it } from "bun:test";

import { createAdminMetadataModel } from "./admin-metadata";
import {
  adminHttpApi,
  createEffectHttpApiAssembly,
  customerEffectHttpApiContribution,
} from "./index";
import {
  builtinPermissionStatement,
  authorizationEvaluator,
} from "./permissions";

describe("customer API and admin assembly", () => {
  it("includes customer permissions in builtin permission composition", () => {
    expect(builtinPermissionStatement.customer).toEqual(["read", "write"]);
  });

  it("includes customer Effect HTTP operations in canonical admin composition", () => {
    const admin = createEffectHttpApiAssembly({
      contributions: customerEffectHttpApiContribution.groups,
      root: adminHttpApi,
      surface: "admin",
    });

    expect(admin.routes.map((route) => route.routeKey)).toEqual([
      "POST /admin/customer-addresses",
      "POST /admin/customers/auth-link",
      "POST /admin/customers",
      "POST /admin/customers/get",
      "POST /admin/customer-groups/assign",
      "POST /admin/customer-groups",
      "GET /admin/customers",
      "POST /admin/customers/payment-identity",
      "PATCH /admin/customers",
      "POST /admin/customers/resolve-auth",
    ]);
    expect(customerEffectHttpApiContribution.moduleName).toBe("customer");
  });

  it("exposes customer admin metadata through shared module contracts", () => {
    const metadata = createAdminMetadataModel({
      auth: {},
      authorization: authorizationEvaluator,
      session: {
        user: {
          permissions: ["customer:read", "customer:write"],
        },
      },
    });

    expect(
      metadata.surfaces.some((surface) => surface.source.key === "customer")
    ).toBe(true);
    expect(
      metadata.surfaces.find((surface) => surface.source.key === "customer")
        ?.permission?.resource
    ).toBe("customer");
  });
});

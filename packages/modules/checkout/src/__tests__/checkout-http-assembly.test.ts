import { describe, expect, it } from "bun:test";

import { adminHttpApi } from "@ecommerce/api/effect-http-api";
import { createEffectHttpApiAssembly } from "@ecommerce/api/effect-http-api-assembly";
import { composeCommerceModulePermissions } from "@ecommerce/core";
import { composeAdminMetadata } from "@ecommerce/core/admin";

import { checkoutAdminMetadata } from "../admin";
import { checkoutEffectHttpApiContribution } from "../http/api";
import { checkoutModule } from "../module";

describe("checkout API and admin assembly", () => {
  it("includes checkout permissions in builtin permission composition", () => {
    const statement = composeCommerceModulePermissions([
      checkoutModule,
    ]).statement;
    expect([...(statement.checkout ?? [])].sort()).toEqual(["execute", "read"]);
  });

  it("includes checkout Effect HTTP operations in canonical admin composition", () => {
    const assembly = createEffectHttpApiAssembly({
      contributions: checkoutEffectHttpApiContribution.groups,
      root: adminHttpApi,
      surface: "admin",
    });

    expect(assembly.contributions.map((group) => group.key)).toEqual([
      "module:checkout.admin",
    ]);
    expect(assembly.routes.map((route) => route.routeKey)).toEqual([
      "POST /admin/checkout/complete",
    ]);
    expect(checkoutEffectHttpApiContribution.moduleName).toBe("checkout");
    expect(checkoutModule.contributions?.apiGroups?.[0]?.key).toBe(
      "module:checkout.admin"
    );
  });

  it("exposes checkout admin metadata through shared module contracts", () => {
    const metadata = composeAdminMetadata({
      contributions: [checkoutAdminMetadata],
      permissions: ["checkout:read", "checkout:execute"],
    });

    expect(
      metadata.surfaces.some((surface) => surface.source.key === "checkout")
    ).toBe(true);
    expect(
      metadata.surfaces.find((surface) => surface.source.key === "checkout")
        ?.permission?.resource
    ).toBe("checkout");
  });
});

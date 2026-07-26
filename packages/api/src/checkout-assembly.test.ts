import { describe, expect, it } from "bun:test";

import { createStoreAdminAuthSession } from "@ecommerce/auth/testing";

import { createAdminMetadataModel } from "./admin-metadata";
import {
  adminHttpApi,
  checkoutEffectHttpApiContribution,
  createEffectHttpApiAssembly,
} from "./index";
import {
  authorizationEvaluator,
  builtinPermissionStatement,
} from "./permissions";
import { createBuiltinRouteFragments } from "./routers";

describe("checkout API and admin assembly", () => {
  it("includes checkout permissions in builtin permission composition", () => {
    expect([...(builtinPermissionStatement.checkout ?? [])].sort()).toEqual([
      "execute",
      "read",
    ]);
  });

  it("keeps migrated checkout operations out of legacy oRPC composition", () => {
    expect(
      createBuiltinRouteFragments().map((fragment) => fragment.key)
    ).toEqual(["builtin:core"]);
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
  });

  it("exposes checkout admin metadata through shared module contracts", () => {
    const metadata = createAdminMetadataModel({
      auth: {},
      authorization: authorizationEvaluator,
      session: createStoreAdminAuthSession({
        permissions: ["checkout:read", "checkout:execute"],
      }),
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

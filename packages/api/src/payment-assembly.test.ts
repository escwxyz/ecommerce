import { describe, expect, it } from "bun:test";

import { createAdminMetadataModel } from "./admin-metadata";
import { adminHttpApi, createEffectHttpApiAssembly } from "./index";
import { paymentEffectHttpApiContribution } from "./payment-effect-http-api";
import {
  authorizationEvaluator,
  builtinPermissionStatement,
} from "./permissions";
import { createBuiltinRouteFragments } from "./routers";

describe("payment API and admin assembly", () => {
  it("includes payment permissions in builtin permission composition", () => {
    expect(builtinPermissionStatement.payment).toEqual(["read", "write"]);
  });

  it("keeps migrated payment operations out of legacy oRPC composition", () => {
    const paymentFragment = createBuiltinRouteFragments().find(
      (fragment) => fragment.key === "module:payment"
    );

    expect(paymentFragment).toBeUndefined();
  });

  it("includes payment Effect HTTP operations in canonical admin composition", () => {
    const assembly = createEffectHttpApiAssembly({
      root: adminHttpApi,
      contributions: paymentEffectHttpApiContribution.groups,
      surface: "admin",
    });

    expect(assembly.routes.map((route) => route.routeKey)).toEqual(
      expect.arrayContaining([
        "POST /admin/payments/collections",
        "POST /admin/payments/providers/webhooks/parse",
      ])
    );
    expect(paymentEffectHttpApiContribution.moduleName).toBe("payment");
  });

  it("exposes payment admin metadata through shared module contracts", () => {
    const metadata = createAdminMetadataModel({
      auth: {},
      authorization: authorizationEvaluator,
      session: {
        user: {
          permissions: ["payment:read", "payment:write"],
        },
      },
    });

    expect(
      metadata.surfaces.some((surface) => surface.source.key === "payment")
    ).toBe(true);
    expect(
      metadata.surfaces.find((surface) => surface.source.key === "payment")
        ?.permission?.resource
    ).toBe("payment");
  });
});

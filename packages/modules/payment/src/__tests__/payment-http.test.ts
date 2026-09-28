import { describe, expect, it } from "bun:test";

import { adminHttpApi } from "@ecommerce/api/effect-http-api";
import { createEffectHttpApiAssembly } from "@ecommerce/api/effect-http-api-assembly";
import { OpenApi } from "effect/unstable/httpapi";

import { paymentEffectHttpApiContribution } from "../http/api";
import { paymentModule } from "../module";

describe("payment HTTP contribution", () => {
  it("attaches its executable HTTP group and permissions to its module", () => {
    expect(paymentModule.contributions?.apiGroups).toBe(
      paymentEffectHttpApiContribution.groups
    );
    expect(paymentEffectHttpApiContribution.groups[0]?.surface).toBe("admin");
    expect(paymentEffectHttpApiContribution.groups[0]?.handlers).toBeDefined();
    expect(
      paymentModule.contributions?.apiGroups?.map((group) => group.key)
    ).toEqual(["module:payment.admin"]);
    expect(
      paymentModule.contributions?.permissions?.map(
        (permission) => permission.key
      )
    ).toEqual(["payment:read", "payment:write"]);
    expect(paymentModule.contributions?.adminSurfaces?.length).toBeGreaterThan(
      0
    );
  });

  it("preserves the admin routes through generic assembly", () => {
    const assembly = createEffectHttpApiAssembly({
      contributions: paymentEffectHttpApiContribution.groups,
      root: adminHttpApi,
      surface: "admin",
    });

    expect(assembly.routes.map((route) => route.routeKey)).toEqual(
      expect.arrayContaining([
        "POST /admin/payments/collections",
        "POST /admin/payments/providers/webhooks/parse",
      ])
    );
    expect(paymentEffectHttpApiContribution.moduleName).toBe("payment");
    expect(
      Object.keys(OpenApi.fromApi(assembly.api).paths).length
    ).toBeGreaterThan(0);
  });
});

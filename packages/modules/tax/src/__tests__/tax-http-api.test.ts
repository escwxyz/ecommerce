import { describe, expect, it } from "bun:test";

import { adminHttpApi } from "@ecommerce/api/effect-http-api";
import { createEffectHttpApiAssembly } from "@ecommerce/api/effect-http-api-assembly";
import { OpenApi } from "effect/unstable/httpapi";

import { taxEffectHttpApiContribution } from "../http/api";
import { taxModule } from "../module";

describe("tax HTTP contribution", () => {
  it("registers its own admin handlers and preserves the API contract", () => {
    const groups = taxModule.contributions?.apiGroups ?? [];
    expect(groups).toEqual(taxEffectHttpApiContribution.groups);
    expect(groups[0]?.key).toBe("module:tax.admin");
    expect(groups[0]?.handlers).toBeDefined();
    const assembly = createEffectHttpApiAssembly({
      contributions: taxEffectHttpApiContribution.groups,
      root: adminHttpApi,
      surface: "admin",
    });
    expect(assembly.routes.map((route) => route.routeKey)).toEqual([
      "POST /admin/taxes/calculate",
      "POST /admin/taxes/categories",
      "POST /admin/taxes/providers",
      "POST /admin/taxes/rates",
      "POST /admin/taxes/regions",
    ]);
    expect(
      OpenApi.fromApi(assembly.api as typeof adminHttpApi).paths[
        "/admin/taxes/calculate"
      ]?.post
    ).toBeDefined();
  });
});

import { describe, expect, it } from "bun:test";

import { OpenApi } from "effect/unstable/httpapi";

import { adminHttpApi, storefrontHttpApi } from "../effect-http-api";
import { createEffectHttpApiAssembly } from "../effect-http-api-assembly";
import { storeEffectHttpApiContribution } from "../store-effect-http-api";

const storeHttpContributions = storeEffectHttpApiContribution.groups;

describe("store Effect HTTP API contribution", () => {
  it("contributes separate admin and storefront groups", () => {
    const admin = createEffectHttpApiAssembly({
      contributions: storeHttpContributions,
      root: adminHttpApi,
      surface: "admin",
    });
    const storefront = createEffectHttpApiAssembly({
      contributions: storeHttpContributions,
      root: storefrontHttpApi,
      surface: "storefront",
    });

    expect(admin.routes.map((route) => route.routeKey)).toEqual([
      "GET /admin/store/defaults",
      "GET /admin/store",
      "PATCH /admin/store",
    ]);
    expect(storefront.routes.map((route) => route.routeKey)).toEqual([
      "GET /store/defaults",
    ]);
    expect(storeEffectHttpApiContribution.moduleName).toBe("store");
  });

  it("derives store OpenAPI paths from the canonical Effect contracts", () => {
    const admin = createEffectHttpApiAssembly({
      contributions: storeHttpContributions,
      root: adminHttpApi,
      surface: "admin",
    });
    const storefront = createEffectHttpApiAssembly({
      contributions: storeHttpContributions,
      root: storefrontHttpApi,
      surface: "storefront",
    });
    const adminDocument = OpenApi.fromApi(admin.api);
    const storefrontDocument = OpenApi.fromApi(storefront.api);

    expect(adminDocument.paths["/admin/store"]?.get).toBeDefined();
    expect(adminDocument.paths["/admin/store"]?.patch).toBeDefined();
    expect(adminDocument.paths["/admin/store/defaults"]?.get).toBeDefined();
    expect(storefrontDocument.paths["/store/defaults"]?.get).toBeDefined();
    expect(storefrontDocument.paths["/admin/store"]?.get).toBeUndefined();
  });
});

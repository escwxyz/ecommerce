import { describe, expect, it } from "bun:test";

import {
  adminHttpApi,
  storefrontHttpApi,
} from "@ecommerce/api/effect-http-api";
import { createEffectHttpApiAssembly } from "@ecommerce/api/effect-http-api-assembly";
import { OpenApi } from "effect/unstable/httpapi";

import { storeEffectHttpApiContribution } from "../http/api";
import { storeModule } from "../module";

const storeHttpContributions = storeEffectHttpApiContribution.groups;

describe("store Effect HTTP API contribution", () => {
  it("contributes separate admin and storefront groups", () => {
    expect(storeModule.contributions?.apiGroups).toBe(
      storeEffectHttpApiContribution.groups
    );
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

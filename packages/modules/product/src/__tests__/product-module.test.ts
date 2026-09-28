import { describe, expect, it } from "bun:test";

import { adminHttpApi } from "@ecommerce/api/effect-http-api";
import { createEffectHttpApiAssembly } from "@ecommerce/api/effect-http-api-assembly";

import { productEffectHttpApiContribution } from "../http/api";
import { productModule } from "../module";
import { productPermissionList } from "../permissions";

describe("product module metadata", () => {
  it("exposes product metadata and its executable service", () => {
    expect(productModule.key).toBe("product");
    expect(
      productModule.contributions?.services?.map(({ key }) => key)
    ).toEqual(["product:service"]);
    expect(productModule.contributions?.adminSurfaces?.[0]?.label).toBe(
      "Products"
    );
    expect(productModule.contributions?.eventTypes).toContain(
      "product.catalog.updated"
    );
    expect(productModule.contributions?.apiGroups).toBe(
      productEffectHttpApiContribution.groups
    );
    expect(productModule.contributions?.permissions).toBe(
      productPermissionList
    );
    expect(productModule.contributions?.adminSurfaces?.[0]?.key).toBe(
      "product:navigation"
    );
    expect(
      productModule.contributions?.adminSurfaces?.[0]?.permission?.resource
    ).toBe("product");
  });

  it("preserves the product admin route fingerprint", () => {
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
  });
});

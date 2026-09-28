import { describe, expect, it } from "bun:test";

import { adminHttpApi } from "@ecommerce/api/effect-http-api";
import { createEffectHttpApiAssembly } from "@ecommerce/api/effect-http-api-assembly";

import { regionSalesChannelEffectHttpApiContribution } from "../http/api";
import { regionSalesChannelModule } from "../module";
import { regionSalesChannelPermissionList } from "../permissions";

describe("region sales-channel module metadata", () => {
  it("declares executable Effect services", () => {
    expect(regionSalesChannelModule.key).toBe("region-sales-channel");
    expect(
      regionSalesChannelModule.contributions?.services?.map(({ key }) => key)
    ).toEqual([
      "region-sales-channel:region-service",
      "region-sales-channel:sales-channel-service",
    ]);
    expect(regionSalesChannelModule.contributions?.eventTypes).toEqual([
      "region.created",
      "sales-channel.created",
      "sales-channel.product-published",
    ]);
    expect(regionSalesChannelModule.contributions?.apiGroups).toBe(
      regionSalesChannelEffectHttpApiContribution.groups
    );
    expect(regionSalesChannelModule.contributions?.permissions).toBe(
      regionSalesChannelPermissionList
    );
    expect(
      regionSalesChannelModule.contributions?.adminSurfaces?.[0]?.key
    ).toBe("region-sales-channel:regions-navigation");
    expect(
      regionSalesChannelModule.contributions?.adminSurfaces?.[0]?.permission
        ?.resource
    ).toBe("region");
  });

  it("preserves the region and sales-channel admin route fingerprint", () => {
    const admin = createEffectHttpApiAssembly({
      contributions: regionSalesChannelEffectHttpApiContribution.groups,
      root: adminHttpApi,
      surface: "admin",
    });

    expect(admin.routes.map((route) => route.routeKey)).toEqual([
      "POST /admin/regions",
      "POST /admin/regions/get",
      "GET /admin/regions",
      "POST /admin/regions/validate",
      "POST /admin/sales-channels",
      "POST /admin/sales-channels/get",
      "GET /admin/sales-channels",
      "POST /admin/sales-channels/products",
      "POST /admin/sales-channels/publishability",
    ]);
  });
});

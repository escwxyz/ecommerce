import { describe, expect, it } from "bun:test";

import { createAdminMetadataModel } from "./admin-metadata";
import {
  adminHttpApi,
  createEffectHttpApiAssembly,
  regionSalesChannelEffectHttpApiContribution,
} from "./index";
import {
  authorizationEvaluator,
  builtinPermissionStatement,
} from "./permissions";

describe("region sales-channel API and admin assembly", () => {
  it("includes region and sales-channel permissions in builtin composition", () => {
    expect(builtinPermissionStatement.region).toEqual(["read", "write"]);
    expect(builtinPermissionStatement["sales-channel"]).toEqual([
      "read",
      "write",
    ]);
  });

  it("includes region sales-channel Effect HTTP operations in canonical admin composition", () => {
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
    expect(regionSalesChannelEffectHttpApiContribution.moduleName).toBe(
      "region-sales-channel"
    );
  });

  it("exposes region sales-channel admin metadata through shared module contracts", () => {
    const metadata = createAdminMetadataModel({
      auth: {},
      authorization: authorizationEvaluator,
      session: {
        user: {
          permissions: [
            "region:read",
            "region:write",
            "sales-channel:read",
            "sales-channel:write",
          ],
        },
      },
    });

    expect(
      metadata.surfaces.some(
        (surface) => surface.source.key === "region-sales-channel"
      )
    ).toBe(true);
    expect(
      metadata.surfaces.find(
        (surface) => surface.source.key === "region-sales-channel"
      )?.permission?.resource
    ).toBe("region");
  });
});

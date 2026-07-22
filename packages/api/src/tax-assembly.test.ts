import { describe, expect, it } from "bun:test";

import { createAdminMetadataModel } from "./admin-metadata";
import { adminHttpApi, createEffectHttpApiAssembly } from "./index";
import { authorizationEvaluator } from "./permissions";
import { createBuiltinRouteFragments } from "./routers";
import { taxEffectHttpApiContribution } from "./tax-effect-http-api";

describe("tax API and admin assembly", () => {
  it("keeps migrated tax operations out of legacy oRPC composition", () => {
    expect(
      createBuiltinRouteFragments().map((fragment) => fragment.key)
    ).toEqual([
      "builtin:core",
      "module:notification-event",
      "module:order",
      "module:checkout",
    ]);
  });

  it("includes tax Effect HTTP operations in canonical admin composition", () => {
    const assembly = createEffectHttpApiAssembly({
      contributions: taxEffectHttpApiContribution.groups,
      root: adminHttpApi,
      surface: "admin",
    });

    expect(assembly.contributions.map((group) => group.key)).toEqual([
      "module:tax.admin",
    ]);
    expect(assembly.routes.map((route) => route.routeKey)).toEqual([
      "POST /admin/taxes/calculate",
      "POST /admin/taxes/categories",
      "POST /admin/taxes/providers",
      "POST /admin/taxes/rates",
      "POST /admin/taxes/regions",
    ]);
    expect(taxEffectHttpApiContribution.moduleName).toBe("tax");
  });

  it("exposes tax admin metadata through shared module contracts", () => {
    const metadata = createAdminMetadataModel({
      auth: {},
      authorization: authorizationEvaluator,
      session: {
        user: {
          permissions: ["tax:read"],
        },
      },
    });

    expect(
      metadata.surfaces.some((surface) => surface.source.key === "tax")
    ).toBe(true);
    expect(
      metadata.surfaces.find((surface) => surface.source.key === "tax")
        ?.permission?.resource
    ).toBe("tax");
  });
});

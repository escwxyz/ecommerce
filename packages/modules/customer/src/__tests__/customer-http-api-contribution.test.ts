import { describe, expect, it } from "bun:test";

import { adminHttpApi } from "@ecommerce/api/effect-http-api";
import { createEffectHttpApiAssembly } from "@ecommerce/api/effect-http-api-assembly";

import { customerEffectHttpApiContribution } from "../http/api";
import { customerModule } from "../module";
import { customerPermissionList } from "../permissions";

describe("customer HTTP API contribution", () => {
  it("registers its admin handlers with its module definition", () => {
    expect(customerModule.contributions?.apiGroups).toBe(
      customerEffectHttpApiContribution.groups
    );
    expect(
      customerModule.contributions?.apiGroups?.map(({ key }) => key)
    ).toEqual(["module:customer.admin"]);
    expect(customerModule.contributions?.permissions).toBe(
      customerPermissionList
    );
    expect(customerModule.contributions?.adminSurfaces?.[0]?.key).toBe(
      "customer:navigation"
    );
    expect(
      customerModule.contributions?.adminSurfaces?.[0]?.permission?.resource
    ).toBe("customer");
  });

  it("preserves the customer admin route fingerprint", () => {
    const admin = createEffectHttpApiAssembly({
      contributions: customerEffectHttpApiContribution.groups,
      root: adminHttpApi,
      surface: "admin",
    });

    expect(admin.routes.map((route) => route.routeKey)).toEqual([
      "POST /admin/customer-addresses",
      "POST /admin/customers/auth-link",
      "POST /admin/customers",
      "POST /admin/customers/get",
      "POST /admin/customer-groups/assign",
      "POST /admin/customer-groups",
      "GET /admin/customers",
      "POST /admin/customers/payment-identity",
      "PATCH /admin/customers",
      "POST /admin/customers/resolve-auth",
    ]);
  });
});

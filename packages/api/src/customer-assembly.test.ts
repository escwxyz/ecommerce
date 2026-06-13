import { describe, expect, it } from "bun:test";

import { createAdminMetadataModel } from "./admin-metadata";
import {
  builtinPermissionStatement,
  authorizationEvaluator,
} from "./permissions";
import { createBuiltinRouteFragments } from "./routers";

describe("customer API and admin assembly", () => {
  it("includes customer permissions in builtin permission composition", () => {
    expect(builtinPermissionStatement.customer).toEqual(["read", "write"]);
  });

  it("includes customer route operations in builtin API composition", () => {
    const customerFragment = createBuiltinRouteFragments().find(
      (fragment) => fragment.key === "module:customer"
    );

    expect(Object.keys(customerFragment?.router ?? {})).toContain(
      "customerResolveFromAuth"
    );
    expect(Object.keys(customerFragment?.router ?? {})).toContain(
      "customerPaymentIdentityGet"
    );
  });

  it("exposes customer admin metadata through shared module contracts", () => {
    const metadata = createAdminMetadataModel({
      auth: {},
      authorization: authorizationEvaluator,
      session: {
        user: {
          permissions: ["customer:read", "customer:write"],
        },
      },
    });

    expect(
      metadata.surfaces.some((surface) => surface.source.key === "customer")
    ).toBe(true);
    expect(
      metadata.surfaces.find((surface) => surface.source.key === "customer")
        ?.permission?.resource
    ).toBe("customer");
  });
});

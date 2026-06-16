import { describe, expect, it } from "bun:test";

import { createStoreAdminAuthSession } from "@ecommerce/auth/testing";

import { createAdminMetadataModel } from "./admin-metadata";
import {
  authorizationEvaluator,
  builtinPermissionStatement,
} from "./permissions";
import { createBuiltinRouteFragments } from "./routers";

describe("checkout API and admin assembly", () => {
  it("includes checkout permissions in builtin permission composition", () => {
    expect([...(builtinPermissionStatement.checkout ?? [])].sort()).toEqual([
      "execute",
      "read",
    ]);
  });

  it("does not register checkout route handlers without service options", () => {
    const checkoutFragment = createBuiltinRouteFragments().find(
      (fragment) => fragment.key === "module:checkout"
    );

    expect(checkoutFragment?.router).toEqual({});
  });

  it("includes checkout route handlers when service options are configured", () => {
    const checkoutFragment = createBuiltinRouteFragments({
      checkout: {
        createServiceOptionsForContext: () => {
          throw new Error("Factory should not be called during assembly.");
        },
      },
    }).find((fragment) => fragment.key === "module:checkout");

    expect(Object.keys(checkoutFragment?.router ?? {})).toContain(
      "checkoutComplete"
    );
  });

  it("exposes checkout admin metadata through shared module contracts", () => {
    const metadata = createAdminMetadataModel({
      auth: {},
      authorization: authorizationEvaluator,
      session: createStoreAdminAuthSession({
        permissions: ["checkout:read", "checkout:execute"],
      }),
    });

    expect(
      metadata.surfaces.some((surface) => surface.source.key === "checkout")
    ).toBe(true);
    expect(
      metadata.surfaces.find((surface) => surface.source.key === "checkout")
        ?.permission?.resource
    ).toBe("checkout");
  });
});

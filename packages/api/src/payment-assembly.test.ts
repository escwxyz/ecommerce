import { describe, expect, it } from "bun:test";

import { createAdminMetadataModel } from "./admin-metadata";
import {
  authorizationEvaluator,
  builtinPermissionStatement,
} from "./permissions";
import { createBuiltinRouteFragments } from "./routers";

describe("payment API and admin assembly", () => {
  it("includes payment permissions in builtin permission composition", () => {
    expect(builtinPermissionStatement.payment).toEqual(["read", "write"]);
  });

  it("includes payment route operations in builtin API composition", () => {
    const paymentFragment = createBuiltinRouteFragments().find(
      (fragment) => fragment.key === "module:payment"
    );

    expect(Object.keys(paymentFragment?.router ?? {})).toContain(
      "paymentCollectionCreate"
    );
    expect(Object.keys(paymentFragment?.router ?? {})).toContain(
      "paymentWebhookParse"
    );
  });

  it("exposes payment admin metadata through shared module contracts", () => {
    const metadata = createAdminMetadataModel({
      auth: {},
      authorization: authorizationEvaluator,
      session: {
        user: {
          permissions: ["payment:read", "payment:write"],
        },
      },
    });

    expect(
      metadata.surfaces.some((surface) => surface.source.key === "payment")
    ).toBe(true);
    expect(
      metadata.surfaces.find((surface) => surface.source.key === "payment")
        ?.permission?.resource
    ).toBe("payment");
  });
});

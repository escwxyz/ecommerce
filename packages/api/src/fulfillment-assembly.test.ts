import { describe, expect, it } from "bun:test";

import { createAdminMetadataModel } from "./admin-metadata";
import {
  authorizationEvaluator,
  builtinPermissionStatement,
} from "./permissions";
import { createBuiltinRouteFragments } from "./routers";

describe("fulfillment API and admin assembly", () => {
  it("includes fulfillment permissions in builtin permission composition", () => {
    expect(builtinPermissionStatement.fulfillment).toEqual(["read", "write"]);
  });

  it("includes fulfillment route operations in builtin API composition", () => {
    const fulfillmentFragment = createBuiltinRouteFragments().find(
      (fragment) => fragment.key === "module:fulfillment"
    );

    expect(Object.keys(fulfillmentFragment?.router ?? {})).toContain(
      "fulfillmentCreate"
    );
    expect(Object.keys(fulfillmentFragment?.router ?? {})).toContain(
      "fulfillmentShippingOptionList"
    );
  });

  it("exposes fulfillment admin metadata through shared module contracts", () => {
    const metadata = createAdminMetadataModel({
      auth: {},
      authorization: authorizationEvaluator,
      session: {
        user: {
          permissions: ["fulfillment:read", "fulfillment:write"],
        },
      },
    });

    expect(
      metadata.surfaces.some((surface) => surface.source.key === "fulfillment")
    ).toBe(true);
    expect(
      metadata.surfaces.find((surface) => surface.source.key === "fulfillment")
        ?.permission?.resource
    ).toBe("fulfillment");
  });
});

import { describe, expect, it } from "bun:test";

import { createAdminMetadataModel } from "./admin-metadata";
import {
  builtinPermissionStatement,
  authorizationEvaluator,
} from "./permissions";
import { createBuiltinRouteFragments } from "./routers";

describe("inventory API and admin assembly", () => {
  it("includes inventory permissions in builtin permission composition", () => {
    expect(builtinPermissionStatement.inventory).toEqual(["read", "write"]);
  });

  it("includes inventory route fragments in builtin API composition", () => {
    const inventoryFragment = createBuiltinRouteFragments().find(
      (fragment) => fragment.key === "module:inventory"
    );

    expect(Object.keys(inventoryFragment?.router ?? {})).toContain(
      "inventoryReserve"
    );
    expect(Object.keys(inventoryFragment?.router ?? {})).toContain(
      "inventoryAvailabilityCheck"
    );
  });

  it("exposes inventory admin metadata through shared module contracts", () => {
    const metadata = createAdminMetadataModel({
      auth: {},
      authorization: authorizationEvaluator,
      session: {
        user: {
          permissions: ["inventory:read", "inventory:write"],
        },
      },
    });

    expect(
      metadata.surfaces.some((surface) => surface.source.key === "inventory")
    ).toBe(true);
    expect(
      metadata.surfaces.find((surface) => surface.source.key === "inventory")
        ?.permission?.resource
    ).toBe("inventory");
  });
});

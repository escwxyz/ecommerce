import { describe, expect, it } from "bun:test";

import { createAdminMetadataModel } from "./admin-metadata";
import { authorizationEvaluator } from "./permissions";
import { createBuiltinRouteFragments } from "./routers";

describe("tax API and admin assembly", () => {
  it("includes tax route fragments in builtin API composition", () => {
    expect(
      createBuiltinRouteFragments().map((fragment) => fragment.key)
    ).toEqual([
      "builtin:core",
      "module:notification-event",
      "module:tax",
      "module:payment",
      "module:fulfillment",
      "module:order",
      "module:checkout",
    ]);
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

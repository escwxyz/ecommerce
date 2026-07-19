import { describe, expect, it } from "bun:test";

import { createAdminMetadataModel } from "./admin-metadata";
import { authorizationEvaluator } from "./permissions";
import { createBuiltinRouteFragments } from "./routers";

describe("promotion API and admin assembly", () => {
  it("includes promotion route fragments in builtin API composition", () => {
    expect(
      createBuiltinRouteFragments().map((fragment) => fragment.key)
    ).toEqual([
      "builtin:core",
      "module:notification-event",
      "module:promotion",
      "module:tax",
      "module:payment",
      "module:fulfillment",
      "module:cart",
      "module:order",
      "module:checkout",
    ]);
  });

  it("exposes promotion admin metadata through shared module contracts", () => {
    const metadata = createAdminMetadataModel({
      auth: {},
      authorization: authorizationEvaluator,
      session: {
        user: {
          permissions: ["promotion:read"],
        },
      },
    });

    expect(
      metadata.surfaces.some((surface) => surface.source.key === "promotion")
    ).toBe(true);
    expect(
      metadata.surfaces.find((surface) => surface.source.key === "promotion")
        ?.permission?.resource
    ).toBe("promotion");
  });
});

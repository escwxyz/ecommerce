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
      "module:store",
      "module:customer",
      "module:product",
      "module:region-sales-channel",
      "module:inventory",
      "module:notification-event",
      "module:pricing",
      "module:promotion",
      "module:tax",
      "module:payment",
      "module:fulfillment",
      "module:cart",
      "module:order",
      "module:checkout",
    ]);
  });

  it("includes customer route fragments before downstream transactional modules", () => {
    const fragmentKeys = createBuiltinRouteFragments().map(
      (fragment) => fragment.key
    );

    expect(fragmentKeys.indexOf("module:customer")).toBeGreaterThan(
      fragmentKeys.indexOf("module:store")
    );
    expect(fragmentKeys.indexOf("module:customer")).toBeLessThan(
      fragmentKeys.indexOf("module:product")
    );
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

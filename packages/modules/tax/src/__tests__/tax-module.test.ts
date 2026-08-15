import { describe, expect, it } from "bun:test";

import { taxExtensionPoints, taxModule } from "../module";

describe("tax module declaration", () => {
  it("declares Effect service, events, permissions, and extension points", () => {
    expect(taxModule.key).toBe("tax");
    expect(taxModule.providedServices?.map(({ key }) => key)).toEqual([
      "tax-service",
    ]);
    expect(taxModule.contributions?.eventTypes).toEqual([
      "tax.category-created",
      "tax.provider-configured",
      "tax.region-created",
      "tax.rate-created",
    ]);
    expect(taxModule.contributions?.apiFragments).toEqual([]);
    expect(taxModule).not.toHaveProperty("schema");
    expect(taxExtensionPoints.providerCalculators).toBe(
      "tax.provider-calculators"
    );
  });
});

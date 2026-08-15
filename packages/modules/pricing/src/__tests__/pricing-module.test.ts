import { describe, expect, it } from "bun:test";

import { pricingModule } from "../module";

describe("pricing module declaration", () => {
  it("declares Effect service, events, permissions, and no legacy API fragment", () => {
    expect(pricingModule.key).toBe("pricing");
    expect(pricingModule.providedServices?.map(({ key }) => key)).toEqual([
      "pricing-service",
    ]);
    expect(pricingModule.contributions?.apiFragments).toEqual([]);
    expect(pricingModule.contributions?.eventTypes).toEqual([
      "pricing.price-set-created",
    ]);
  });
});

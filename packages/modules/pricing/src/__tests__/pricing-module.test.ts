import { describe, expect, it } from "bun:test";

import { pricingModule } from "../module";

describe("pricing module declaration", () => {
  it("declares its executable Effect service, events, and permissions", () => {
    expect(pricingModule.key).toBe("pricing");
    expect(
      pricingModule.contributions?.services?.map(({ key }) => key)
    ).toEqual(["pricing:service"]);
    expect(pricingModule.contributions?.eventTypes).toEqual([
      "pricing.price-set-created",
    ]);
    expect(
      pricingModule.contributions?.permissions?.map(({ key }) => key)
    ).toEqual(["pricing:read", "pricing:write"]);
  });
});

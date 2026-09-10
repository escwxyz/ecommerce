import { describe, expect, it } from "bun:test";

import { regionSalesChannelModule } from "../module";

describe("region sales-channel module metadata", () => {
  it("declares executable Effect services", () => {
    expect(regionSalesChannelModule.key).toBe("region-sales-channel");
    expect(
      regionSalesChannelModule.contributions?.services?.map(({ key }) => key)
    ).toEqual([
      "region-sales-channel:region-service",
      "region-sales-channel:sales-channel-service",
    ]);
    expect(regionSalesChannelModule.contributions?.eventTypes).toEqual([
      "region.created",
      "sales-channel.created",
      "sales-channel.product-published",
    ]);
  });
});

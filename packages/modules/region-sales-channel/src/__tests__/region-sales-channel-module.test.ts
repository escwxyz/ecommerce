import { describe, expect, it } from "bun:test";

import { regionSalesChannelModule } from "../module";

describe("region sales-channel module metadata", () => {
  it("declares Effect services without legacy API fragments", () => {
    expect(regionSalesChannelModule.key).toBe("region-sales-channel");
    expect(regionSalesChannelModule.contributions?.apiFragments).toEqual([]);
    expect(
      regionSalesChannelModule.providedServices?.map(({ key }) => key)
    ).toEqual(["region-service", "sales-channel-service"]);
    expect(regionSalesChannelModule.contributions?.eventTypes).toEqual([
      "region.created",
      "sales-channel.created",
      "sales-channel.product-published",
    ]);
  });
});

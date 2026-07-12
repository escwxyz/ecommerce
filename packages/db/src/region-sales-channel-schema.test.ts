import { describe, expect, it } from "bun:test";

import {
  type CommerceDatabaseSchemaKey,
  regionSalesChannelSchema,
} from "./index";
import { commerceMigrations } from "./legacy";

describe("region sales-channel database assembly", () => {
  it("contributes module-owned tables and migration to the shared schema", () => {
    const keys = [
      "region",
      "region_country",
      "sales_channel",
      "sales_channel_product",
    ] as const satisfies readonly CommerceDatabaseSchemaKey[];

    expect(regionSalesChannelSchema.regionSalesChannelSchema).toEqual({
      region: "region",
      regionCountry: "region_country",
      salesChannel: "sales_channel",
      salesChannelProduct: "sales_channel_product",
    });
    expect(keys).toHaveLength(4);
    expect(commerceMigrations).toHaveProperty("003_region_sales_channel");
  });
});

import { describe, expect, it } from "bun:test";

import { pricingSchema, type CommerceDatabaseSchemaKey } from "./index";
import { commerceMigrations } from "./legacy";

describe("pricing database assembly", () => {
  it("contributes pricing-owned tables and migration to the shared schema", () => {
    const keys = [
      "pricing_currency",
      "pricing_price_set",
      "pricing_price_list",
      "pricing_money_amount",
      "pricing_price_rule",
      "pricing_price_preference",
    ] as const satisfies readonly CommerceDatabaseSchemaKey[];

    expect(pricingSchema.pricingSchema).toEqual({
      currency: "pricing_currency",
      moneyAmount: "pricing_money_amount",
      priceList: "pricing_price_list",
      pricePreference: "pricing_price_preference",
      priceRule: "pricing_price_rule",
      priceSet: "pricing_price_set",
    });
    expect(keys).toHaveLength(6);
    expect(commerceMigrations).toHaveProperty("004_pricing");
  });
});

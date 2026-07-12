import { describe, expect, it } from "bun:test";

import { type CommerceDatabaseSchemaKey, promotionSchema } from ".";
import { commerceMigrations } from "./legacy";

describe("promotion schema assembly", () => {
  it("contributes promotion-owned tables to the shared database contract", () => {
    const schemaKeys = [
      "promotion_campaign",
      "promotion_promotion",
      "promotion_rule",
      "promotion_usage_limit",
      "promotion_redemption",
    ] satisfies CommerceDatabaseSchemaKey[];

    expect(schemaKeys).toEqual([
      promotionSchema.promotionCampaignTableName,
      promotionSchema.promotionTableName,
      promotionSchema.promotionRuleTableName,
      promotionSchema.promotionUsageLimitTableName,
      promotionSchema.promotionRedemptionTableName,
    ]);
    expect(Object.keys(commerceMigrations)).toContain("005_promotion");
  });
});

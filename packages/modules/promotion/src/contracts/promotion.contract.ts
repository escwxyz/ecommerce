import { defineApiContractRoute } from "@ecommerce/module-contracts";

import {
  CalculatePromotionAdjustmentsInputSchema,
  CampaignApiRecordSchema,
  CreateCampaignInputSchema,
  CreatePromotionInputSchema,
  CreatePromotionRuleInputSchema,
  CreatePromotionUsageLimitInputSchema,
  PromotionAdjustmentResultSchema,
  PromotionApiRecordSchema,
  PromotionRedemptionApiRecordSchema,
  PromotionRuleApiRecordSchema,
  PromotionUsageLimitApiRecordSchema,
  RecordPromotionRedemptionInputSchema,
} from "../domain";

export const promotionContractRouter = {
  promotionAdjustmentsCalculate: defineApiContractRoute({
    description:
      "Validate promotion context and return traceable discount adjustments.",
    method: "POST",
    operationId: "promotionAdjustmentsCalculate",
    path: "/promotion/adjustments/calculate",
    successDescription: "Promotion adjustments returned.",
    summary: "Calculate promotion adjustments",
    tags: ["Promotion"],
  })
    .input(CalculatePromotionAdjustmentsInputSchema)
    .output(PromotionAdjustmentResultSchema),
  promotionCampaignCreate: defineApiContractRoute({
    description: "Create a promotion-owned campaign.",
    method: "POST",
    operationId: "promotionCampaignCreate",
    path: "/promotion/campaigns",
    successDescription: "Campaign created.",
    summary: "Create campaign",
    tags: ["Promotion"],
  })
    .input(CreateCampaignInputSchema)
    .output(CampaignApiRecordSchema),
  promotionCreate: defineApiContractRoute({
    description: "Create a promotion and its discount application policy.",
    method: "POST",
    operationId: "promotionCreate",
    path: "/promotion/promotions",
    successDescription: "Promotion created.",
    summary: "Create promotion",
    tags: ["Promotion"],
  })
    .input(CreatePromotionInputSchema)
    .output(PromotionApiRecordSchema),
  promotionRedemptionRecord: defineApiContractRoute({
    description: "Record promotion usage for limit enforcement.",
    method: "POST",
    operationId: "promotionRedemptionRecord",
    path: "/promotion/redemptions",
    successDescription: "Redemption recorded.",
    summary: "Record redemption",
    tags: ["Promotion"],
  })
    .input(RecordPromotionRedemptionInputSchema)
    .output(PromotionRedemptionApiRecordSchema),
  promotionRuleCreate: defineApiContractRoute({
    description: "Create a rule that scopes promotion eligibility.",
    method: "POST",
    operationId: "promotionRuleCreate",
    path: "/promotion/rules",
    successDescription: "Rule created.",
    summary: "Create promotion rule",
    tags: ["Promotion"],
  })
    .input(CreatePromotionRuleInputSchema)
    .output(PromotionRuleApiRecordSchema),
  promotionUsageLimitCreate: defineApiContractRoute({
    description: "Create a promotion usage limit.",
    method: "POST",
    operationId: "promotionUsageLimitCreate",
    path: "/promotion/usage-limits",
    successDescription: "Usage limit created.",
    summary: "Create usage limit",
    tags: ["Promotion"],
  })
    .input(CreatePromotionUsageLimitInputSchema)
    .output(PromotionUsageLimitApiRecordSchema),
} as const;

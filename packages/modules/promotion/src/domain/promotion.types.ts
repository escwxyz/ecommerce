import type { Brand } from "@ecommerce/core/brand";
import type { z } from "zod";

import type {
  CalculatePromotionAdjustmentsInputSchema,
  CampaignApiRecordSchema,
  CampaignRecordSchema,
  CreateCampaignInputSchema,
  CreatePromotionInputSchema,
  CreatePromotionRuleInputSchema,
  CreatePromotionUsageLimitInputSchema,
  PromotionAdjustmentResultSchema,
  PromotionApiRecordSchema,
  PromotionRecordSchema,
  PromotionRedemptionApiRecordSchema,
  PromotionRedemptionRecordSchema,
  PromotionRuleApiRecordSchema,
  PromotionRuleRecordSchema,
  PromotionStatusSchema,
  PromotionUsageLimitApiRecordSchema,
  PromotionUsageLimitRecordSchema,
  RecordPromotionRedemptionInputSchema,
} from "./promotion.schema";

export type CampaignId = Brand<string, "campaign">;
export type PromotionId = Brand<string, "promotion">;
export type PromotionRuleId = Brand<string, "promotion-rule">;
export type PromotionUsageLimitId = Brand<string, "promotion-usage-limit">;
export type PromotionAdjustmentId = Brand<string, "promotion-adjustment">;
export type PromotionRedemptionId = Brand<string, "promotion-redemption">;
export type PromotionStatus = z.infer<typeof PromotionStatusSchema>;
export type CreateCampaignInput = z.infer<typeof CreateCampaignInputSchema>;
export type CampaignRecord = Omit<
  z.infer<typeof CampaignRecordSchema>,
  "id"
> & { readonly id: CampaignId };
export type CampaignApiRecord = z.infer<typeof CampaignApiRecordSchema>;
export type CreatePromotionInput = z.infer<typeof CreatePromotionInputSchema>;
export type PromotionRecord = Omit<
  z.infer<typeof PromotionRecordSchema>,
  "campaignId" | "id"
> & {
  readonly campaignId: CampaignId | null;
  readonly id: PromotionId;
};
export type PromotionApiRecord = z.infer<typeof PromotionApiRecordSchema>;
export type CreatePromotionRuleInput = z.infer<
  typeof CreatePromotionRuleInputSchema
>;
export type PromotionRuleRecord = Omit<
  z.infer<typeof PromotionRuleRecordSchema>,
  "id" | "promotionId"
> & {
  readonly id: PromotionRuleId;
  readonly promotionId: PromotionId;
};
export type PromotionRuleApiRecord = z.infer<
  typeof PromotionRuleApiRecordSchema
>;
export type CreatePromotionUsageLimitInput = z.infer<
  typeof CreatePromotionUsageLimitInputSchema
>;
export type PromotionUsageLimitRecord = Omit<
  z.infer<typeof PromotionUsageLimitRecordSchema>,
  "id" | "promotionId"
> & {
  readonly id: PromotionUsageLimitId;
  readonly promotionId: PromotionId;
};
export type PromotionUsageLimitApiRecord = z.infer<
  typeof PromotionUsageLimitApiRecordSchema
>;
export type RecordPromotionRedemptionInput = z.infer<
  typeof RecordPromotionRedemptionInputSchema
>;
export type PromotionRedemptionRecord = Omit<
  z.infer<typeof PromotionRedemptionRecordSchema>,
  "id" | "promotionId"
> & {
  readonly id: PromotionRedemptionId;
  readonly promotionId: PromotionId;
};
export type PromotionRedemptionApiRecord = z.infer<
  typeof PromotionRedemptionApiRecordSchema
>;
export type CalculatePromotionAdjustmentsInput = z.infer<
  typeof CalculatePromotionAdjustmentsInputSchema
>;
export type PromotionAdjustmentResult = Omit<
  z.infer<typeof PromotionAdjustmentResultSchema>,
  "adjustments"
> & {
  readonly adjustments: (Omit<
    z.infer<typeof PromotionAdjustmentResultSchema>["adjustments"][number],
    "id" | "promotionId"
  > & {
    readonly id: PromotionAdjustmentId;
    readonly promotionId: PromotionId;
  })[];
};

export interface PromotionRepository {
  countRedemptions(promotionId: PromotionId): Promise<number>;
  findCampaignById(id: CampaignId): Promise<CampaignRecord | null>;
  findPromotionByCode(code: string): Promise<PromotionRecord | null>;
  findPromotionById(id: PromotionId): Promise<PromotionRecord | null>;
  findRulesByPromotionId(
    promotionId: PromotionId
  ): Promise<readonly PromotionRuleRecord[]>;
  findUsageLimitsByPromotionId(
    promotionId: PromotionId
  ): Promise<readonly PromotionUsageLimitRecord[]>;
  listAutomaticPromotions(): Promise<readonly PromotionRecord[]>;
  listRedemptions(
    promotionId: PromotionId
  ): Promise<readonly PromotionRedemptionRecord[]>;
  saveCampaign(campaign: CampaignRecord): Promise<CampaignRecord>;
  savePromotion(promotion: PromotionRecord): Promise<PromotionRecord>;
  saveRedemption(
    redemption: PromotionRedemptionRecord
  ): Promise<PromotionRedemptionRecord>;
  saveRule(rule: PromotionRuleRecord): Promise<PromotionRuleRecord>;
  saveUsageLimit(
    usageLimit: PromotionUsageLimitRecord
  ): Promise<PromotionUsageLimitRecord>;
}

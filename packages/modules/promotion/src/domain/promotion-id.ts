import type {
  CampaignId,
  PromotionAdjustmentId,
  PromotionId,
  PromotionRedemptionId,
  PromotionRuleId,
  PromotionUsageLimitId,
} from "./promotion.types";

export const CAMPAIGN_ID_PREFIX = "pcamp_" as const;
export const PROMOTION_ID_PREFIX = "promo_" as const;
export const PROMOTION_RULE_ID_PREFIX = "prule_" as const;
export const PROMOTION_USAGE_LIMIT_ID_PREFIX = "plimit_" as const;
export const PROMOTION_ADJUSTMENT_ID_PREFIX = "padj_" as const;
export const PROMOTION_REDEMPTION_ID_PREFIX = "pred_" as const;

export const createCampaignId = (value: string): CampaignId =>
  value as CampaignId;
export const serializeCampaignId = (id: CampaignId): string => id;

export const createPromotionId = (value: string): PromotionId =>
  value as PromotionId;
export const serializePromotionId = (id: PromotionId): string => id;

export const createPromotionRuleId = (value: string): PromotionRuleId =>
  value as PromotionRuleId;
export const serializePromotionRuleId = (id: PromotionRuleId): string => id;

export const createPromotionUsageLimitId = (
  value: string
): PromotionUsageLimitId => value as PromotionUsageLimitId;
export const serializePromotionUsageLimitId = (
  id: PromotionUsageLimitId
): string => id;

export const createPromotionAdjustmentId = (
  value: string
): PromotionAdjustmentId => value as PromotionAdjustmentId;
export const serializePromotionAdjustmentId = (
  id: PromotionAdjustmentId
): string => id;

export const createPromotionRedemptionId = (
  value: string
): PromotionRedemptionId => value as PromotionRedemptionId;
export const serializePromotionRedemptionId = (
  id: PromotionRedemptionId
): string => id;

import { Context } from "effect";
import type { Effect as EffectValue } from "effect/Effect";

import type { PromotionExpectedError } from "./promotion.errors";
import type {
  CalculatePromotionAdjustmentsInputSchema,
  CampaignApiRecordSchema,
  CampaignIdSchema,
  CampaignRecordSchema,
  CreateCampaignInputSchema,
  CreatePromotionInputSchema,
  CreatePromotionRuleInputSchema,
  CreatePromotionUsageLimitInputSchema,
  PromotionAdjustmentIdSchema,
  PromotionAdjustmentResultApiSchema,
  PromotionAdjustmentResultSchema,
  PromotionAdjustmentApiSchema,
  PromotionAdjustmentSchema,
  PromotionApiRecordSchema,
  PromotionIdSchema,
  PromotionIdentifierSchema,
  PromotionRedemptionApiRecordSchema,
  PromotionRedemptionIdSchema,
  PromotionRedemptionRecordSchema,
  PromotionRuleApiRecordSchema,
  PromotionRuleIdSchema,
  PromotionRuleRecordSchema,
  PromotionStatusSchema,
  PromotionUsageLimitApiRecordSchema,
  PromotionUsageLimitIdSchema,
  PromotionUsageLimitRecordSchema,
  PromotionUsageLimitScopeSchema,
  PromotionRecordSchema,
  RecordPromotionRedemptionInputSchema,
} from "./promotion.schema";

export type CampaignId = typeof CampaignIdSchema.Type;
export type PromotionId = typeof PromotionIdSchema.Type;
export type PromotionRuleId = typeof PromotionRuleIdSchema.Type;
export type PromotionUsageLimitId = typeof PromotionUsageLimitIdSchema.Type;
export type PromotionAdjustmentId = typeof PromotionAdjustmentIdSchema.Type;
export type PromotionRedemptionId = typeof PromotionRedemptionIdSchema.Type;
export type PromotionStatus = typeof PromotionStatusSchema.Type;
export type PromotionUsageLimitScope =
  typeof PromotionUsageLimitScopeSchema.Type;
export type CreateCampaignInput = typeof CreateCampaignInputSchema.Type;
export type CampaignRecord = typeof CampaignRecordSchema.Type;
export type CampaignApiRecord = typeof CampaignApiRecordSchema.Type;
export type CreatePromotionInput = typeof CreatePromotionInputSchema.Type;
export type PromotionRecord = typeof PromotionRecordSchema.Type;
export type PromotionApiRecord = typeof PromotionApiRecordSchema.Type;
export type CreatePromotionRuleInput =
  typeof CreatePromotionRuleInputSchema.Type;
export type PromotionRuleRecord = typeof PromotionRuleRecordSchema.Type;
export type PromotionRuleApiRecord = typeof PromotionRuleApiRecordSchema.Type;
export type CreatePromotionUsageLimitInput =
  typeof CreatePromotionUsageLimitInputSchema.Type;
export type PromotionUsageLimitRecord =
  typeof PromotionUsageLimitRecordSchema.Type;
export type PromotionUsageLimitApiRecord =
  typeof PromotionUsageLimitApiRecordSchema.Type;
export type RecordPromotionRedemptionInput =
  typeof RecordPromotionRedemptionInputSchema.Type;
export type PromotionRedemptionRecord =
  typeof PromotionRedemptionRecordSchema.Type;
export type PromotionRedemptionApiRecord =
  typeof PromotionRedemptionApiRecordSchema.Type;
export type CalculatePromotionAdjustmentsInput =
  typeof CalculatePromotionAdjustmentsInputSchema.Type;
export type PromotionAdjustment = typeof PromotionAdjustmentSchema.Type;
export type PromotionAdjustmentResult =
  typeof PromotionAdjustmentResultSchema.Type;
export type PromotionAdjustmentApi = typeof PromotionAdjustmentApiSchema.Type;
export type PromotionAdjustmentResultApi =
  typeof PromotionAdjustmentResultApiSchema.Type;
export type PromotionIdentifierInput = typeof PromotionIdentifierSchema.Type;

export interface PromotionRepository {
  readonly countRedemptions: (
    promotionId: PromotionId
  ) => EffectValue<number, PromotionExpectedError>;
  readonly findCampaignById: (
    id: CampaignId
  ) => EffectValue<CampaignRecord | null, PromotionExpectedError>;
  readonly findPromotionByCode: (
    code: string
  ) => EffectValue<PromotionRecord | null, PromotionExpectedError>;
  readonly findPromotionById: (
    id: PromotionId
  ) => EffectValue<PromotionRecord | null, PromotionExpectedError>;
  readonly findRulesByPromotionId: (
    promotionId: PromotionId
  ) => EffectValue<readonly PromotionRuleRecord[], PromotionExpectedError>;
  readonly findUsageLimitsByPromotionId: (
    promotionId: PromotionId
  ) => EffectValue<
    readonly PromotionUsageLimitRecord[],
    PromotionExpectedError
  >;
  readonly listAutomaticPromotions: EffectValue<
    readonly PromotionRecord[],
    PromotionExpectedError
  >;
  readonly listRedemptions: (
    promotionId: PromotionId
  ) => EffectValue<
    readonly PromotionRedemptionRecord[],
    PromotionExpectedError
  >;
  readonly saveCampaign: (
    campaign: CampaignRecord
  ) => EffectValue<CampaignRecord, PromotionExpectedError>;
  readonly savePromotion: (
    promotion: PromotionRecord
  ) => EffectValue<PromotionRecord, PromotionExpectedError>;
  readonly saveRedemption: (
    redemption: PromotionRedemptionRecord
  ) => EffectValue<PromotionRedemptionRecord, PromotionExpectedError>;
  readonly saveRule: (
    rule: PromotionRuleRecord
  ) => EffectValue<PromotionRuleRecord, PromotionExpectedError>;
  readonly saveUsageLimit: (
    usageLimit: PromotionUsageLimitRecord
  ) => EffectValue<PromotionUsageLimitRecord, PromotionExpectedError>;
}

/** Effect-native promotion repository contract consumed by promotion services. */
export const PromotionRepositoryService = Context.Service<PromotionRepository>(
  "@ecommerce/promotion/PromotionRepository"
);

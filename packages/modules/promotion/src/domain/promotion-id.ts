import { Effect, Schema } from "effect";
import type { Effect as EffectValue } from "effect/Effect";

import { PromotionInvalidIdentifier } from "./promotion.errors";
import {
  CampaignIdSchema,
  PromotionAdjustmentIdSchema,
  PromotionIdSchema,
  PromotionRedemptionIdSchema,
  PromotionRuleIdSchema,
  PromotionUsageLimitIdSchema,
} from "./promotion.schema";
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

const toInvalidIdentifier = (
  expectedPrefix: string,
  value: string
): PromotionInvalidIdentifier =>
  new PromotionInvalidIdentifier({ expectedPrefix, value });

export const createCampaignId = (value: string): CampaignId =>
  value as CampaignId;
export const createCampaignIdEffect = (
  value: string
): EffectValue<CampaignId, PromotionInvalidIdentifier> =>
  Schema.decodeUnknownEffect(CampaignIdSchema)(value).pipe(
    Effect.mapError(() => toInvalidIdentifier(CAMPAIGN_ID_PREFIX, value))
  );
export const serializeCampaignId = (id: CampaignId): string => id;

export const createPromotionId = (value: string): PromotionId =>
  value as PromotionId;
export const createPromotionIdEffect = (
  value: string
): EffectValue<PromotionId, PromotionInvalidIdentifier> =>
  Schema.decodeUnknownEffect(PromotionIdSchema)(value).pipe(
    Effect.mapError(() => toInvalidIdentifier(PROMOTION_ID_PREFIX, value))
  );
export const serializePromotionId = (id: PromotionId): string => id;

export const createPromotionRuleId = (value: string): PromotionRuleId =>
  value as PromotionRuleId;
export const createPromotionRuleIdEffect = (
  value: string
): EffectValue<PromotionRuleId, PromotionInvalidIdentifier> =>
  Schema.decodeUnknownEffect(PromotionRuleIdSchema)(value).pipe(
    Effect.mapError(() => toInvalidIdentifier(PROMOTION_RULE_ID_PREFIX, value))
  );
export const serializePromotionRuleId = (id: PromotionRuleId): string => id;

export const createPromotionUsageLimitId = (
  value: string
): PromotionUsageLimitId => value as PromotionUsageLimitId;
export const createPromotionUsageLimitIdEffect = (
  value: string
): EffectValue<PromotionUsageLimitId, PromotionInvalidIdentifier> =>
  Schema.decodeUnknownEffect(PromotionUsageLimitIdSchema)(value).pipe(
    Effect.mapError(() =>
      toInvalidIdentifier(PROMOTION_USAGE_LIMIT_ID_PREFIX, value)
    )
  );
export const serializePromotionUsageLimitId = (
  id: PromotionUsageLimitId
): string => id;

export const createPromotionAdjustmentId = (
  value: string
): PromotionAdjustmentId => value as PromotionAdjustmentId;
export const createPromotionAdjustmentIdEffect = (
  value: string
): EffectValue<PromotionAdjustmentId, PromotionInvalidIdentifier> =>
  Schema.decodeUnknownEffect(PromotionAdjustmentIdSchema)(value).pipe(
    Effect.mapError(() =>
      toInvalidIdentifier(PROMOTION_ADJUSTMENT_ID_PREFIX, value)
    )
  );
export const serializePromotionAdjustmentId = (
  id: PromotionAdjustmentId
): string => id;

export const createPromotionRedemptionId = (
  value: string
): PromotionRedemptionId => value as PromotionRedemptionId;
export const createPromotionRedemptionIdEffect = (
  value: string
): EffectValue<PromotionRedemptionId, PromotionInvalidIdentifier> =>
  Schema.decodeUnknownEffect(PromotionRedemptionIdSchema)(value).pipe(
    Effect.mapError(() =>
      toInvalidIdentifier(PROMOTION_REDEMPTION_ID_PREFIX, value)
    )
  );
export const serializePromotionRedemptionId = (
  id: PromotionRedemptionId
): string => id;

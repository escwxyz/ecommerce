import { defineEffectHttpApiModuleContribution } from "@ecommerce/api/effect-http-api";
import {
  CurrentEffectHttpRequestContext,
  withEffectHttpPermission,
} from "@ecommerce/api/effect-http-middleware";
import type { EffectHttpRequestIdentity } from "@ecommerce/api/effect-http-middleware";
import { defineCommerceModuleApiGroupContribution } from "@ecommerce/core";
import { Effect } from "effect";
import { HttpApi, HttpApiBuilder } from "effect/unstable/httpapi";

import {
  serializeCampaignId,
  serializePromotionAdjustmentId,
  serializePromotionId,
  serializePromotionRedemptionId,
  serializePromotionRuleId,
  serializePromotionUsageLimitId,
} from "../domain";
import type {
  CampaignApiRecord,
  CampaignRecord,
  PromotionAdjustmentResultApi,
  PromotionAdjustmentResult,
  PromotionApiRecord,
  PromotionRecord,
  PromotionRedemptionApiRecord,
  PromotionRedemptionRecord,
  PromotionRuleApiRecord,
  PromotionRuleRecord,
  PromotionUsageLimitApiRecord,
  PromotionUsageLimitRecord,
} from "../domain";
import { promotionPermissions } from "../permissions";
import { PromotionService } from "../services";
import { promotionAdminHttpApiGroup } from "./contract";

const serializeCampaign = (campaign: CampaignRecord): CampaignApiRecord => ({
  createdAt: campaign.createdAt.toISOString(),
  description: campaign.description,
  id: serializeCampaignId(campaign.id),
  metadata: campaign.metadata,
  name: campaign.name,
  updatedAt: campaign.updatedAt.toISOString(),
});

const serializePromotion = (
  promotion: PromotionRecord
): PromotionApiRecord => ({
  applicationMethod: promotion.applicationMethod,
  campaignId: promotion.campaignId
    ? serializeCampaignId(promotion.campaignId)
    : null,
  code: promotion.code,
  createdAt: promotion.createdAt.toISOString(),
  endsAt: promotion.endsAt?.toISOString() ?? null,
  id: serializePromotionId(promotion.id),
  metadata: promotion.metadata,
  startsAt: promotion.startsAt?.toISOString() ?? null,
  status: promotion.status,
  title: promotion.title,
  updatedAt: promotion.updatedAt.toISOString(),
});

const serializeRule = (rule: PromotionRuleRecord): PromotionRuleApiRecord => ({
  attribute: rule.attribute,
  createdAt: rule.createdAt.toISOString(),
  id: serializePromotionRuleId(rule.id),
  promotionId: serializePromotionId(rule.promotionId),
  updatedAt: rule.updatedAt.toISOString(),
  value: rule.value,
});

const serializeUsageLimit = (
  usageLimit: PromotionUsageLimitRecord
): PromotionUsageLimitApiRecord => ({
  createdAt: usageLimit.createdAt.toISOString(),
  id: serializePromotionUsageLimitId(usageLimit.id),
  limit: usageLimit.limit,
  promotionId: serializePromotionId(usageLimit.promotionId),
  scope: usageLimit.scope,
  updatedAt: usageLimit.updatedAt.toISOString(),
});

const serializeRedemption = (
  redemption: PromotionRedemptionRecord
): PromotionRedemptionApiRecord => ({
  adjustmentIds: redemption.adjustmentIds.map(serializePromotionAdjustmentId),
  cartId: redemption.cartId,
  createdAt: redemption.createdAt.toISOString(),
  id: serializePromotionRedemptionId(redemption.id),
  promotionId: serializePromotionId(redemption.promotionId),
});

const serializeAdjustmentResult = (
  result: PromotionAdjustmentResult
): PromotionAdjustmentResultApi => ({
  adjustments: result.adjustments.map((adjustment) => ({
    amount: adjustment.amount,
    currencyCode: adjustment.currencyCode,
    id: serializePromotionAdjustmentId(adjustment.id),
    promotionId: serializePromotionId(adjustment.promotionId),
    target: adjustment.target,
    trace: {
      promotionCode: adjustment.trace.promotionCode,
      ruleMatches: adjustment.trace.ruleMatches,
      source: adjustment.trace.source,
    },
  })),
  cartId: result.cartId,
  currencyCode: result.currencyCode,
  subtotal: result.subtotal,
  totalDiscount: result.totalDiscount,
});

const withSuccessEnvelope = <TData>(
  data: TData,
  request: EffectHttpRequestIdentity
) =>
  ({
    data,
    meta: { request },
    success: true,
  }) as const;

const withCurrentRequest = <TData, TError, TRequirements>(
  effect: Effect.Effect<TData, TError, TRequirements>
) =>
  Effect.gen(function* createPromotionApiSuccessEnvelope() {
    const context = yield* CurrentEffectHttpRequestContext;
    const data = yield* effect;
    return withSuccessEnvelope(data, context.identity);
  });

const promotionAdminGroupIdentifier = "promotionAdmin";
const promotionAdminHttpApi = HttpApi.make("PromotionAdminApi").add(
  promotionAdminHttpApiGroup
);

/** Public Effect HTTP handlers supplied by this module contribution. */
export const promotionAdminHttpApiHandlers = HttpApiBuilder.group(
  promotionAdminHttpApi,
  promotionAdminGroupIdentifier,
  (handlers) =>
    handlers
      .handle("promotionAdjustmentsCalculate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            PromotionService.use((service) =>
              service
                .calculateAdjustments(payload)
                .pipe(Effect.map(serializeAdjustmentResult))
            )
          ),
          promotionPermissions.read
        )
      )
      .handle("promotionCampaignCreate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            PromotionService.use((service) =>
              service
                .createCampaign(payload)
                .pipe(Effect.map(serializeCampaign))
            )
          ),
          promotionPermissions.write
        )
      )
      .handle("promotionCreate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            PromotionService.use((service) =>
              service
                .createPromotion(payload)
                .pipe(Effect.map(serializePromotion))
            )
          ),
          promotionPermissions.write
        )
      )
      .handle("promotionRedemptionRecord", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            PromotionService.use((service) =>
              service
                .recordRedemption(payload)
                .pipe(Effect.map(serializeRedemption))
            )
          ),
          promotionPermissions.write
        )
      )
      .handle("promotionRuleCreate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            PromotionService.use((service) =>
              service
                .createPromotionRule(payload)
                .pipe(Effect.map(serializeRule))
            )
          ),
          promotionPermissions.write
        )
      )
      .handle("promotionUsageLimitCreate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            PromotionService.use((service) =>
              service
                .createUsageLimit(payload)
                .pipe(Effect.map(serializeUsageLimit))
            )
          ),
          promotionPermissions.write
        )
      )
);

/** Executable HTTP contribution registered by the owning module definition. */
export const promotionEffectHttpApiContribution =
  defineEffectHttpApiModuleContribution({
    groups: [
      defineCommerceModuleApiGroupContribution({
        group: promotionAdminHttpApiGroup,
        handlers: promotionAdminHttpApiHandlers,
        key: "module:promotion.admin",
        surface: "admin",
      }),
    ],
    moduleName: "promotion",
  });

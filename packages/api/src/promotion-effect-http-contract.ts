import {
  RepositoryConflict,
  RepositoryDecodeFailure,
  RepositoryUnavailable,
  TransactionalMutationFailure,
} from "@ecommerce/core";
import {
  CalculatePromotionAdjustmentsInputSchema,
  CampaignApiRecordSchema,
  CreateCampaignInputSchema,
  CreatePromotionInputSchema,
  CreatePromotionRuleInputSchema,
  CreatePromotionUsageLimitInputSchema,
  PromotionAdjustmentResultApiSchema,
  PromotionCampaignNotFound,
  PromotionInvalidIdentifier,
  PromotionNotFound,
  PromotionRedemptionApiRecordSchema,
  PromotionRuleApiRecordSchema,
  PromotionUnsupportedUsageLimitScope,
  PromotionUsageLimitApiRecordSchema,
  PromotionValidationFailure,
  PromotionApiRecordSchema,
  RecordPromotionRedemptionInputSchema,
} from "@ecommerce/promotion";
import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from "effect/unstable/httpapi";

import {
  EffectHttpAuthMiddleware,
  EffectHttpExecutionMiddleware,
  EffectHttpForbidden,
  EffectHttpRequestContextMiddleware,
} from "./effect-http-middleware";
import { createApiSuccessSchema } from "./http-api-schemas";

const promotionDomainErrors = [
  PromotionCampaignNotFound.pipe(HttpApiSchema.status(404)),
  PromotionInvalidIdentifier.pipe(HttpApiSchema.status(400)),
  PromotionNotFound.pipe(HttpApiSchema.status(404)),
  PromotionUnsupportedUsageLimitScope.pipe(HttpApiSchema.status(400)),
  PromotionValidationFailure.pipe(HttpApiSchema.status(400)),
] as const;

const promotionPersistenceErrors = [
  RepositoryConflict.pipe(HttpApiSchema.status(409)),
  RepositoryDecodeFailure.pipe(HttpApiSchema.status(503)),
  RepositoryUnavailable.pipe(HttpApiSchema.status(503)),
  TransactionalMutationFailure.pipe(HttpApiSchema.status(503)),
] as const;

export const promotionReadErrors = [
  EffectHttpForbidden,
  ...promotionDomainErrors,
  ...promotionPersistenceErrors,
] as const;

export const promotionWriteErrors = [
  EffectHttpForbidden,
  ...promotionDomainErrors,
  ...promotionPersistenceErrors,
] as const;

export const CampaignApiRecordSuccessSchema = createApiSuccessSchema(
  CampaignApiRecordSchema
);
export const PromotionApiRecordSuccessSchema = createApiSuccessSchema(
  PromotionApiRecordSchema
);
export const PromotionRuleApiRecordSuccessSchema = createApiSuccessSchema(
  PromotionRuleApiRecordSchema
);
export const PromotionUsageLimitApiRecordSuccessSchema = createApiSuccessSchema(
  PromotionUsageLimitApiRecordSchema
);
export const PromotionRedemptionApiRecordSuccessSchema = createApiSuccessSchema(
  PromotionRedemptionApiRecordSchema
);
export const PromotionAdjustmentResultSuccessSchema = createApiSuccessSchema(
  PromotionAdjustmentResultApiSchema
);

const promotionAdminGroupIdentifier = "promotionAdmin";

/** Promotion admin Effect HTTP contract for campaigns, rules, usage limits, redemptions, and adjustment previews. */
export const promotionAdminHttpApiGroup = HttpApiGroup.make(
  promotionAdminGroupIdentifier
)
  .add(
    HttpApiEndpoint.post(
      "promotionAdjustmentsCalculate",
      "/admin/promotions/adjustments/calculate",
      {
        error: promotionReadErrors,
        payload: CalculatePromotionAdjustmentsInputSchema,
        success: PromotionAdjustmentResultSuccessSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post(
      "promotionCampaignCreate",
      "/admin/promotions/campaigns",
      {
        error: promotionWriteErrors,
        payload: CreateCampaignInputSchema,
        success: CampaignApiRecordSuccessSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post("promotionCreate", "/admin/promotions", {
      error: promotionWriteErrors,
      payload: CreatePromotionInputSchema,
      success: PromotionApiRecordSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.post(
      "promotionRedemptionRecord",
      "/admin/promotions/redemptions",
      {
        error: promotionWriteErrors,
        payload: RecordPromotionRedemptionInputSchema,
        success: PromotionRedemptionApiRecordSuccessSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post("promotionRuleCreate", "/admin/promotions/rules", {
      error: promotionWriteErrors,
      payload: CreatePromotionRuleInputSchema,
      success: PromotionRuleApiRecordSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.post(
      "promotionUsageLimitCreate",
      "/admin/promotions/usage-limits",
      {
        error: promotionWriteErrors,
        payload: CreatePromotionUsageLimitInputSchema,
        success: PromotionUsageLimitApiRecordSuccessSchema,
      }
    )
  )
  .middleware(EffectHttpExecutionMiddleware)
  .middleware(EffectHttpAuthMiddleware)
  .middleware(EffectHttpRequestContextMiddleware);

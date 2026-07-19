import {
  RepositoryConflict,
  RepositoryDecodeFailure,
  RepositoryUnavailable,
} from "@ecommerce/core";
import {
  CalculatedPriceApiSchema,
  CalculatePriceInputSchema,
  CreateCurrencyInputSchema,
  CreateMoneyAmountInputSchema,
  CreatePriceListInputSchema,
  CreatePricePreferenceInputSchema,
  CreatePriceRuleInputSchema,
  CreatePriceSetInputSchema,
  CurrencyApiListSchema,
  CurrencyApiRecordSchema,
  MoneyAmountApiRecordSchema,
  PriceListApiRecordSchema,
  PricePreferenceApiRecordSchema,
  PriceRuleApiRecordSchema,
  PriceSetApiRecordSchema,
  PricingCurrencyConflict,
  PricingInvalidIdentifier,
  PricingNoMatchingPrice,
  PricingPriceListNotFound,
  PricingPriceSetNotFound,
  PricingValidationFailure,
} from "@ecommerce/pricing";
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

const pricingDomainErrors = [
  PricingCurrencyConflict.pipe(HttpApiSchema.status(409)),
  PricingInvalidIdentifier.pipe(HttpApiSchema.status(400)),
  PricingNoMatchingPrice.pipe(HttpApiSchema.status(404)),
  PricingPriceListNotFound.pipe(HttpApiSchema.status(404)),
  PricingPriceSetNotFound.pipe(HttpApiSchema.status(404)),
  PricingValidationFailure.pipe(HttpApiSchema.status(400)),
] as const;

const pricingPersistenceErrors = [
  RepositoryConflict.pipe(HttpApiSchema.status(409)),
  RepositoryDecodeFailure.pipe(HttpApiSchema.status(503)),
  RepositoryUnavailable.pipe(HttpApiSchema.status(503)),
] as const;

export const pricingReadErrors = [
  EffectHttpForbidden,
  ...pricingDomainErrors,
  ...pricingPersistenceErrors,
] as const;

export const pricingWriteErrors = [
  EffectHttpForbidden,
  ...pricingDomainErrors,
  ...pricingPersistenceErrors,
] as const;

export const CalculatedPriceApiSuccessSchema = createApiSuccessSchema(
  CalculatedPriceApiSchema
);
export const CurrencyApiRecordSuccessSchema = createApiSuccessSchema(
  CurrencyApiRecordSchema
);
export const CurrencyApiListSuccessSchema = createApiSuccessSchema(
  CurrencyApiListSchema
);
export const MoneyAmountApiRecordSuccessSchema = createApiSuccessSchema(
  MoneyAmountApiRecordSchema
);
export const PriceListApiRecordSuccessSchema = createApiSuccessSchema(
  PriceListApiRecordSchema
);
export const PricePreferenceApiRecordSuccessSchema = createApiSuccessSchema(
  PricePreferenceApiRecordSchema
);
export const PriceRuleApiRecordSuccessSchema = createApiSuccessSchema(
  PriceRuleApiRecordSchema
);
export const PriceSetApiRecordSuccessSchema = createApiSuccessSchema(
  PriceSetApiRecordSchema
);

const pricingAdminGroupIdentifier = "pricingAdmin";

/** Pricing admin Effect HTTP contract for price-management operations. */
export const pricingAdminHttpApiGroup = HttpApiGroup.make(
  pricingAdminGroupIdentifier
)
  .add(
    HttpApiEndpoint.post("pricingCalculate", "/admin/pricing/calculate", {
      error: pricingReadErrors,
      payload: CalculatePriceInputSchema,
      success: CalculatedPriceApiSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.post("pricingCurrencyCreate", "/admin/pricing/currencies", {
      error: pricingWriteErrors,
      payload: CreateCurrencyInputSchema,
      success: CurrencyApiRecordSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.get("pricingCurrencyList", "/admin/pricing/currencies", {
      error: pricingReadErrors,
      success: CurrencyApiListSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.post(
      "pricingMoneyAmountCreate",
      "/admin/pricing/money-amounts",
      {
        error: pricingWriteErrors,
        payload: CreateMoneyAmountInputSchema,
        success: MoneyAmountApiRecordSuccessSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post(
      "pricingPriceListCreate",
      "/admin/pricing/price-lists",
      {
        error: pricingWriteErrors,
        payload: CreatePriceListInputSchema,
        success: PriceListApiRecordSuccessSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post(
      "pricingPricePreferenceCreate",
      "/admin/pricing/price-preferences",
      {
        error: pricingWriteErrors,
        payload: CreatePricePreferenceInputSchema,
        success: PricePreferenceApiRecordSuccessSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post(
      "pricingPriceRuleCreate",
      "/admin/pricing/price-rules",
      {
        error: pricingWriteErrors,
        payload: CreatePriceRuleInputSchema,
        success: PriceRuleApiRecordSuccessSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post("pricingPriceSetCreate", "/admin/pricing/price-sets", {
      error: pricingWriteErrors,
      payload: CreatePriceSetInputSchema,
      success: PriceSetApiRecordSuccessSchema,
    })
  )
  .middleware(EffectHttpExecutionMiddleware)
  .middleware(EffectHttpAuthMiddleware)
  .middleware(EffectHttpRequestContextMiddleware);

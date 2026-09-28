import {
  EffectHttpAuthMiddleware,
  EffectHttpExecutionMiddleware,
  EffectHttpForbidden,
  EffectHttpRequestContextMiddleware,
} from "@ecommerce/api/effect-http-middleware";
import { createApiSuccessSchema } from "@ecommerce/api/http-api-schemas";
import {
  RepositoryConflict,
  RepositoryDecodeFailure,
  RepositoryUnavailable,
  TransactionalMutationFailure,
} from "@ecommerce/core";
import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from "effect/unstable/httpapi";

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
} from "../domain";

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
  TransactionalMutationFailure.pipe(HttpApiSchema.status(503)),
] as const;

/** Declared HTTP error schemas for this module contract surface. */
export const pricingReadErrors = [
  EffectHttpForbidden,
  ...pricingDomainErrors,
  ...pricingPersistenceErrors,
] as const;

/** Declared HTTP error schemas for this module contract surface. */
export const pricingWriteErrors = [
  EffectHttpForbidden,
  ...pricingDomainErrors,
  ...pricingPersistenceErrors,
] as const;

/** Success envelope schema exported for contract-only API consumers. */
export const CalculatedPriceApiSuccessSchema = createApiSuccessSchema(
  CalculatedPriceApiSchema
);
/** Success envelope schema exported for contract-only API consumers. */
export const CurrencyApiRecordSuccessSchema = createApiSuccessSchema(
  CurrencyApiRecordSchema
);
/** Success envelope schema exported for contract-only API consumers. */
export const CurrencyApiListSuccessSchema = createApiSuccessSchema(
  CurrencyApiListSchema
);
/** Success envelope schema exported for contract-only API consumers. */
export const MoneyAmountApiRecordSuccessSchema = createApiSuccessSchema(
  MoneyAmountApiRecordSchema
);
/** Success envelope schema exported for contract-only API consumers. */
export const PriceListApiRecordSuccessSchema = createApiSuccessSchema(
  PriceListApiRecordSchema
);
/** Success envelope schema exported for contract-only API consumers. */
export const PricePreferenceApiRecordSuccessSchema = createApiSuccessSchema(
  PricePreferenceApiRecordSchema
);
/** Success envelope schema exported for contract-only API consumers. */
export const PriceRuleApiRecordSuccessSchema = createApiSuccessSchema(
  PriceRuleApiRecordSchema
);
/** Success envelope schema exported for contract-only API consumers. */
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

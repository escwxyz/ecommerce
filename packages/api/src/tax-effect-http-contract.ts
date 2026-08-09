import {
  RepositoryConflict,
  RepositoryDecodeFailure,
  RepositoryUnavailable,
  TransactionalMutationFailure,
} from "@ecommerce/core";
import {
  CalculateTaxInputSchema,
  CreateTaxCategoryInputSchema,
  CreateTaxProviderConfigInputSchema,
  CreateTaxRateInputSchema,
  CreateTaxRegionInputSchema,
  TaxCalculationResultApiSchema,
  TaxCategoryApiRecordSchema,
  TaxCategoryNotFound,
  TaxInvalidIdentifier,
  TaxProviderConfigApiRecordSchema,
  TaxProviderConfigNotFound,
  TaxProviderUnavailable,
  TaxRateApiRecordSchema,
  TaxRegionApiRecordSchema,
  TaxRegionNotFound,
  TaxValidationFailure,
} from "@ecommerce/tax";
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

const taxDomainErrors = [
  TaxCategoryNotFound.pipe(HttpApiSchema.status(404)),
  TaxInvalidIdentifier.pipe(HttpApiSchema.status(400)),
  TaxProviderConfigNotFound.pipe(HttpApiSchema.status(404)),
  TaxProviderUnavailable.pipe(HttpApiSchema.status(400)),
  TaxRegionNotFound.pipe(HttpApiSchema.status(404)),
  TaxValidationFailure.pipe(HttpApiSchema.status(400)),
] as const;

const taxPersistenceErrors = [
  RepositoryConflict.pipe(HttpApiSchema.status(409)),
  RepositoryDecodeFailure.pipe(HttpApiSchema.status(503)),
  RepositoryUnavailable.pipe(HttpApiSchema.status(503)),
  TransactionalMutationFailure.pipe(HttpApiSchema.status(503)),
] as const;

export const taxReadErrors = [
  EffectHttpForbidden,
  ...taxDomainErrors,
  ...taxPersistenceErrors,
] as const;

export const taxWriteErrors = [
  EffectHttpForbidden,
  ...taxDomainErrors,
  ...taxPersistenceErrors,
] as const;

export const TaxCalculationResultSuccessSchema = createApiSuccessSchema(
  TaxCalculationResultApiSchema
);
export const TaxCategoryApiRecordSuccessSchema = createApiSuccessSchema(
  TaxCategoryApiRecordSchema
);
export const TaxProviderConfigApiRecordSuccessSchema = createApiSuccessSchema(
  TaxProviderConfigApiRecordSchema
);
export const TaxRateApiRecordSuccessSchema = createApiSuccessSchema(
  TaxRateApiRecordSchema
);
export const TaxRegionApiRecordSuccessSchema = createApiSuccessSchema(
  TaxRegionApiRecordSchema
);

const taxAdminGroupIdentifier = "taxAdmin";

/** Tax admin Effect HTTP contract for provider config, regions, categories, rates, and calculation previews. */
export const taxAdminHttpApiGroup = HttpApiGroup.make(taxAdminGroupIdentifier)
  .add(
    HttpApiEndpoint.post("taxCalculate", "/admin/taxes/calculate", {
      error: taxReadErrors,
      payload: CalculateTaxInputSchema,
      success: TaxCalculationResultSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.post("taxCategoryCreate", "/admin/taxes/categories", {
      error: taxWriteErrors,
      payload: CreateTaxCategoryInputSchema,
      success: TaxCategoryApiRecordSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.post("taxProviderConfigCreate", "/admin/taxes/providers", {
      error: taxWriteErrors,
      payload: CreateTaxProviderConfigInputSchema,
      success: TaxProviderConfigApiRecordSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.post("taxRateCreate", "/admin/taxes/rates", {
      error: taxWriteErrors,
      payload: CreateTaxRateInputSchema,
      success: TaxRateApiRecordSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.post("taxRegionCreate", "/admin/taxes/regions", {
      error: taxWriteErrors,
      payload: CreateTaxRegionInputSchema,
      success: TaxRegionApiRecordSuccessSchema,
    })
  )
  .middleware(EffectHttpExecutionMiddleware)
  .middleware(EffectHttpAuthMiddleware)
  .middleware(EffectHttpRequestContextMiddleware);

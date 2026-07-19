import {
  RepositoryConflict,
  RepositoryDecodeFailure,
  RepositoryUnavailable,
} from "@ecommerce/core";
import {
  CheckPublishabilityInputSchema,
  CreateRegionInputSchema,
  CreateSalesChannelInputSchema,
  PublishProductInputSchema,
  RegionApiListSchema,
  RegionApiRecordSchema,
  RegionIdentifierSchema,
  RegionInvalidIdentifier,
  RegionNotFound,
  RegionSalesChannelEventPublishFailure,
  RegionValidationFailure,
  RegionValidationResultSchema,
  SalesChannelApiListSchema,
  SalesChannelApiRecordSchema,
  SalesChannelIdentifierSchema,
  SalesChannelInvalidIdentifier,
  SalesChannelNotFound,
  SalesChannelPublishabilityResultSchema,
  SalesChannelValidationFailure,
  ValidateRegionInputSchema,
} from "@ecommerce/region-sales-channel";
import { Schema } from "effect";
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

const regionSalesChannelDomainErrors = [
  RegionInvalidIdentifier.pipe(HttpApiSchema.status(400)),
  RegionNotFound.pipe(HttpApiSchema.status(404)),
  RegionSalesChannelEventPublishFailure.pipe(HttpApiSchema.status(503)),
  RegionValidationFailure.pipe(HttpApiSchema.status(400)),
  SalesChannelInvalidIdentifier.pipe(HttpApiSchema.status(400)),
  SalesChannelNotFound.pipe(HttpApiSchema.status(404)),
  SalesChannelValidationFailure.pipe(HttpApiSchema.status(400)),
] as const;

const regionSalesChannelPersistenceErrors = [
  RepositoryConflict.pipe(HttpApiSchema.status(409)),
  RepositoryDecodeFailure.pipe(HttpApiSchema.status(503)),
  RepositoryUnavailable.pipe(HttpApiSchema.status(503)),
] as const;

export const regionSalesChannelReadErrors = [
  EffectHttpForbidden,
  ...regionSalesChannelDomainErrors,
  ...regionSalesChannelPersistenceErrors,
] as const;

export const regionSalesChannelWriteErrors = [
  EffectHttpForbidden,
  ...regionSalesChannelDomainErrors,
  ...regionSalesChannelPersistenceErrors,
] as const;

export const RegionApiRecordSuccessSchema = createApiSuccessSchema(
  RegionApiRecordSchema
);
export const RegionApiNullableRecordSuccessSchema = createApiSuccessSchema(
  Schema.NullOr(RegionApiRecordSchema)
);
export const RegionApiListSuccessSchema =
  createApiSuccessSchema(RegionApiListSchema);
export const RegionValidationResultSuccessSchema = createApiSuccessSchema(
  RegionValidationResultSchema
);
export const SalesChannelApiRecordSuccessSchema = createApiSuccessSchema(
  SalesChannelApiRecordSchema
);
export const SalesChannelApiNullableRecordSuccessSchema =
  createApiSuccessSchema(Schema.NullOr(SalesChannelApiRecordSchema));
export const SalesChannelApiListSuccessSchema = createApiSuccessSchema(
  SalesChannelApiListSchema
);
export const SalesChannelPublishabilityResultSuccessSchema =
  createApiSuccessSchema(SalesChannelPublishabilityResultSchema);

const regionSalesChannelAdminGroupIdentifier = "regionSalesChannelAdmin";

/** Region and sales-channel admin Effect HTTP contract. */
export const regionSalesChannelAdminHttpApiGroup = HttpApiGroup.make(
  regionSalesChannelAdminGroupIdentifier
)
  .add(
    HttpApiEndpoint.post("regionCreate", "/admin/regions", {
      error: regionSalesChannelWriteErrors,
      payload: CreateRegionInputSchema,
      success: RegionApiRecordSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.post("regionGet", "/admin/regions/get", {
      error: regionSalesChannelReadErrors,
      payload: RegionIdentifierSchema,
      success: RegionApiNullableRecordSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.get("regionList", "/admin/regions", {
      error: regionSalesChannelReadErrors,
      success: RegionApiListSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.post("regionValidate", "/admin/regions/validate", {
      error: regionSalesChannelReadErrors,
      payload: ValidateRegionInputSchema,
      success: RegionValidationResultSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.post("salesChannelCreate", "/admin/sales-channels", {
      error: regionSalesChannelWriteErrors,
      payload: CreateSalesChannelInputSchema,
      success: SalesChannelApiRecordSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.post("salesChannelGet", "/admin/sales-channels/get", {
      error: regionSalesChannelReadErrors,
      payload: SalesChannelIdentifierSchema,
      success: SalesChannelApiNullableRecordSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.get("salesChannelList", "/admin/sales-channels", {
      error: regionSalesChannelReadErrors,
      success: SalesChannelApiListSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.post(
      "salesChannelProductPublish",
      "/admin/sales-channels/products",
      {
        error: regionSalesChannelWriteErrors,
        payload: PublishProductInputSchema,
        success: SalesChannelApiRecordSuccessSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post(
      "salesChannelPublishabilityCheck",
      "/admin/sales-channels/publishability",
      {
        error: regionSalesChannelReadErrors,
        payload: CheckPublishabilityInputSchema,
        success: SalesChannelPublishabilityResultSuccessSchema,
      }
    )
  )
  .middleware(EffectHttpExecutionMiddleware)
  .middleware(EffectHttpAuthMiddleware)
  .middleware(EffectHttpRequestContextMiddleware);

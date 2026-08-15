import {
  RepositoryConflict,
  RepositoryDecodeFailure,
  RepositoryUnavailable,
  TransactionalMutationFailure,
} from "@ecommerce/core";
import {
  CancelFulfillmentInputSchema,
  CreateFulfillmentInputSchema,
  CreateFulfillmentSetInputSchema,
  CreateServiceZoneInputSchema,
  CreateShippingOptionInputSchema,
  CreateShippingProfileInputSchema,
  FulfillmentApiSchema,
  FulfillmentDetailApiSchema,
  FulfillmentInvalidIdentifier,
  FulfillmentListApiSchema,
  FulfillmentNotFound,
  FulfillmentProviderApiRecordSchema,
  FulfillmentProviderUnavailable,
  FulfillmentSetApiSchema,
  FulfillmentSetNotFound,
  FulfillmentValidationFailure,
  ServiceZoneApiSchema,
  ServiceZoneNotFound,
  ShipmentRecordApiSchema,
  ShippingOptionApiSchema,
  ShippingOptionListApiSchema,
  ShippingOptionLookupInputSchema,
  ShippingOptionNotFound,
  ShippingOptionRateApiSchema,
  ShippingProfileApiSchema,
  ShippingProfileNotFound,
  TrackShipmentInputSchema,
} from "@ecommerce/fulfillment";
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

const fulfillmentDomainErrors = [
  FulfillmentInvalidIdentifier.pipe(HttpApiSchema.status(400)),
  FulfillmentNotFound.pipe(HttpApiSchema.status(404)),
  FulfillmentProviderUnavailable.pipe(HttpApiSchema.status(400)),
  FulfillmentSetNotFound.pipe(HttpApiSchema.status(404)),
  FulfillmentValidationFailure.pipe(HttpApiSchema.status(400)),
  ServiceZoneNotFound.pipe(HttpApiSchema.status(404)),
  ShippingOptionNotFound.pipe(HttpApiSchema.status(404)),
  ShippingProfileNotFound.pipe(HttpApiSchema.status(404)),
] as const;

const fulfillmentPersistenceErrors = [
  RepositoryConflict.pipe(HttpApiSchema.status(409)),
  RepositoryDecodeFailure.pipe(HttpApiSchema.status(503)),
  RepositoryUnavailable.pipe(HttpApiSchema.status(503)),
  TransactionalMutationFailure.pipe(HttpApiSchema.status(503)),
] as const;

export const fulfillmentReadErrors = [
  EffectHttpForbidden,
  ...fulfillmentDomainErrors,
  ...fulfillmentPersistenceErrors,
] as const;

export const fulfillmentWriteErrors = [
  EffectHttpForbidden,
  ...fulfillmentDomainErrors,
  ...fulfillmentPersistenceErrors,
] as const;

const RegisterFulfillmentProviderInputSchema = Schema.Struct({
  providerKey: Schema.NonEmptyString,
});

export const FulfillmentProviderRecordSuccessSchema = createApiSuccessSchema(
  FulfillmentProviderApiRecordSchema
);
export const FulfillmentSetApiRecordSuccessSchema = createApiSuccessSchema(
  FulfillmentSetApiSchema
);
export const ShippingProfileApiRecordSuccessSchema = createApiSuccessSchema(
  ShippingProfileApiSchema
);
export const ServiceZoneApiRecordSuccessSchema =
  createApiSuccessSchema(ServiceZoneApiSchema);
export const ShippingOptionApiRecordSuccessSchema = createApiSuccessSchema(
  ShippingOptionApiSchema
);
export const ShippingOptionListApiSuccessSchema = createApiSuccessSchema(
  ShippingOptionListApiSchema
);
export const ShippingOptionRateApiSuccessSchema = createApiSuccessSchema(
  ShippingOptionRateApiSchema
);
export const FulfillmentApiRecordSuccessSchema =
  createApiSuccessSchema(FulfillmentApiSchema);
export const FulfillmentListApiSuccessSchema = createApiSuccessSchema(
  FulfillmentListApiSchema
);
export const FulfillmentDetailApiSuccessSchema = createApiSuccessSchema(
  FulfillmentDetailApiSchema
);
export const ShipmentRecordNullableApiSuccessSchema = createApiSuccessSchema(
  Schema.NullOr(ShipmentRecordApiSchema)
);

const fulfillmentAdminGroupIdentifier = "fulfillmentAdmin";

/** Fulfillment admin Effect HTTP contract for provider, option, shipment, and fulfillment operations. */
export const fulfillmentAdminHttpApiGroup = HttpApiGroup.make(
  fulfillmentAdminGroupIdentifier
)
  .add(
    HttpApiEndpoint.post(
      "fulfillmentProviderRegister",
      "/admin/fulfillment/providers",
      {
        error: fulfillmentWriteErrors,
        payload: RegisterFulfillmentProviderInputSchema,
        success: FulfillmentProviderRecordSuccessSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post("fulfillmentSetCreate", "/admin/fulfillment/sets", {
      error: fulfillmentWriteErrors,
      payload: CreateFulfillmentSetInputSchema,
      success: FulfillmentSetApiRecordSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.post(
      "fulfillmentShippingProfileCreate",
      "/admin/fulfillment/shipping-profiles",
      {
        error: fulfillmentWriteErrors,
        payload: CreateShippingProfileInputSchema,
        success: ShippingProfileApiRecordSuccessSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post(
      "fulfillmentServiceZoneCreate",
      "/admin/fulfillment/service-zones",
      {
        error: fulfillmentWriteErrors,
        payload: CreateServiceZoneInputSchema,
        success: ServiceZoneApiRecordSuccessSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post(
      "fulfillmentShippingOptionCreate",
      "/admin/fulfillment/shipping-options",
      {
        error: fulfillmentWriteErrors,
        payload: CreateShippingOptionInputSchema,
        success: ShippingOptionApiRecordSuccessSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post(
      "fulfillmentShippingOptionList",
      "/admin/fulfillment/shipping-options/query",
      {
        error: fulfillmentReadErrors,
        payload: ShippingOptionLookupInputSchema,
        success: ShippingOptionListApiSuccessSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post(
      "fulfillmentShippingOptionRate",
      "/admin/fulfillment/shipping-options/rate",
      {
        error: fulfillmentReadErrors,
        payload: Schema.Struct({
          shippingOptionId:
            CreateFulfillmentInputSchema.fields.shippingOptionId,
        }),
        success: ShippingOptionRateApiSuccessSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post(
      "fulfillmentCreate",
      "/admin/fulfillment/fulfillments",
      {
        error: fulfillmentWriteErrors,
        payload: CreateFulfillmentInputSchema,
        success: FulfillmentDetailApiSuccessSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.get("fulfillmentList", "/admin/fulfillment/fulfillments", {
      error: fulfillmentReadErrors,
      success: FulfillmentListApiSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.post(
      "fulfillmentCancel",
      "/admin/fulfillment/fulfillments/cancel",
      {
        error: fulfillmentWriteErrors,
        payload: CancelFulfillmentInputSchema,
        success: FulfillmentApiRecordSuccessSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post(
      "fulfillmentTrackShipment",
      "/admin/fulfillment/shipments/track",
      {
        error: fulfillmentReadErrors,
        payload: TrackShipmentInputSchema,
        success: ShipmentRecordNullableApiSuccessSchema,
      }
    )
  )
  .middleware(EffectHttpExecutionMiddleware)
  .middleware(EffectHttpAuthMiddleware)
  .middleware(EffectHttpRequestContextMiddleware);

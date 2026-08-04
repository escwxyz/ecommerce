import { Effect, Schema } from "effect";
import type { Effect as EffectValue } from "effect/Effect";

import { FulfillmentInvalidIdentifier } from "./fulfillment.errors";
import {
  FULFILLMENT_ID_PREFIX,
  FULFILLMENT_PROVIDER_RECORD_ID_PREFIX,
  FULFILLMENT_SET_ID_PREFIX,
  FulfillmentIdSchema,
  FulfillmentProviderRecordIdSchema,
  FulfillmentSetIdSchema,
  RETURN_SHIPMENT_LINK_ID_PREFIX,
  ReturnShipmentLinkIdSchema,
  SERVICE_ZONE_ID_PREFIX,
  SHIPMENT_RECORD_ID_PREFIX,
  SHIPPING_OPTION_ID_PREFIX,
  SHIPPING_PROFILE_ID_PREFIX,
  ServiceZoneIdSchema,
  ShipmentRecordIdSchema,
  ShippingOptionIdSchema,
  ShippingProfileIdSchema,
} from "./fulfillment.schema";
import type {
  FulfillmentId,
  FulfillmentProviderRecordId,
  FulfillmentSetId,
  ReturnShipmentLinkId,
  ServiceZoneId,
  ShipmentRecordId,
  ShippingOptionId,
  ShippingProfileId,
} from "./fulfillment.types";

const toInvalidIdentifier = (
  expectedPrefix: string,
  value: string
): FulfillmentInvalidIdentifier =>
  new FulfillmentInvalidIdentifier({ expectedPrefix, value });

export const createFulfillmentProviderRecordId = (
  value: string
): FulfillmentProviderRecordId => value as FulfillmentProviderRecordId;
export const createFulfillmentProviderRecordIdEffect = (
  value: string
): EffectValue<FulfillmentProviderRecordId, FulfillmentInvalidIdentifier> =>
  Schema.decodeUnknownEffect(FulfillmentProviderRecordIdSchema)(value).pipe(
    Effect.mapError(() =>
      toInvalidIdentifier(FULFILLMENT_PROVIDER_RECORD_ID_PREFIX, value)
    )
  );
export const serializeFulfillmentProviderRecordId = (
  id: FulfillmentProviderRecordId
): string => id;

export const createFulfillmentSetId = (value: string): FulfillmentSetId =>
  value as FulfillmentSetId;
export const createFulfillmentSetIdEffect = (
  value: string
): EffectValue<FulfillmentSetId, FulfillmentInvalidIdentifier> =>
  Schema.decodeUnknownEffect(FulfillmentSetIdSchema)(value).pipe(
    Effect.mapError(() => toInvalidIdentifier(FULFILLMENT_SET_ID_PREFIX, value))
  );
export const serializeFulfillmentSetId = (id: FulfillmentSetId): string => id;

export const createShippingProfileId = (value: string): ShippingProfileId =>
  value as ShippingProfileId;
export const createShippingProfileIdEffect = (
  value: string
): EffectValue<ShippingProfileId, FulfillmentInvalidIdentifier> =>
  Schema.decodeUnknownEffect(ShippingProfileIdSchema)(value).pipe(
    Effect.mapError(() =>
      toInvalidIdentifier(SHIPPING_PROFILE_ID_PREFIX, value)
    )
  );
export const serializeShippingProfileId = (id: ShippingProfileId): string => id;

export const createServiceZoneId = (value: string): ServiceZoneId =>
  value as ServiceZoneId;
export const createServiceZoneIdEffect = (
  value: string
): EffectValue<ServiceZoneId, FulfillmentInvalidIdentifier> =>
  Schema.decodeUnknownEffect(ServiceZoneIdSchema)(value).pipe(
    Effect.mapError(() => toInvalidIdentifier(SERVICE_ZONE_ID_PREFIX, value))
  );
export const serializeServiceZoneId = (id: ServiceZoneId): string => id;

export const createShippingOptionId = (value: string): ShippingOptionId =>
  value as ShippingOptionId;
export const createShippingOptionIdEffect = (
  value: string
): EffectValue<ShippingOptionId, FulfillmentInvalidIdentifier> =>
  Schema.decodeUnknownEffect(ShippingOptionIdSchema)(value).pipe(
    Effect.mapError(() => toInvalidIdentifier(SHIPPING_OPTION_ID_PREFIX, value))
  );
export const serializeShippingOptionId = (id: ShippingOptionId): string => id;

export const createFulfillmentId = (value: string): FulfillmentId =>
  value as FulfillmentId;
export const createFulfillmentIdEffect = (
  value: string
): EffectValue<FulfillmentId, FulfillmentInvalidIdentifier> =>
  Schema.decodeUnknownEffect(FulfillmentIdSchema)(value).pipe(
    Effect.mapError(() => toInvalidIdentifier(FULFILLMENT_ID_PREFIX, value))
  );
export const serializeFulfillmentId = (id: FulfillmentId): string => id;

export const createShipmentRecordId = (value: string): ShipmentRecordId =>
  value as ShipmentRecordId;
export const createShipmentRecordIdEffect = (
  value: string
): EffectValue<ShipmentRecordId, FulfillmentInvalidIdentifier> =>
  Schema.decodeUnknownEffect(ShipmentRecordIdSchema)(value).pipe(
    Effect.mapError(() => toInvalidIdentifier(SHIPMENT_RECORD_ID_PREFIX, value))
  );
export const serializeShipmentRecordId = (id: ShipmentRecordId): string => id;

export const createReturnShipmentLinkId = (
  value: string
): ReturnShipmentLinkId => value as ReturnShipmentLinkId;
export const createReturnShipmentLinkIdEffect = (
  value: string
): EffectValue<ReturnShipmentLinkId, FulfillmentInvalidIdentifier> =>
  Schema.decodeUnknownEffect(ReturnShipmentLinkIdSchema)(value).pipe(
    Effect.mapError(() =>
      toInvalidIdentifier(RETURN_SHIPMENT_LINK_ID_PREFIX, value)
    )
  );
export const serializeReturnShipmentLinkId = (
  id: ReturnShipmentLinkId
): string => id;

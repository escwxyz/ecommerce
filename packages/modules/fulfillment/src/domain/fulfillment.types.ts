import { Context } from "effect";
import type { Effect as EffectValue } from "effect/Effect";

import type { FulfillmentExpectedError } from "./fulfillment.errors";
import type {
  CancelFulfillmentInputSchema,
  CreateFulfillmentInputSchema,
  CreateFulfillmentSetInputSchema,
  CreateServiceZoneInputSchema,
  CreateShippingOptionInputSchema,
  CreateShippingProfileInputSchema,
  FulfillmentAddressSchema,
  FulfillmentApiSchema,
  FulfillmentDetailApiSchema,
  FulfillmentIdSchema,
  FulfillmentLineItemSchema,
  FulfillmentListApiSchema,
  FulfillmentMoneySchema,
  FulfillmentProviderApiRecordSchema,
  FulfillmentProviderRecordIdSchema,
  FulfillmentProviderRecordSchema,
  FulfillmentSchema,
  FulfillmentSetApiSchema,
  FulfillmentSetIdSchema,
  FulfillmentSetSchema,
  FulfillmentStatusSchema,
  ReturnShipmentLinkApiSchema,
  ReturnShipmentLinkIdSchema,
  ReturnShipmentLinkSchema,
  ServiceZoneApiSchema,
  ServiceZoneIdSchema,
  ServiceZoneSchema,
  ShipmentRecordApiSchema,
  ShipmentRecordIdSchema,
  ShipmentRecordSchema,
  ShipmentStatusSchema,
  ShippingOptionApiSchema,
  ShippingOptionIdSchema,
  ShippingOptionListApiSchema,
  ShippingOptionLookupInputSchema,
  ShippingOptionRateApiSchema,
  ShippingOptionSchema,
  ShippingProfileApiSchema,
  ShippingProfileIdSchema,
  ShippingProfileSchema,
  TrackShipmentInputSchema,
} from "./fulfillment.schema";

export type FulfillmentProviderRecordId =
  typeof FulfillmentProviderRecordIdSchema.Type;
export type FulfillmentSetId = typeof FulfillmentSetIdSchema.Type;
export type ShippingProfileId = typeof ShippingProfileIdSchema.Type;
export type ServiceZoneId = typeof ServiceZoneIdSchema.Type;
export type ShippingOptionId = typeof ShippingOptionIdSchema.Type;
export type FulfillmentId = typeof FulfillmentIdSchema.Type;
export type ShipmentRecordId = typeof ShipmentRecordIdSchema.Type;
export type ReturnShipmentLinkId = typeof ReturnShipmentLinkIdSchema.Type;

export type FulfillmentProviderMoney = typeof FulfillmentMoneySchema.Type;
export type FulfillmentAddress = typeof FulfillmentAddressSchema.Type;
export type FulfillmentLineItem = typeof FulfillmentLineItemSchema.Type;
export type FulfillmentStatus = typeof FulfillmentStatusSchema.Type;
export type ShipmentStatus = typeof ShipmentStatusSchema.Type;
export type CreateFulfillmentSetInput =
  typeof CreateFulfillmentSetInputSchema.Type;
export type CreateShippingProfileInput =
  typeof CreateShippingProfileInputSchema.Type;
export type CreateServiceZoneInput = typeof CreateServiceZoneInputSchema.Type;
export type CreateShippingOptionInput =
  typeof CreateShippingOptionInputSchema.Type;
export type ShippingOptionLookupInput =
  typeof ShippingOptionLookupInputSchema.Type;
export type CreateFulfillmentInput = typeof CreateFulfillmentInputSchema.Type;
export type CancelFulfillmentInput = typeof CancelFulfillmentInputSchema.Type;
export type TrackShipmentInput = typeof TrackShipmentInputSchema.Type;

export type FulfillmentProviderRecord =
  typeof FulfillmentProviderRecordSchema.Type;
export type FulfillmentSet = typeof FulfillmentSetSchema.Type;
export type ShippingProfile = typeof ShippingProfileSchema.Type;
export type ServiceZone = typeof ServiceZoneSchema.Type;
export type ShippingOption = typeof ShippingOptionSchema.Type;
export type Fulfillment = typeof FulfillmentSchema.Type;
export type ShipmentRecord = typeof ShipmentRecordSchema.Type;
export type ReturnShipmentLink = typeof ReturnShipmentLinkSchema.Type;

export type FulfillmentProviderApiRecord =
  typeof FulfillmentProviderApiRecordSchema.Type;
export type FulfillmentSetApiRecord = typeof FulfillmentSetApiSchema.Type;
export type ShippingProfileApiRecord = typeof ShippingProfileApiSchema.Type;
export type ServiceZoneApiRecord = typeof ServiceZoneApiSchema.Type;
export type ShippingOptionApiRecord = typeof ShippingOptionApiSchema.Type;
export type FulfillmentApiRecord = typeof FulfillmentApiSchema.Type;
export type ShipmentRecordApiRecord = typeof ShipmentRecordApiSchema.Type;
export type ReturnShipmentLinkApiRecord =
  typeof ReturnShipmentLinkApiSchema.Type;
export type ShippingOptionRateApiRecord =
  typeof ShippingOptionRateApiSchema.Type;
export type FulfillmentDetailApiRecord = typeof FulfillmentDetailApiSchema.Type;
export type ShippingOptionListApiRecord =
  typeof ShippingOptionListApiSchema.Type;
export type FulfillmentListApiRecord = typeof FulfillmentListApiSchema.Type;

export interface FulfillmentDetail {
  readonly fulfillment: Fulfillment;
  readonly shipments: readonly ShipmentRecord[];
}

export interface FulfillmentRepository {
  readonly findFulfillmentById: (
    id: FulfillmentId
  ) => EffectValue<Fulfillment | null, FulfillmentExpectedError>;
  readonly findFulfillmentByIdempotencyKey: (
    idempotencyKey: string
  ) => EffectValue<Fulfillment | null, FulfillmentExpectedError>;
  readonly findFulfillmentSetById: (
    id: FulfillmentSetId
  ) => EffectValue<FulfillmentSet | null, FulfillmentExpectedError>;
  readonly findServiceZoneById: (
    id: ServiceZoneId
  ) => EffectValue<ServiceZone | null, FulfillmentExpectedError>;
  readonly findShipmentByFulfillmentId: (
    fulfillmentId: FulfillmentId
  ) => EffectValue<ShipmentRecord | null, FulfillmentExpectedError>;
  readonly findShippingOptionById: (
    id: ShippingOptionId
  ) => EffectValue<ShippingOption | null, FulfillmentExpectedError>;
  readonly findShippingProfileById: (
    id: ShippingProfileId
  ) => EffectValue<ShippingProfile | null, FulfillmentExpectedError>;
  readonly listFulfillments: EffectValue<
    readonly Fulfillment[],
    FulfillmentExpectedError
  >;
  readonly listServiceZonesForSet: (
    fulfillmentSetId: FulfillmentSetId
  ) => EffectValue<readonly ServiceZone[], FulfillmentExpectedError>;
  readonly listShipmentsForFulfillment: (
    fulfillmentId: FulfillmentId
  ) => EffectValue<readonly ShipmentRecord[], FulfillmentExpectedError>;
  readonly listShippingOptions: (
    input?: ShippingOptionLookupInput
  ) => EffectValue<readonly ShippingOption[], FulfillmentExpectedError>;
  readonly saveFulfillment: (
    fulfillment: Fulfillment
  ) => EffectValue<Fulfillment, FulfillmentExpectedError>;
  readonly saveFulfillmentSet: (
    fulfillmentSet: FulfillmentSet
  ) => EffectValue<FulfillmentSet, FulfillmentExpectedError>;
  readonly saveProviderRecord: (
    providerRecord: FulfillmentProviderRecord
  ) => EffectValue<FulfillmentProviderRecord, FulfillmentExpectedError>;
  readonly saveReturnShipmentLink: (
    link: ReturnShipmentLink
  ) => EffectValue<ReturnShipmentLink, FulfillmentExpectedError>;
  readonly saveServiceZone: (
    serviceZone: ServiceZone
  ) => EffectValue<ServiceZone, FulfillmentExpectedError>;
  readonly saveShipment: (
    shipment: ShipmentRecord
  ) => EffectValue<ShipmentRecord, FulfillmentExpectedError>;
  readonly saveShippingOption: (
    shippingOption: ShippingOption
  ) => EffectValue<ShippingOption, FulfillmentExpectedError>;
  readonly saveShippingProfile: (
    shippingProfile: ShippingProfile
  ) => EffectValue<ShippingProfile, FulfillmentExpectedError>;
}

/** Effect-native fulfillment repository contract consumed by fulfillment services. */
export const FulfillmentRepositoryService =
  Context.Service<FulfillmentRepository>(
    "@ecommerce/fulfillment/FulfillmentRepositoryService"
  );

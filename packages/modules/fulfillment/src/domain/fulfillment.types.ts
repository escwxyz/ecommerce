import type { Brand } from "@ecommerce/core/brand";
import type { z } from "zod";

import type {
  CancelFulfillmentInputSchema,
  CreateFulfillmentInputSchema,
  CreateFulfillmentSetInputSchema,
  CreateServiceZoneInputSchema,
  CreateShippingOptionInputSchema,
  CreateShippingProfileInputSchema,
  FulfillmentApiSchema,
  FulfillmentDetailApiSchema,
  FulfillmentListApiSchema,
  FulfillmentProviderApiRecordSchema,
  FulfillmentProviderRecordSchema,
  FulfillmentSchema,
  FulfillmentSetApiSchema,
  FulfillmentSetSchema,
  FulfillmentStatusSchema,
  ReturnShipmentLinkApiSchema,
  ReturnShipmentLinkSchema,
  ServiceZoneApiSchema,
  ServiceZoneSchema,
  ShipmentRecordApiSchema,
  ShipmentRecordSchema,
  ShipmentStatusSchema,
  ShippingOptionApiSchema,
  ShippingOptionListApiSchema,
  ShippingOptionLookupInputSchema,
  ShippingOptionRateApiSchema,
  ShippingOptionSchema,
  ShippingProfileApiSchema,
  ShippingProfileSchema,
  TrackShipmentInputSchema,
} from "./fulfillment.schema";

export type FulfillmentProviderRecordId = Brand<
  string,
  "fulfillment-provider-record"
>;
export type FulfillmentSetId = Brand<string, "fulfillment-set">;
export type ShippingProfileId = Brand<string, "shipping-profile">;
export type ServiceZoneId = Brand<string, "service-zone">;
export type ShippingOptionId = Brand<string, "shipping-option">;
export type FulfillmentId = Brand<string, "fulfillment">;
export type ShipmentRecordId = Brand<string, "shipment-record">;
export type ReturnShipmentLinkId = Brand<string, "return-shipment-link">;

export type FulfillmentStatus = z.infer<typeof FulfillmentStatusSchema>;
export type ShipmentStatus = z.infer<typeof ShipmentStatusSchema>;
export type CreateFulfillmentSetInput = z.infer<
  typeof CreateFulfillmentSetInputSchema
>;
export type CreateShippingProfileInput = z.infer<
  typeof CreateShippingProfileInputSchema
>;
export type CreateServiceZoneInput = z.infer<
  typeof CreateServiceZoneInputSchema
>;
export type CreateShippingOptionInput = z.infer<
  typeof CreateShippingOptionInputSchema
>;
export type ShippingOptionLookupInput = z.infer<
  typeof ShippingOptionLookupInputSchema
>;
export type CreateFulfillmentInput = z.infer<
  typeof CreateFulfillmentInputSchema
>;
export type CancelFulfillmentInput = z.infer<
  typeof CancelFulfillmentInputSchema
>;
export type TrackShipmentInput = z.infer<typeof TrackShipmentInputSchema>;

export type FulfillmentProviderRecord = Omit<
  z.infer<typeof FulfillmentProviderRecordSchema>,
  "id"
> & { readonly id: FulfillmentProviderRecordId };
export type FulfillmentSet = Omit<
  z.infer<typeof FulfillmentSetSchema>,
  "id"
> & { readonly id: FulfillmentSetId };
export type ShippingProfile = Omit<
  z.infer<typeof ShippingProfileSchema>,
  "fulfillmentSetId" | "id"
> & {
  readonly fulfillmentSetId: FulfillmentSetId;
  readonly id: ShippingProfileId;
};
export type ServiceZone = Omit<
  z.infer<typeof ServiceZoneSchema>,
  "fulfillmentSetId" | "id"
> & {
  readonly fulfillmentSetId: FulfillmentSetId;
  readonly id: ServiceZoneId;
};
export type ShippingOption = Omit<
  z.infer<typeof ShippingOptionSchema>,
  "fulfillmentSetId" | "id" | "profileId" | "serviceZoneId"
> & {
  readonly fulfillmentSetId: FulfillmentSetId;
  readonly id: ShippingOptionId;
  readonly profileId: ShippingProfileId;
  readonly serviceZoneId: ServiceZoneId;
};
export type Fulfillment = Omit<
  z.infer<typeof FulfillmentSchema>,
  "id" | "shippingOptionId"
> & {
  readonly id: FulfillmentId;
  readonly shippingOptionId: ShippingOptionId;
};
export type ShipmentRecord = Omit<
  z.infer<typeof ShipmentRecordSchema>,
  "fulfillmentId" | "id"
> & {
  readonly fulfillmentId: FulfillmentId;
  readonly id: ShipmentRecordId;
};
export type ReturnShipmentLink = Omit<
  z.infer<typeof ReturnShipmentLinkSchema>,
  "fulfillmentId" | "id" | "shipmentId"
> & {
  readonly fulfillmentId: FulfillmentId;
  readonly id: ReturnShipmentLinkId;
  readonly shipmentId: ShipmentRecordId;
};

export type FulfillmentProviderApiRecord = z.infer<
  typeof FulfillmentProviderApiRecordSchema
>;
export type FulfillmentSetApiRecord = z.infer<typeof FulfillmentSetApiSchema>;
export type ShippingProfileApiRecord = z.infer<typeof ShippingProfileApiSchema>;
export type ServiceZoneApiRecord = z.infer<typeof ServiceZoneApiSchema>;
export type ShippingOptionApiRecord = z.infer<typeof ShippingOptionApiSchema>;
export type FulfillmentApiRecord = z.infer<typeof FulfillmentApiSchema>;
export type ShipmentRecordApiRecord = z.infer<typeof ShipmentRecordApiSchema>;
export type ReturnShipmentLinkApiRecord = z.infer<
  typeof ReturnShipmentLinkApiSchema
>;
export type ShippingOptionRateApiRecord = z.infer<
  typeof ShippingOptionRateApiSchema
>;
export type FulfillmentDetailApiRecord = z.infer<
  typeof FulfillmentDetailApiSchema
>;
export type ShippingOptionListApiRecord = z.infer<
  typeof ShippingOptionListApiSchema
>;
export type FulfillmentListApiRecord = z.infer<typeof FulfillmentListApiSchema>;

export interface FulfillmentDetail {
  readonly fulfillment: Fulfillment;
  readonly shipments: readonly ShipmentRecord[];
}

export interface FulfillmentRepository {
  findFulfillmentById(id: FulfillmentId): Promise<Fulfillment | null>;
  findFulfillmentByIdempotencyKey(
    idempotencyKey: string
  ): Promise<Fulfillment | null>;
  findFulfillmentSetById(id: FulfillmentSetId): Promise<FulfillmentSet | null>;
  findServiceZoneById(id: ServiceZoneId): Promise<ServiceZone | null>;
  findShipmentByFulfillmentId(
    fulfillmentId: FulfillmentId
  ): Promise<ShipmentRecord | null>;
  findShippingOptionById(id: ShippingOptionId): Promise<ShippingOption | null>;
  findShippingProfileById(
    id: ShippingProfileId
  ): Promise<ShippingProfile | null>;
  listFulfillments(): Promise<readonly Fulfillment[]>;
  listServiceZonesForSet(
    fulfillmentSetId: FulfillmentSetId
  ): Promise<readonly ServiceZone[]>;
  listShipmentsForFulfillment(
    fulfillmentId: FulfillmentId
  ): Promise<readonly ShipmentRecord[]>;
  listShippingOptions(
    input?: ShippingOptionLookupInput
  ): Promise<readonly ShippingOption[]>;
  saveFulfillment(fulfillment: Fulfillment): Promise<Fulfillment>;
  saveFulfillmentSet(fulfillmentSet: FulfillmentSet): Promise<FulfillmentSet>;
  saveProviderRecord(
    providerRecord: FulfillmentProviderRecord
  ): Promise<FulfillmentProviderRecord>;
  saveReturnShipmentLink(link: ReturnShipmentLink): Promise<ReturnShipmentLink>;
  saveServiceZone(serviceZone: ServiceZone): Promise<ServiceZone>;
  saveShipment(shipment: ShipmentRecord): Promise<ShipmentRecord>;
  saveShippingOption(shippingOption: ShippingOption): Promise<ShippingOption>;
  saveShippingProfile(
    shippingProfile: ShippingProfile
  ): Promise<ShippingProfile>;
}

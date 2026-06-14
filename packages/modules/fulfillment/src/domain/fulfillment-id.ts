import { brand } from "@ecommerce/core/brand";

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

export const FULFILLMENT_PROVIDER_RECORD_ID_PREFIX = "fulfprov_" as const;
export const FULFILLMENT_SET_ID_PREFIX = "fset_" as const;
export const SHIPPING_PROFILE_ID_PREFIX = "shprof_" as const;
export const SERVICE_ZONE_ID_PREFIX = "fzone_" as const;
export const SHIPPING_OPTION_ID_PREFIX = "shipopt_" as const;
export const FULFILLMENT_ID_PREFIX = "fulf_" as const;
export const SHIPMENT_RECORD_ID_PREFIX = "ship_" as const;
export const RETURN_SHIPMENT_LINK_ID_PREFIX = "retship_" as const;

const assertPrefixedId = (
  value: string,
  prefix: string,
  label: string
): void => {
  if (!value.startsWith(prefix)) {
    throw new Error(`${label} must start with "${prefix}".`);
  }
};

export const createFulfillmentProviderRecordId = (
  value: string
): FulfillmentProviderRecordId => {
  assertPrefixedId(
    value,
    FULFILLMENT_PROVIDER_RECORD_ID_PREFIX,
    "Fulfillment provider record ID"
  );
  return brand<"fulfillment-provider-record", string>(value);
};

export const createFulfillmentSetId = (value: string): FulfillmentSetId => {
  assertPrefixedId(value, FULFILLMENT_SET_ID_PREFIX, "Fulfillment set ID");
  return brand<"fulfillment-set", string>(value);
};

export const createShippingProfileId = (value: string): ShippingProfileId => {
  assertPrefixedId(value, SHIPPING_PROFILE_ID_PREFIX, "Shipping profile ID");
  return brand<"shipping-profile", string>(value);
};

export const createServiceZoneId = (value: string): ServiceZoneId => {
  assertPrefixedId(value, SERVICE_ZONE_ID_PREFIX, "Service zone ID");
  return brand<"service-zone", string>(value);
};

export const createShippingOptionId = (value: string): ShippingOptionId => {
  assertPrefixedId(value, SHIPPING_OPTION_ID_PREFIX, "Shipping option ID");
  return brand<"shipping-option", string>(value);
};

export const createFulfillmentId = (value: string): FulfillmentId => {
  assertPrefixedId(value, FULFILLMENT_ID_PREFIX, "Fulfillment ID");
  return brand<"fulfillment", string>(value);
};

export const createShipmentRecordId = (value: string): ShipmentRecordId => {
  assertPrefixedId(value, SHIPMENT_RECORD_ID_PREFIX, "Shipment record ID");
  return brand<"shipment-record", string>(value);
};

export const createReturnShipmentLinkId = (
  value: string
): ReturnShipmentLinkId => {
  assertPrefixedId(
    value,
    RETURN_SHIPMENT_LINK_ID_PREFIX,
    "Return shipment link ID"
  );
  return brand<"return-shipment-link", string>(value);
};

export const serializeFulfillmentProviderRecordId = (
  id: FulfillmentProviderRecordId
): string => id;
export const serializeFulfillmentSetId = (id: FulfillmentSetId): string => id;
export const serializeShippingProfileId = (id: ShippingProfileId): string => id;
export const serializeServiceZoneId = (id: ServiceZoneId): string => id;
export const serializeShippingOptionId = (id: ShippingOptionId): string => id;
export const serializeFulfillmentId = (id: FulfillmentId): string => id;
export const serializeShipmentRecordId = (id: ShipmentRecordId): string => id;
export const serializeReturnShipmentLinkId = (
  id: ReturnShipmentLinkId
): string => id;

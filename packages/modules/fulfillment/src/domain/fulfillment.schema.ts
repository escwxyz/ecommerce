import { Schema } from "effect";

const isCanonicalIsoDateTime = (value: string): boolean => {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
};

const createPrefixedIdentifierSchema = (prefix: string, brand: string) =>
  Schema.NonEmptyString.pipe(
    Schema.check(Schema.isStartsWith(prefix)),
    Schema.brand(brand)
  );

const createSerializedIdentifierSchema = (prefix: string) =>
  Schema.NonEmptyString.pipe(Schema.check(Schema.isStartsWith(prefix)));

export const fulfillmentProviderTableName = "fulfillment_provider" as const;
export const fulfillmentSetTableName = "fulfillment_set" as const;
export const shippingProfileTableName = "shipping_profile" as const;
export const serviceZoneTableName = "service_zone" as const;
export const shippingOptionTableName = "shipping_option" as const;
export const fulfillmentTableName = "fulfillment" as const;
export const shipmentTableName = "shipment" as const;
export const returnShipmentLinkTableName = "return_shipment_link" as const;

export const FULFILLMENT_PROVIDER_RECORD_ID_PREFIX = "fulfprov_" as const;
export const FULFILLMENT_SET_ID_PREFIX = "fset_" as const;
export const SHIPPING_PROFILE_ID_PREFIX = "shprof_" as const;
export const SERVICE_ZONE_ID_PREFIX = "fzone_" as const;
export const SHIPPING_OPTION_ID_PREFIX = "shipopt_" as const;
export const FULFILLMENT_ID_PREFIX = "fulf_" as const;
export const SHIPMENT_RECORD_ID_PREFIX = "ship_" as const;
export const RETURN_SHIPMENT_LINK_ID_PREFIX = "retship_" as const;

export const FulfillmentTrimmedStringSchema = Schema.Trimmed.pipe(
  Schema.check(Schema.isMinLength(1))
);

export const FulfillmentIsoDateTimeStringSchema =
  FulfillmentTrimmedStringSchema.pipe(
    Schema.check(Schema.makeFilter(isCanonicalIsoDateTime))
  );

export const FulfillmentMetadataSchema = Schema.Record(
  Schema.String,
  Schema.Unknown
);

export const FulfillmentNonNegativeIntegerSchema = Schema.Number.pipe(
  Schema.check(Schema.isInt()),
  Schema.check(Schema.isGreaterThanOrEqualTo(0))
);

export const FulfillmentPositiveIntegerSchema = Schema.Number.pipe(
  Schema.check(Schema.isInt()),
  Schema.check(Schema.isGreaterThan(0))
);

export const FulfillmentCurrencyCodeSchema =
  FulfillmentTrimmedStringSchema.pipe(
    Schema.check(Schema.isMinLength(3)),
    Schema.check(Schema.isMaxLength(3))
  );

export const FulfillmentCountryCodeSchema = FulfillmentTrimmedStringSchema.pipe(
  Schema.check(Schema.isMinLength(2)),
  Schema.check(Schema.isMaxLength(2))
);

export const FulfillmentProviderRecordIdSchema = createPrefixedIdentifierSchema(
  FULFILLMENT_PROVIDER_RECORD_ID_PREFIX,
  "FulfillmentProviderRecordId"
);
export const FulfillmentProviderRecordSerializedIdSchema =
  createSerializedIdentifierSchema(FULFILLMENT_PROVIDER_RECORD_ID_PREFIX);
export const FulfillmentSetIdSchema = createPrefixedIdentifierSchema(
  FULFILLMENT_SET_ID_PREFIX,
  "FulfillmentSetId"
);
export const FulfillmentSetSerializedIdSchema =
  createSerializedIdentifierSchema(FULFILLMENT_SET_ID_PREFIX);
export const ShippingProfileIdSchema = createPrefixedIdentifierSchema(
  SHIPPING_PROFILE_ID_PREFIX,
  "ShippingProfileId"
);
export const ShippingProfileSerializedIdSchema =
  createSerializedIdentifierSchema(SHIPPING_PROFILE_ID_PREFIX);
export const ServiceZoneIdSchema = createPrefixedIdentifierSchema(
  SERVICE_ZONE_ID_PREFIX,
  "ServiceZoneId"
);
export const ServiceZoneSerializedIdSchema = createSerializedIdentifierSchema(
  SERVICE_ZONE_ID_PREFIX
);
export const ShippingOptionIdSchema = createPrefixedIdentifierSchema(
  SHIPPING_OPTION_ID_PREFIX,
  "ShippingOptionId"
);
export const ShippingOptionSerializedIdSchema =
  createSerializedIdentifierSchema(SHIPPING_OPTION_ID_PREFIX);
export const FulfillmentIdSchema = createPrefixedIdentifierSchema(
  FULFILLMENT_ID_PREFIX,
  "FulfillmentId"
);
export const FulfillmentSerializedIdSchema = createSerializedIdentifierSchema(
  FULFILLMENT_ID_PREFIX
);
export const ShipmentRecordIdSchema = createPrefixedIdentifierSchema(
  SHIPMENT_RECORD_ID_PREFIX,
  "ShipmentRecordId"
);
export const ShipmentRecordSerializedIdSchema =
  createSerializedIdentifierSchema(SHIPMENT_RECORD_ID_PREFIX);
export const ReturnShipmentLinkIdSchema = createPrefixedIdentifierSchema(
  RETURN_SHIPMENT_LINK_ID_PREFIX,
  "ReturnShipmentLinkId"
);
export const ReturnShipmentLinkSerializedIdSchema =
  createSerializedIdentifierSchema(RETURN_SHIPMENT_LINK_ID_PREFIX);

export const FulfillmentMoneySchema = Schema.Struct({
  amount: FulfillmentNonNegativeIntegerSchema,
  currencyCode: FulfillmentCurrencyCodeSchema,
});

export const FulfillmentStatusSchema = Schema.Literals([
  "pending",
  "created",
  "shipped",
  "delivered",
  "canceled",
  "failed",
]);

export const ShipmentStatusSchema = Schema.Literals([
  "ready",
  "shipped",
  "in-transit",
  "delivered",
  "canceled",
  "failed",
]);

export const FulfillmentProviderRecordSchema = Schema.Struct({
  createdAt: Schema.Date,
  id: FulfillmentProviderRecordIdSchema,
  isEnabled: Schema.Boolean,
  providerKey: FulfillmentTrimmedStringSchema,
  providerRecordId: FulfillmentTrimmedStringSchema,
  updatedAt: Schema.Date,
});

export const FulfillmentSetSchema = Schema.Struct({
  createdAt: Schema.Date,
  id: FulfillmentSetIdSchema,
  metadata: FulfillmentMetadataSchema,
  name: FulfillmentTrimmedStringSchema,
  updatedAt: Schema.Date,
});

export const ShippingProfileSchema = Schema.Struct({
  createdAt: Schema.Date,
  fulfillmentSetId: FulfillmentSetIdSchema,
  id: ShippingProfileIdSchema,
  metadata: FulfillmentMetadataSchema,
  name: FulfillmentTrimmedStringSchema,
  updatedAt: Schema.Date,
});

export const ServiceZoneSchema = Schema.Struct({
  countryCodes: Schema.Array(FulfillmentCountryCodeSchema),
  createdAt: Schema.Date,
  fulfillmentSetId: FulfillmentSetIdSchema,
  id: ServiceZoneIdSchema,
  metadata: FulfillmentMetadataSchema,
  name: FulfillmentTrimmedStringSchema,
  regionIds: Schema.Array(FulfillmentTrimmedStringSchema),
  updatedAt: Schema.Date,
});

export const ShippingOptionSchema = Schema.Struct({
  createdAt: Schema.Date,
  currencyCode: Schema.optional(FulfillmentCurrencyCodeSchema),
  fulfillmentSetId: FulfillmentSetIdSchema,
  id: ShippingOptionIdSchema,
  isEnabled: Schema.Boolean,
  metadata: FulfillmentMetadataSchema,
  name: FulfillmentTrimmedStringSchema,
  priceAmount: Schema.optional(FulfillmentNonNegativeIntegerSchema),
  profileId: ShippingProfileIdSchema,
  providerKey: FulfillmentTrimmedStringSchema,
  providerServiceId: FulfillmentTrimmedStringSchema,
  serviceZoneId: ServiceZoneIdSchema,
  updatedAt: Schema.Date,
});

export const FulfillmentLineItemSchema = Schema.Struct({
  lineItemId: FulfillmentTrimmedStringSchema,
  quantity: FulfillmentPositiveIntegerSchema,
  sku: Schema.optional(FulfillmentTrimmedStringSchema),
});

export const FulfillmentAddressSchema = Schema.Struct({
  city: Schema.optional(FulfillmentTrimmedStringSchema),
  countryCode: FulfillmentCountryCodeSchema,
  line1: Schema.optional(FulfillmentTrimmedStringSchema),
  postalCode: Schema.optional(FulfillmentTrimmedStringSchema),
  provinceCode: Schema.optional(FulfillmentTrimmedStringSchema),
});

export const FulfillmentSchema = Schema.Struct({
  address: Schema.optional(FulfillmentAddressSchema),
  createdAt: Schema.Date,
  id: FulfillmentIdSchema,
  idempotencyKey: FulfillmentTrimmedStringSchema,
  items: Schema.Array(FulfillmentLineItemSchema),
  metadata: FulfillmentMetadataSchema,
  orderId: FulfillmentTrimmedStringSchema,
  providerFulfillmentId: Schema.optional(FulfillmentTrimmedStringSchema),
  providerKey: FulfillmentTrimmedStringSchema,
  shippingOptionId: ShippingOptionIdSchema,
  status: FulfillmentStatusSchema,
  updatedAt: Schema.Date,
});

export const ShipmentRecordSchema = Schema.Struct({
  carrier: Schema.optional(FulfillmentTrimmedStringSchema),
  createdAt: Schema.Date,
  fulfillmentId: FulfillmentIdSchema,
  id: ShipmentRecordIdSchema,
  labelUrl: Schema.optional(FulfillmentTrimmedStringSchema),
  metadata: FulfillmentMetadataSchema,
  providerShipmentId: FulfillmentTrimmedStringSchema,
  status: ShipmentStatusSchema,
  trackingNumber: Schema.optional(FulfillmentTrimmedStringSchema),
  trackingUrl: Schema.optional(FulfillmentTrimmedStringSchema),
  updatedAt: Schema.Date,
});

export const ReturnShipmentLinkSchema = Schema.Struct({
  createdAt: Schema.Date,
  fulfillmentId: FulfillmentIdSchema,
  id: ReturnShipmentLinkIdSchema,
  providerReturnId: Schema.optional(FulfillmentTrimmedStringSchema),
  returnId: FulfillmentTrimmedStringSchema,
  shipmentId: ShipmentRecordIdSchema,
  updatedAt: Schema.Date,
});

export const CreateFulfillmentSetInputSchema = Schema.Struct({
  metadata: Schema.optional(FulfillmentMetadataSchema),
  name: FulfillmentTrimmedStringSchema,
});

export const CreateShippingProfileInputSchema = Schema.Struct({
  fulfillmentSetId: FulfillmentSetIdSchema,
  metadata: Schema.optional(FulfillmentMetadataSchema),
  name: FulfillmentTrimmedStringSchema,
});

export const CreateServiceZoneInputSchema = Schema.Struct({
  countryCodes: Schema.optional(Schema.Array(FulfillmentCountryCodeSchema)),
  fulfillmentSetId: FulfillmentSetIdSchema,
  metadata: Schema.optional(FulfillmentMetadataSchema),
  name: FulfillmentTrimmedStringSchema,
  regionIds: Schema.optional(Schema.Array(FulfillmentTrimmedStringSchema)),
});

export const CreateShippingOptionInputSchema = Schema.Struct({
  currencyCode: Schema.optional(FulfillmentCurrencyCodeSchema),
  fulfillmentSetId: FulfillmentSetIdSchema,
  metadata: Schema.optional(FulfillmentMetadataSchema),
  name: FulfillmentTrimmedStringSchema,
  priceAmount: Schema.optional(FulfillmentNonNegativeIntegerSchema),
  profileId: ShippingProfileIdSchema,
  providerKey: FulfillmentTrimmedStringSchema,
  providerServiceId: FulfillmentTrimmedStringSchema,
  serviceZoneId: ServiceZoneIdSchema,
});

export const ShippingOptionLookupInputSchema = Schema.Struct({
  countryCode: Schema.optional(FulfillmentCountryCodeSchema),
  fulfillmentSetId: Schema.optional(FulfillmentSetIdSchema),
  regionId: Schema.optional(FulfillmentTrimmedStringSchema),
  salesChannelId: Schema.optional(FulfillmentTrimmedStringSchema),
});

export const CreateFulfillmentInputSchema = Schema.Struct({
  address: Schema.optional(FulfillmentAddressSchema),
  idempotencyKey: FulfillmentTrimmedStringSchema,
  items: Schema.Array(FulfillmentLineItemSchema),
  metadata: Schema.optional(FulfillmentMetadataSchema),
  orderId: FulfillmentTrimmedStringSchema,
  shippingOptionId: ShippingOptionIdSchema,
});

export const CancelFulfillmentInputSchema = Schema.Struct({
  fulfillmentId: FulfillmentIdSchema,
  reason: Schema.optional(FulfillmentTrimmedStringSchema),
});

export const TrackShipmentInputSchema = Schema.Struct({
  fulfillmentId: FulfillmentIdSchema,
});

export const FulfillmentProviderApiRecordSchema = Schema.Struct({
  createdAt: FulfillmentIsoDateTimeStringSchema,
  id: FulfillmentProviderRecordSerializedIdSchema,
  isEnabled: Schema.Boolean,
  providerKey: FulfillmentTrimmedStringSchema,
  providerRecordId: FulfillmentTrimmedStringSchema,
  updatedAt: FulfillmentIsoDateTimeStringSchema,
});

export const FulfillmentSetApiSchema = Schema.Struct({
  createdAt: FulfillmentIsoDateTimeStringSchema,
  id: FulfillmentSetSerializedIdSchema,
  metadata: FulfillmentMetadataSchema,
  name: FulfillmentTrimmedStringSchema,
  updatedAt: FulfillmentIsoDateTimeStringSchema,
});

export const ShippingProfileApiSchema = Schema.Struct({
  createdAt: FulfillmentIsoDateTimeStringSchema,
  fulfillmentSetId: FulfillmentSetSerializedIdSchema,
  id: ShippingProfileSerializedIdSchema,
  metadata: FulfillmentMetadataSchema,
  name: FulfillmentTrimmedStringSchema,
  updatedAt: FulfillmentIsoDateTimeStringSchema,
});

export const ServiceZoneApiSchema = Schema.Struct({
  countryCodes: Schema.Array(FulfillmentCountryCodeSchema),
  createdAt: FulfillmentIsoDateTimeStringSchema,
  fulfillmentSetId: FulfillmentSetSerializedIdSchema,
  id: ServiceZoneSerializedIdSchema,
  metadata: FulfillmentMetadataSchema,
  name: FulfillmentTrimmedStringSchema,
  regionIds: Schema.Array(FulfillmentTrimmedStringSchema),
  updatedAt: FulfillmentIsoDateTimeStringSchema,
});

export const ShippingOptionApiSchema = Schema.Struct({
  createdAt: FulfillmentIsoDateTimeStringSchema,
  currencyCode: Schema.optional(FulfillmentCurrencyCodeSchema),
  fulfillmentSetId: FulfillmentSetSerializedIdSchema,
  id: ShippingOptionSerializedIdSchema,
  isEnabled: Schema.Boolean,
  metadata: FulfillmentMetadataSchema,
  name: FulfillmentTrimmedStringSchema,
  priceAmount: Schema.optional(FulfillmentNonNegativeIntegerSchema),
  profileId: ShippingProfileSerializedIdSchema,
  providerKey: FulfillmentTrimmedStringSchema,
  providerServiceId: FulfillmentTrimmedStringSchema,
  serviceZoneId: ServiceZoneSerializedIdSchema,
  updatedAt: FulfillmentIsoDateTimeStringSchema,
});

export const FulfillmentApiSchema = Schema.Struct({
  address: Schema.optional(FulfillmentAddressSchema),
  createdAt: FulfillmentIsoDateTimeStringSchema,
  id: FulfillmentSerializedIdSchema,
  idempotencyKey: FulfillmentTrimmedStringSchema,
  items: Schema.Array(FulfillmentLineItemSchema),
  metadata: FulfillmentMetadataSchema,
  orderId: FulfillmentTrimmedStringSchema,
  providerFulfillmentId: Schema.optional(FulfillmentTrimmedStringSchema),
  providerKey: FulfillmentTrimmedStringSchema,
  shippingOptionId: ShippingOptionSerializedIdSchema,
  status: FulfillmentStatusSchema,
  updatedAt: FulfillmentIsoDateTimeStringSchema,
});

export const ShipmentRecordApiSchema = Schema.Struct({
  carrier: Schema.optional(FulfillmentTrimmedStringSchema),
  createdAt: FulfillmentIsoDateTimeStringSchema,
  fulfillmentId: FulfillmentSerializedIdSchema,
  id: ShipmentRecordSerializedIdSchema,
  labelUrl: Schema.optional(FulfillmentTrimmedStringSchema),
  metadata: FulfillmentMetadataSchema,
  providerShipmentId: FulfillmentTrimmedStringSchema,
  status: ShipmentStatusSchema,
  trackingNumber: Schema.optional(FulfillmentTrimmedStringSchema),
  trackingUrl: Schema.optional(FulfillmentTrimmedStringSchema),
  updatedAt: FulfillmentIsoDateTimeStringSchema,
});

export const ReturnShipmentLinkApiSchema = Schema.Struct({
  createdAt: FulfillmentIsoDateTimeStringSchema,
  fulfillmentId: FulfillmentSerializedIdSchema,
  id: ReturnShipmentLinkSerializedIdSchema,
  providerReturnId: Schema.optional(FulfillmentTrimmedStringSchema),
  returnId: FulfillmentTrimmedStringSchema,
  shipmentId: ShipmentRecordSerializedIdSchema,
  updatedAt: FulfillmentIsoDateTimeStringSchema,
});

export const ShippingOptionRateApiSchema = Schema.Struct({
  amount: FulfillmentNonNegativeIntegerSchema,
  currencyCode: FulfillmentCurrencyCodeSchema,
  providerKey: FulfillmentTrimmedStringSchema,
  shippingOptionId: ShippingOptionSerializedIdSchema,
});

export const FulfillmentDetailApiSchema = Schema.Struct({
  fulfillment: FulfillmentApiSchema,
  shipments: Schema.Array(ShipmentRecordApiSchema),
});

export const ShippingOptionListApiSchema = Schema.Array(
  ShippingOptionApiSchema
);
export const FulfillmentListApiSchema = Schema.Array(FulfillmentApiSchema);

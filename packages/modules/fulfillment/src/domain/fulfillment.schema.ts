import { z } from "zod";

export const FulfillmentMetadataSchema = z.record(z.string(), z.unknown());

export const FulfillmentMoneySchema = z.object({
  amount: z.number().int().nonnegative(),
  currencyCode: z
    .string()
    .min(3)
    .max(3)
    .transform((value) => value.toUpperCase()),
});

export const FulfillmentStatusSchema = z.enum([
  "pending",
  "created",
  "shipped",
  "delivered",
  "canceled",
  "failed",
]);

export const ShipmentStatusSchema = z.enum([
  "ready",
  "shipped",
  "in-transit",
  "delivered",
  "canceled",
  "failed",
]);

export const FulfillmentProviderRecordSchema = z.object({
  createdAt: z.date(),
  id: z.string().min(1).startsWith("fulfprov_"),
  isEnabled: z.boolean(),
  providerKey: z.string().min(1),
  providerRecordId: z.string().min(1),
  updatedAt: z.date(),
});

export const FulfillmentSetSchema = z.object({
  createdAt: z.date(),
  id: z.string().min(1).startsWith("fset_"),
  metadata: FulfillmentMetadataSchema,
  name: z.string().min(1),
  updatedAt: z.date(),
});

export const ShippingProfileSchema = z.object({
  createdAt: z.date(),
  fulfillmentSetId: z.string().min(1).startsWith("fset_"),
  id: z.string().min(1).startsWith("shprof_"),
  metadata: FulfillmentMetadataSchema,
  name: z.string().min(1),
  updatedAt: z.date(),
});

export const ServiceZoneSchema = z.object({
  countryCodes: z.array(z.string().min(2).max(2)).readonly(),
  createdAt: z.date(),
  fulfillmentSetId: z.string().min(1).startsWith("fset_"),
  id: z.string().min(1).startsWith("fzone_"),
  metadata: FulfillmentMetadataSchema,
  name: z.string().min(1),
  regionIds: z.array(z.string().min(1)).readonly(),
  updatedAt: z.date(),
});

export const ShippingOptionSchema = z.object({
  createdAt: z.date(),
  currencyCode: z.string().min(3).max(3).optional(),
  fulfillmentSetId: z.string().min(1).startsWith("fset_"),
  id: z.string().min(1).startsWith("shipopt_"),
  isEnabled: z.boolean(),
  metadata: FulfillmentMetadataSchema,
  name: z.string().min(1),
  priceAmount: z.number().int().nonnegative().optional(),
  profileId: z.string().min(1).startsWith("shprof_"),
  providerKey: z.string().min(1),
  providerServiceId: z.string().min(1),
  serviceZoneId: z.string().min(1).startsWith("fzone_"),
  updatedAt: z.date(),
});

export const FulfillmentLineItemSchema = z.object({
  lineItemId: z.string().min(1),
  quantity: z.number().int().positive(),
  sku: z.string().min(1).optional(),
});

export const FulfillmentAddressSchema = z.object({
  city: z.string().min(1).optional(),
  countryCode: z.string().min(2).max(2),
  line1: z.string().min(1).optional(),
  postalCode: z.string().min(1).optional(),
  provinceCode: z.string().min(1).optional(),
});

export const FulfillmentSchema = z.object({
  address: FulfillmentAddressSchema.optional(),
  createdAt: z.date(),
  id: z.string().min(1).startsWith("fulf_"),
  idempotencyKey: z.string().min(1),
  items: z.array(FulfillmentLineItemSchema).readonly(),
  metadata: FulfillmentMetadataSchema,
  orderId: z.string().min(1),
  providerFulfillmentId: z.string().min(1).optional(),
  providerKey: z.string().min(1),
  shippingOptionId: z.string().min(1).startsWith("shipopt_"),
  status: FulfillmentStatusSchema,
  updatedAt: z.date(),
});

export const ShipmentRecordSchema = z.object({
  carrier: z.string().min(1).optional(),
  createdAt: z.date(),
  fulfillmentId: z.string().min(1).startsWith("fulf_"),
  id: z.string().min(1).startsWith("ship_"),
  labelUrl: z.string().url().optional(),
  metadata: FulfillmentMetadataSchema,
  providerShipmentId: z.string().min(1),
  status: ShipmentStatusSchema,
  trackingNumber: z.string().min(1).optional(),
  trackingUrl: z.string().url().optional(),
  updatedAt: z.date(),
});

export const ReturnShipmentLinkSchema = z.object({
  createdAt: z.date(),
  fulfillmentId: z.string().min(1).startsWith("fulf_"),
  id: z.string().min(1).startsWith("retship_"),
  providerReturnId: z.string().min(1).optional(),
  returnId: z.string().min(1),
  shipmentId: z.string().min(1).startsWith("ship_"),
  updatedAt: z.date(),
});

export const CreateFulfillmentSetInputSchema = z.object({
  metadata: FulfillmentMetadataSchema.optional(),
  name: z.string().min(1),
});

export const CreateShippingProfileInputSchema = z.object({
  fulfillmentSetId: z.string().min(1).startsWith("fset_"),
  metadata: FulfillmentMetadataSchema.optional(),
  name: z.string().min(1),
});

export const CreateServiceZoneInputSchema = z.object({
  countryCodes: z.array(z.string().min(2).max(2)).optional(),
  fulfillmentSetId: z.string().min(1).startsWith("fset_"),
  metadata: FulfillmentMetadataSchema.optional(),
  name: z.string().min(1),
  regionIds: z.array(z.string().min(1)).optional(),
});

export const CreateShippingOptionInputSchema = z.object({
  currencyCode: z.string().min(3).max(3).optional(),
  fulfillmentSetId: z.string().min(1).startsWith("fset_"),
  metadata: FulfillmentMetadataSchema.optional(),
  name: z.string().min(1),
  priceAmount: z.number().int().nonnegative().optional(),
  profileId: z.string().min(1).startsWith("shprof_"),
  providerKey: z.string().min(1),
  providerServiceId: z.string().min(1),
  serviceZoneId: z.string().min(1).startsWith("fzone_"),
});

export const ShippingOptionLookupInputSchema = z.object({
  countryCode: z.string().min(2).max(2).optional(),
  fulfillmentSetId: z.string().min(1).startsWith("fset_").optional(),
  regionId: z.string().min(1).optional(),
  salesChannelId: z.string().min(1).optional(),
});

export const CreateFulfillmentInputSchema = z.object({
  address: FulfillmentAddressSchema.optional(),
  idempotencyKey: z.string().min(1),
  items: z.array(FulfillmentLineItemSchema).readonly(),
  metadata: FulfillmentMetadataSchema.optional(),
  orderId: z.string().min(1),
  shippingOptionId: z.string().min(1).startsWith("shipopt_"),
});

export const CancelFulfillmentInputSchema = z.object({
  fulfillmentId: z.string().min(1).startsWith("fulf_"),
  reason: z.string().min(1).optional(),
});

export const TrackShipmentInputSchema = z.object({
  fulfillmentId: z.string().min(1).startsWith("fulf_"),
});

const ApiDateFields = {
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
} as const;

export const FulfillmentProviderApiRecordSchema =
  FulfillmentProviderRecordSchema.extend(ApiDateFields);
export const FulfillmentSetApiSchema =
  FulfillmentSetSchema.extend(ApiDateFields);
export const ShippingProfileApiSchema =
  ShippingProfileSchema.extend(ApiDateFields);
export const ServiceZoneApiSchema = ServiceZoneSchema.extend(ApiDateFields);
export const ShippingOptionApiSchema =
  ShippingOptionSchema.extend(ApiDateFields);
export const FulfillmentApiSchema = FulfillmentSchema.extend(ApiDateFields);
export const ShipmentRecordApiSchema =
  ShipmentRecordSchema.extend(ApiDateFields);
export const ReturnShipmentLinkApiSchema =
  ReturnShipmentLinkSchema.extend(ApiDateFields);

export const ShippingOptionRateApiSchema = z.object({
  amount: z.number().int().nonnegative(),
  currencyCode: z.string().min(3).max(3),
  providerKey: z.string().min(1),
  shippingOptionId: z.string().min(1).startsWith("shipopt_"),
});

export const FulfillmentDetailApiSchema = FulfillmentApiSchema.extend({
  shipments: z.array(ShipmentRecordApiSchema).readonly(),
});

export const ShippingOptionListApiSchema = z
  .array(ShippingOptionApiSchema)
  .readonly();
export const FulfillmentListApiSchema = z
  .array(FulfillmentApiSchema)
  .readonly();

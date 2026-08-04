import { Schema } from "effect";

const isCanonicalIsoDateTime = (value: string): boolean => {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
};

const countryCodePattern = /^[A-Z]{2}$/u;
const currencyCodePattern = /^[A-Z]{3}$/u;

/** Stable commerce region identifier owned by the region module. */
export const RegionIdSchema = Schema.NonEmptyString.pipe(
  Schema.check(Schema.isStartsWith("reg_")),
  Schema.brand("RegionId")
);

/** Stable sales-channel identifier owned by the sales-channel module. */
export const SalesChannelIdSchema = Schema.NonEmptyString.pipe(
  Schema.check(Schema.isStartsWith("sc_")),
  Schema.brand("SalesChannelId")
);

export const RegionSerializedIdSchema = Schema.NonEmptyString.pipe(
  Schema.check(Schema.isStartsWith("reg_"))
);
export const SalesChannelSerializedIdSchema = Schema.NonEmptyString.pipe(
  Schema.check(Schema.isStartsWith("sc_"))
);

export const RegionSalesChannelTrimmedStringSchema = Schema.Trimmed.pipe(
  Schema.check(Schema.isMinLength(1))
);

export const RegionCountryCodeSchema =
  RegionSalesChannelTrimmedStringSchema.pipe(
    Schema.check(Schema.isPattern(countryCodePattern))
  );

export const RegionCurrencyCodeSchema =
  RegionSalesChannelTrimmedStringSchema.pipe(
    Schema.check(Schema.isPattern(currencyCodePattern))
  );

/** Canonical UTC ISO datetime string emitted by API serializers. */
export const RegionSalesChannelIsoDateTimeStringSchema =
  RegionSalesChannelTrimmedStringSchema.pipe(
    Schema.check(Schema.makeFilter(isCanonicalIsoDateTime))
  );

export const MetadataSchema = Schema.Record(Schema.String, Schema.Unknown);

export const RegionProviderAvailabilitySchema = Schema.Struct({
  fulfillmentOptionIds: Schema.Array(RegionSalesChannelTrimmedStringSchema),
  paymentProviderIds: Schema.Array(RegionSalesChannelTrimmedStringSchema),
  taxProviderId: Schema.NullOr(RegionSalesChannelTrimmedStringSchema),
});

export const CreateRegionInputSchema = Schema.Struct({
  countries: Schema.Array(RegionSalesChannelTrimmedStringSchema),
  currencyCode: RegionSalesChannelTrimmedStringSchema,
  fulfillmentOptionIds: Schema.optional(
    Schema.Array(RegionSalesChannelTrimmedStringSchema)
  ),
  metadata: Schema.optional(MetadataSchema),
  name: RegionSalesChannelTrimmedStringSchema,
  paymentProviderIds: Schema.optional(
    Schema.Array(RegionSalesChannelTrimmedStringSchema)
  ),
  taxProviderId: Schema.optional(
    Schema.NullOr(RegionSalesChannelTrimmedStringSchema)
  ),
});

export const RegionIdentifierSchema = Schema.Struct({
  id: RegionIdSchema,
});

export const RegionRecordSchema = Schema.Struct({
  countries: Schema.Array(RegionCountryCodeSchema),
  createdAt: Schema.Date,
  currencyCode: RegionCurrencyCodeSchema,
  id: RegionIdSchema,
  metadata: MetadataSchema,
  name: RegionSalesChannelTrimmedStringSchema,
  providerAvailability: RegionProviderAvailabilitySchema,
  updatedAt: Schema.Date,
});

export const RegionApiRecordSchema = Schema.Struct({
  countries: Schema.Array(RegionCountryCodeSchema),
  createdAt: RegionSalesChannelIsoDateTimeStringSchema,
  currencyCode: RegionCurrencyCodeSchema,
  id: RegionSerializedIdSchema,
  metadata: MetadataSchema,
  name: RegionSalesChannelTrimmedStringSchema,
  providerAvailability: RegionProviderAvailabilitySchema,
  updatedAt: RegionSalesChannelIsoDateTimeStringSchema,
});

export const RegionApiListSchema = Schema.Array(RegionApiRecordSchema);

export const ValidateRegionInputSchema = Schema.Struct({
  countryCode: Schema.optional(RegionSalesChannelTrimmedStringSchema),
  currencyCode: Schema.optional(RegionSalesChannelTrimmedStringSchema),
  fulfillmentOptionId: Schema.optional(RegionSalesChannelTrimmedStringSchema),
  paymentProviderId: Schema.optional(RegionSalesChannelTrimmedStringSchema),
  regionId: RegionIdSchema,
});

export const RegionValidationResultSchema = Schema.Struct({
  allowed: Schema.Boolean,
  reasons: Schema.Array(RegionSalesChannelTrimmedStringSchema),
});

export const SalesChannelStatusSchema = Schema.Literals([
  "draft",
  "active",
  "disabled",
]);

export const CreateSalesChannelInputSchema = Schema.Struct({
  description: Schema.optional(Schema.String),
  metadata: Schema.optional(MetadataSchema),
  name: RegionSalesChannelTrimmedStringSchema,
  status: Schema.optional(SalesChannelStatusSchema),
});

export const SalesChannelIdentifierSchema = Schema.Struct({
  id: SalesChannelIdSchema,
});

export const SalesChannelRecordSchema = Schema.Struct({
  createdAt: Schema.Date,
  description: Schema.NullOr(RegionSalesChannelTrimmedStringSchema),
  id: SalesChannelIdSchema,
  metadata: MetadataSchema,
  name: RegionSalesChannelTrimmedStringSchema,
  productIds: Schema.Array(RegionSalesChannelTrimmedStringSchema),
  status: SalesChannelStatusSchema,
  updatedAt: Schema.Date,
});

export const SalesChannelApiRecordSchema = Schema.Struct({
  createdAt: RegionSalesChannelIsoDateTimeStringSchema,
  description: Schema.NullOr(RegionSalesChannelTrimmedStringSchema),
  id: SalesChannelSerializedIdSchema,
  metadata: MetadataSchema,
  name: RegionSalesChannelTrimmedStringSchema,
  productIds: Schema.Array(RegionSalesChannelTrimmedStringSchema),
  status: SalesChannelStatusSchema,
  updatedAt: RegionSalesChannelIsoDateTimeStringSchema,
});

export const SalesChannelApiListSchema = Schema.Array(
  SalesChannelApiRecordSchema
);

export const PublishProductInputSchema = Schema.Struct({
  productId: RegionSalesChannelTrimmedStringSchema,
  salesChannelId: SalesChannelIdSchema,
});

export const CheckPublishabilityInputSchema = PublishProductInputSchema;

export const SalesChannelPublishabilityResultSchema = Schema.Struct({
  publishable: Schema.Boolean,
  reasons: Schema.Array(RegionSalesChannelTrimmedStringSchema),
});

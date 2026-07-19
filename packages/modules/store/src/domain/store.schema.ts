import { Schema } from "effect";

const currencyCodePattern = /^[A-Z]{3}$/u;

const isCanonicalIsoDateTime = (value: string): boolean => {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
};

/** Stable commerce store identifier owned by the store module. */
export const StoreIdSchema = Schema.NonEmptyString.pipe(
  Schema.check(Schema.isStartsWith("store_")),
  Schema.brand("StoreId")
);

/** Serialized store identifier used by API and storage boundaries. */
export const StoreSerializedIdSchema = Schema.NonEmptyString.pipe(
  Schema.check(Schema.isStartsWith("store_"))
);

/** Canonical uppercase ISO-style currency code used by store defaults. */
export const StoreCurrencyCodeSchema = Schema.NonEmptyString.pipe(
  Schema.check(Schema.isPattern(currencyCodePattern))
);

export const StoreCurrencyCodeListSchema = Schema.Array(
  StoreCurrencyCodeSchema
).pipe(Schema.check(Schema.isMinLength(1)));

/** Non-empty string that has already been trimmed at the input boundary. */
export const StoreTrimmedStringSchema = Schema.Trimmed.pipe(
  Schema.check(Schema.isMinLength(1))
);

/** Canonical UTC ISO datetime string emitted by store API serializers. */
export const StoreIsoDateTimeStringSchema = StoreTrimmedStringSchema.pipe(
  Schema.check(Schema.makeFilter(isCanonicalIsoDateTime))
);

/** JSON-like metadata bag owned by the store module. */
export const StoreMetadataSchema = Schema.Record(Schema.String, Schema.Unknown);

export const StoreIdentifierSchema = Schema.Struct({
  id: StoreIdSchema,
});

export const StoreSettingsSchema = Schema.Struct({
  createdAt: Schema.Date,
  defaultCurrencyCode: StoreCurrencyCodeSchema,
  defaultLocale: StoreTrimmedStringSchema,
  defaultRegionId: Schema.NullOr(StoreTrimmedStringSchema),
  defaultSalesChannelId: Schema.NullOr(StoreTrimmedStringSchema),
  id: StoreIdSchema,
  metadata: StoreMetadataSchema,
  name: StoreTrimmedStringSchema,
  supportedCurrencyCodes: StoreCurrencyCodeListSchema,
  timezone: StoreTrimmedStringSchema,
  updatedAt: Schema.Date,
});

export const UpdateStoreSettingsInputSchema = Schema.Struct({
  defaultCurrencyCode: Schema.optional(StoreCurrencyCodeSchema),
  defaultLocale: Schema.optional(StoreTrimmedStringSchema),
  defaultRegionId: Schema.optional(Schema.NullOr(StoreTrimmedStringSchema)),
  defaultSalesChannelId: Schema.optional(
    Schema.NullOr(StoreTrimmedStringSchema)
  ),
  metadata: Schema.optional(StoreMetadataSchema),
  name: Schema.optional(StoreTrimmedStringSchema),
  supportedCurrencyCodes: Schema.optional(StoreCurrencyCodeListSchema),
  timezone: Schema.optional(StoreTrimmedStringSchema),
});

export const StoreDefaultsSchema = Schema.Struct({
  defaultCurrencyCode: StoreCurrencyCodeSchema,
  defaultLocale: StoreTrimmedStringSchema,
  defaultRegionId: Schema.NullOr(StoreTrimmedStringSchema),
  defaultSalesChannelId: Schema.NullOr(StoreTrimmedStringSchema),
  supportedCurrencyCodes: StoreCurrencyCodeListSchema,
  timezone: StoreTrimmedStringSchema,
});

export const StoreApiRecordSchema = Schema.Struct({
  createdAt: StoreIsoDateTimeStringSchema,
  defaultCurrencyCode: StoreCurrencyCodeSchema,
  defaultLocale: StoreTrimmedStringSchema,
  defaultRegionId: Schema.NullOr(StoreTrimmedStringSchema),
  defaultSalesChannelId: Schema.NullOr(StoreTrimmedStringSchema),
  id: StoreSerializedIdSchema,
  metadata: StoreMetadataSchema,
  name: StoreTrimmedStringSchema,
  supportedCurrencyCodes: StoreCurrencyCodeListSchema,
  timezone: StoreTrimmedStringSchema,
  updatedAt: StoreIsoDateTimeStringSchema,
});

export const StoreDefaultsApiRecordSchema = Schema.Struct({
  defaultCurrencyCode: StoreCurrencyCodeSchema,
  defaultLocale: StoreTrimmedStringSchema,
  defaultRegionId: Schema.NullOr(StoreTrimmedStringSchema),
  defaultSalesChannelId: Schema.NullOr(StoreTrimmedStringSchema),
  supportedCurrencyCodes: StoreCurrencyCodeListSchema,
  timezone: StoreTrimmedStringSchema,
});

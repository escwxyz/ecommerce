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

export const taxCategoryTableName = "tax_category" as const;
export const taxProviderConfigTableName = "tax_provider_config" as const;
export const taxRegionTableName = "tax_region" as const;
export const taxRateTableName = "tax_rate" as const;
export const taxCalculationPolicyTableName = "tax_calculation_policy" as const;

export const TAX_REGION_ID_PREFIX = "txreg_" as const;
export const TAX_RATE_ID_PREFIX = "txrate_" as const;
export const TAX_CATEGORY_ID_PREFIX = "txcat_" as const;
export const TAX_PROVIDER_CONFIG_ID_PREFIX = "txprov_" as const;
export const TAX_CALCULATION_ID_PREFIX = "txcalc_" as const;
export const TAX_LINE_ID_PREFIX = "txline_" as const;

export const TaxTrimmedStringSchema = Schema.Trimmed.pipe(
  Schema.check(Schema.isMinLength(1))
);

export const TaxIsoDateTimeStringSchema = TaxTrimmedStringSchema.pipe(
  Schema.check(Schema.makeFilter(isCanonicalIsoDateTime))
);

export const TaxMetadataSchema = Schema.Record(Schema.String, Schema.Unknown);
export const TaxProviderSettingsSchema = Schema.Record(
  Schema.String,
  Schema.Unknown
);

export const TaxCurrencyCodeSchema = TaxTrimmedStringSchema.pipe(
  Schema.check(Schema.isMinLength(3)),
  Schema.check(Schema.isMaxLength(3))
);

export const TaxCountryCodeSchema = TaxTrimmedStringSchema.pipe(
  Schema.check(Schema.isMinLength(2)),
  Schema.check(Schema.isMaxLength(2))
);

export const TaxPercentageSchema = Schema.Number.pipe(
  Schema.check(Schema.isGreaterThanOrEqualTo(0)),
  Schema.check(Schema.isLessThanOrEqualTo(100))
);

export const TaxNonNegativeIntegerSchema = Schema.Number.pipe(
  Schema.check(Schema.isInt()),
  Schema.check(Schema.isGreaterThanOrEqualTo(0))
);

export const TaxPositiveIntegerSchema = Schema.Number.pipe(
  Schema.check(Schema.isInt()),
  Schema.check(Schema.isGreaterThan(0))
);

export const TaxRegionIdSchema = createPrefixedIdentifierSchema(
  TAX_REGION_ID_PREFIX,
  "TaxRegionId"
);
export const TaxRegionSerializedIdSchema =
  createSerializedIdentifierSchema(TAX_REGION_ID_PREFIX);
export const TaxRateIdSchema = createPrefixedIdentifierSchema(
  TAX_RATE_ID_PREFIX,
  "TaxRateId"
);
export const TaxRateSerializedIdSchema =
  createSerializedIdentifierSchema(TAX_RATE_ID_PREFIX);
export const TaxCategoryIdSchema = createPrefixedIdentifierSchema(
  TAX_CATEGORY_ID_PREFIX,
  "TaxCategoryId"
);
export const TaxCategorySerializedIdSchema = createSerializedIdentifierSchema(
  TAX_CATEGORY_ID_PREFIX
);
export const TaxProviderConfigIdSchema = createPrefixedIdentifierSchema(
  TAX_PROVIDER_CONFIG_ID_PREFIX,
  "TaxProviderConfigId"
);
export const TaxProviderConfigSerializedIdSchema =
  createSerializedIdentifierSchema(TAX_PROVIDER_CONFIG_ID_PREFIX);
export const TaxCalculationIdSchema = createPrefixedIdentifierSchema(
  TAX_CALCULATION_ID_PREFIX,
  "TaxCalculationId"
);
export const TaxCalculationSerializedIdSchema =
  createSerializedIdentifierSchema(TAX_CALCULATION_ID_PREFIX);
export const TaxLineIdSchema = createPrefixedIdentifierSchema(
  TAX_LINE_ID_PREFIX,
  "TaxLineId"
);
export const TaxLineSerializedIdSchema =
  createSerializedIdentifierSchema(TAX_LINE_ID_PREFIX);

export const TaxCalculationPolicySchema = Schema.Struct({
  pricesIncludeTax: Schema.Boolean,
  roundAt: Schema.optional(Schema.Literals(["line", "total"])),
});

export const TaxRegionRecordSchema = Schema.Struct({
  code: TaxTrimmedStringSchema,
  countryCode: TaxCountryCodeSchema,
  createdAt: Schema.Date,
  id: TaxRegionIdSchema,
  metadata: TaxMetadataSchema,
  name: TaxTrimmedStringSchema,
  providerConfigId: Schema.NullOr(TaxProviderConfigIdSchema),
  updatedAt: Schema.Date,
});

export const CreateTaxRegionInputSchema = Schema.Struct({
  code: TaxTrimmedStringSchema,
  countryCode: TaxCountryCodeSchema,
  metadata: Schema.optional(TaxMetadataSchema),
  name: TaxTrimmedStringSchema,
  providerConfigId: Schema.optional(TaxProviderConfigIdSchema),
});

export const TaxRateRecordSchema = Schema.Struct({
  categoryId: Schema.NullOr(TaxCategoryIdSchema),
  createdAt: Schema.Date,
  id: TaxRateIdSchema,
  metadata: TaxMetadataSchema,
  name: TaxTrimmedStringSchema,
  percentage: TaxPercentageSchema,
  regionId: TaxRegionIdSchema,
  updatedAt: Schema.Date,
});

export const CreateTaxRateInputSchema = Schema.Struct({
  categoryId: Schema.optional(TaxCategoryIdSchema),
  metadata: Schema.optional(TaxMetadataSchema),
  name: TaxTrimmedStringSchema,
  percentage: TaxPercentageSchema,
  regionId: TaxRegionIdSchema,
});

export const TaxCategoryRecordSchema = Schema.Struct({
  code: TaxTrimmedStringSchema,
  createdAt: Schema.Date,
  description: Schema.NullOr(Schema.String),
  id: TaxCategoryIdSchema,
  metadata: TaxMetadataSchema,
  name: TaxTrimmedStringSchema,
  updatedAt: Schema.Date,
});

export const CreateTaxCategoryInputSchema = Schema.Struct({
  code: TaxTrimmedStringSchema,
  description: Schema.optional(Schema.String),
  metadata: Schema.optional(TaxMetadataSchema),
  name: TaxTrimmedStringSchema,
});

export const TaxProviderConfigRecordSchema = Schema.Struct({
  createdAt: Schema.Date,
  id: TaxProviderConfigIdSchema,
  isActive: Schema.Boolean,
  metadata: TaxMetadataSchema,
  providerKey: TaxTrimmedStringSchema,
  settings: TaxProviderSettingsSchema,
  updatedAt: Schema.Date,
});

export const CreateTaxProviderConfigInputSchema = Schema.Struct({
  isActive: Schema.optional(Schema.Boolean),
  metadata: Schema.optional(TaxMetadataSchema),
  providerKey: TaxTrimmedStringSchema,
  settings: Schema.optional(TaxProviderSettingsSchema),
});

export const TaxAddressInputSchema = Schema.Struct({
  city: Schema.optional(TaxTrimmedStringSchema),
  countryCode: TaxCountryCodeSchema,
  postalCode: Schema.optional(TaxTrimmedStringSchema),
  province: Schema.optional(TaxTrimmedStringSchema),
});

export const TaxCalculationLineInputSchema = Schema.Struct({
  adjustmentsTotal: Schema.optional(
    Schema.Number.pipe(Schema.check(Schema.isInt()))
  ),
  id: TaxTrimmedStringSchema,
  quantity: TaxPositiveIntegerSchema,
  subtotal: TaxNonNegativeIntegerSchema,
  taxCategoryId: Schema.optional(TaxCategoryIdSchema),
});

export const CalculateTaxInputSchema = Schema.Struct({
  address: TaxAddressInputSchema,
  currencyCode: TaxCurrencyCodeSchema,
  items: Schema.NonEmptyArray(TaxCalculationLineInputSchema),
  policy: TaxCalculationPolicySchema,
  regionId: TaxRegionIdSchema,
});

export const TaxLineSchema = Schema.Struct({
  amount: TaxNonNegativeIntegerSchema,
  currencyCode: TaxCurrencyCodeSchema,
  id: TaxLineIdSchema,
  itemId: TaxTrimmedStringSchema,
  rate: TaxPercentageSchema,
  rateId: Schema.NullOr(TaxRateIdSchema),
  taxableAmount: TaxNonNegativeIntegerSchema,
});

export const TaxCalculationResultSchema = Schema.Struct({
  currencyCode: TaxCurrencyCodeSchema,
  id: TaxCalculationIdSchema,
  lines: Schema.Array(TaxLineSchema),
  providerKey: TaxTrimmedStringSchema,
  regionId: TaxRegionIdSchema,
  totalTax: TaxNonNegativeIntegerSchema,
});

export const TaxRegionApiRecordSchema = Schema.Struct({
  code: TaxTrimmedStringSchema,
  countryCode: TaxCountryCodeSchema,
  createdAt: TaxIsoDateTimeStringSchema,
  id: TaxRegionSerializedIdSchema,
  metadata: TaxMetadataSchema,
  name: TaxTrimmedStringSchema,
  providerConfigId: Schema.NullOr(TaxProviderConfigSerializedIdSchema),
  updatedAt: TaxIsoDateTimeStringSchema,
});

export const TaxRateApiRecordSchema = Schema.Struct({
  categoryId: Schema.NullOr(TaxCategorySerializedIdSchema),
  createdAt: TaxIsoDateTimeStringSchema,
  id: TaxRateSerializedIdSchema,
  metadata: TaxMetadataSchema,
  name: TaxTrimmedStringSchema,
  percentage: TaxPercentageSchema,
  regionId: TaxRegionSerializedIdSchema,
  updatedAt: TaxIsoDateTimeStringSchema,
});

export const TaxCategoryApiRecordSchema = Schema.Struct({
  code: TaxTrimmedStringSchema,
  createdAt: TaxIsoDateTimeStringSchema,
  description: Schema.NullOr(Schema.String),
  id: TaxCategorySerializedIdSchema,
  metadata: TaxMetadataSchema,
  name: TaxTrimmedStringSchema,
  updatedAt: TaxIsoDateTimeStringSchema,
});

export const TaxProviderConfigApiRecordSchema = Schema.Struct({
  createdAt: TaxIsoDateTimeStringSchema,
  id: TaxProviderConfigSerializedIdSchema,
  isActive: Schema.Boolean,
  metadata: TaxMetadataSchema,
  providerKey: TaxTrimmedStringSchema,
  settings: TaxProviderSettingsSchema,
  updatedAt: TaxIsoDateTimeStringSchema,
});

export const TaxLineApiSchema = Schema.Struct({
  amount: TaxNonNegativeIntegerSchema,
  currencyCode: TaxCurrencyCodeSchema,
  id: TaxLineSerializedIdSchema,
  itemId: TaxTrimmedStringSchema,
  rate: TaxPercentageSchema,
  rateId: Schema.NullOr(TaxRateSerializedIdSchema),
  taxableAmount: TaxNonNegativeIntegerSchema,
});

export const TaxCalculationResultApiSchema = Schema.Struct({
  currencyCode: TaxCurrencyCodeSchema,
  id: TaxCalculationSerializedIdSchema,
  lines: Schema.Array(TaxLineApiSchema),
  providerKey: TaxTrimmedStringSchema,
  regionId: TaxRegionSerializedIdSchema,
  totalTax: TaxNonNegativeIntegerSchema,
});

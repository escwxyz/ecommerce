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

export const PricingTrimmedStringSchema = Schema.Trimmed.pipe(
  Schema.check(Schema.isMinLength(1))
);

export const PricingIsoDateTimeStringSchema = PricingTrimmedStringSchema.pipe(
  Schema.check(Schema.makeFilter(isCanonicalIsoDateTime))
);

export const CurrencyIdSchema = createPrefixedIdentifierSchema(
  "cur_",
  "CurrencyId"
);
export const CurrencySerializedIdSchema =
  createSerializedIdentifierSchema("cur_");
export const PriceSetIdSchema = createPrefixedIdentifierSchema(
  "pset_",
  "PriceSetId"
);
export const PriceSetSerializedIdSchema =
  createSerializedIdentifierSchema("pset_");
export const MoneyAmountIdSchema = createPrefixedIdentifierSchema(
  "amt_",
  "MoneyAmountId"
);
export const MoneyAmountSerializedIdSchema =
  createSerializedIdentifierSchema("amt_");
export const PriceListIdSchema = createPrefixedIdentifierSchema(
  "plist_",
  "PriceListId"
);
export const PriceListSerializedIdSchema =
  createSerializedIdentifierSchema("plist_");
export const PriceRuleIdSchema = createPrefixedIdentifierSchema(
  "prule_",
  "PriceRuleId"
);
export const PriceRuleSerializedIdSchema =
  createSerializedIdentifierSchema("prule_");
export const PricePreferenceIdSchema = createPrefixedIdentifierSchema(
  "ppref_",
  "PricePreferenceId"
);
export const PricePreferenceSerializedIdSchema =
  createSerializedIdentifierSchema("ppref_");

export const CurrencyCodeSchema = PricingTrimmedStringSchema.pipe(
  Schema.check(Schema.isMinLength(3)),
  Schema.check(Schema.isMaxLength(3))
);

export const PricingMetadataSchema = Schema.Record(
  Schema.String,
  Schema.Unknown
);
export const PricingRuleAttributesSchema = Schema.Record(
  PricingTrimmedStringSchema,
  PricingTrimmedStringSchema
);

export const PriceListStatusSchema = Schema.Literals([
  "draft",
  "active",
  "disabled",
]);

export const CurrencyRecordSchema = Schema.Struct({
  code: CurrencyCodeSchema,
  createdAt: Schema.Date,
  id: CurrencyIdSchema,
  name: PricingTrimmedStringSchema,
  precision: Schema.Number.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isGreaterThanOrEqualTo(0)),
    Schema.check(Schema.isLessThanOrEqualTo(6))
  ),
  updatedAt: Schema.Date,
});

export const CreateCurrencyInputSchema = Schema.Struct({
  code: CurrencyCodeSchema,
  name: PricingTrimmedStringSchema,
  precision: Schema.optional(
    Schema.Number.pipe(
      Schema.check(Schema.isInt()),
      Schema.check(Schema.isGreaterThanOrEqualTo(0)),
      Schema.check(Schema.isLessThanOrEqualTo(6))
    )
  ),
});

export const PriceSetRecordSchema = Schema.Struct({
  createdAt: Schema.Date,
  id: PriceSetIdSchema,
  metadata: PricingMetadataSchema,
  title: PricingTrimmedStringSchema,
  updatedAt: Schema.Date,
});

export const CreatePriceSetInputSchema = Schema.Struct({
  metadata: Schema.optional(PricingMetadataSchema),
  title: PricingTrimmedStringSchema,
});

export const PriceListRecordSchema = Schema.Struct({
  createdAt: Schema.Date,
  description: Schema.NullOr(Schema.String),
  endsAt: Schema.NullOr(Schema.Date),
  id: PriceListIdSchema,
  startsAt: Schema.NullOr(Schema.Date),
  status: PriceListStatusSchema,
  title: PricingTrimmedStringSchema,
  updatedAt: Schema.Date,
});

export const CreatePriceListInputSchema = Schema.Struct({
  description: Schema.optional(Schema.String),
  endsAt: Schema.optional(Schema.Date),
  startsAt: Schema.optional(Schema.Date),
  status: Schema.optional(PriceListStatusSchema),
  title: PricingTrimmedStringSchema,
});

export const MoneyAmountRecordSchema = Schema.Struct({
  amount: Schema.Number.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isGreaterThanOrEqualTo(0))
  ),
  createdAt: Schema.Date,
  currencyCode: CurrencyCodeSchema,
  id: MoneyAmountIdSchema,
  priceListId: Schema.NullOr(PriceListIdSchema),
  priceSetId: PriceSetIdSchema,
  rules: PricingRuleAttributesSchema,
  updatedAt: Schema.Date,
});

export const CreateMoneyAmountInputSchema = Schema.Struct({
  amount: Schema.Number.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isGreaterThanOrEqualTo(0))
  ),
  currencyCode: CurrencyCodeSchema,
  priceListId: Schema.optional(PriceListIdSchema),
  priceSetId: PriceSetIdSchema,
  rules: Schema.optional(PricingRuleAttributesSchema),
});

export const PriceRuleRecordSchema = Schema.Struct({
  attribute: PricingTrimmedStringSchema,
  createdAt: Schema.Date,
  id: PriceRuleIdSchema,
  priceListId: PriceListIdSchema,
  updatedAt: Schema.Date,
  value: PricingTrimmedStringSchema,
});

export const CreatePriceRuleInputSchema = Schema.Struct({
  attribute: PricingTrimmedStringSchema,
  priceListId: PriceListIdSchema,
  value: PricingTrimmedStringSchema,
});

export const PricePreferenceRecordSchema = Schema.Struct({
  attribute: PricingTrimmedStringSchema,
  createdAt: Schema.Date,
  currencyCode: CurrencyCodeSchema,
  id: PricePreferenceIdSchema,
  updatedAt: Schema.Date,
  value: PricingTrimmedStringSchema,
});

export const CreatePricePreferenceInputSchema = Schema.Struct({
  attribute: PricingTrimmedStringSchema,
  currencyCode: CurrencyCodeSchema,
  value: PricingTrimmedStringSchema,
});

export const CalculatePriceInputSchema = Schema.Struct({
  context: Schema.optional(PricingRuleAttributesSchema),
  currencyCode: CurrencyCodeSchema,
  priceSetId: PriceSetIdSchema,
  quantity: Schema.optional(
    Schema.Number.pipe(
      Schema.check(Schema.isInt()),
      Schema.check(Schema.isGreaterThan(0))
    )
  ),
});

export const PriceTraceSchema = Schema.Struct({
  moneyAmountId: MoneyAmountIdSchema,
  priceListId: Schema.NullOr(PriceListIdSchema),
  ruleMatches: Schema.Array(PricingTrimmedStringSchema),
  source: Schema.Literals(["base", "price-list"]),
});

export const CalculatedPriceSchema = Schema.Struct({
  amount: Schema.Number.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isGreaterThanOrEqualTo(0))
  ),
  currencyCode: CurrencyCodeSchema,
  priceSetId: PriceSetIdSchema,
  quantity: Schema.Number.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isGreaterThan(0))
  ),
  subtotal: Schema.Number.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isGreaterThanOrEqualTo(0))
  ),
  trace: PriceTraceSchema,
});

export const CurrencyApiRecordSchema = Schema.Struct({
  code: CurrencyCodeSchema,
  createdAt: PricingIsoDateTimeStringSchema,
  id: CurrencySerializedIdSchema,
  name: PricingTrimmedStringSchema,
  precision: Schema.Number.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isGreaterThanOrEqualTo(0)),
    Schema.check(Schema.isLessThanOrEqualTo(6))
  ),
  updatedAt: PricingIsoDateTimeStringSchema,
});

export const PriceSetApiRecordSchema = Schema.Struct({
  createdAt: PricingIsoDateTimeStringSchema,
  id: PriceSetSerializedIdSchema,
  metadata: PricingMetadataSchema,
  title: PricingTrimmedStringSchema,
  updatedAt: PricingIsoDateTimeStringSchema,
});

export const PriceListApiRecordSchema = Schema.Struct({
  createdAt: PricingIsoDateTimeStringSchema,
  description: Schema.NullOr(Schema.String),
  endsAt: Schema.NullOr(PricingIsoDateTimeStringSchema),
  id: PriceListSerializedIdSchema,
  startsAt: Schema.NullOr(PricingIsoDateTimeStringSchema),
  status: PriceListStatusSchema,
  title: PricingTrimmedStringSchema,
  updatedAt: PricingIsoDateTimeStringSchema,
});

export const MoneyAmountApiRecordSchema = Schema.Struct({
  amount: Schema.Number.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isGreaterThanOrEqualTo(0))
  ),
  createdAt: PricingIsoDateTimeStringSchema,
  currencyCode: CurrencyCodeSchema,
  id: MoneyAmountSerializedIdSchema,
  priceListId: Schema.NullOr(PriceListSerializedIdSchema),
  priceSetId: PriceSetSerializedIdSchema,
  rules: PricingRuleAttributesSchema,
  updatedAt: PricingIsoDateTimeStringSchema,
});

export const PriceRuleApiRecordSchema = Schema.Struct({
  attribute: PricingTrimmedStringSchema,
  createdAt: PricingIsoDateTimeStringSchema,
  id: PriceRuleSerializedIdSchema,
  priceListId: PriceListSerializedIdSchema,
  updatedAt: PricingIsoDateTimeStringSchema,
  value: PricingTrimmedStringSchema,
});

export const PricePreferenceApiRecordSchema = Schema.Struct({
  attribute: PricingTrimmedStringSchema,
  createdAt: PricingIsoDateTimeStringSchema,
  currencyCode: CurrencyCodeSchema,
  id: PricePreferenceSerializedIdSchema,
  updatedAt: PricingIsoDateTimeStringSchema,
  value: PricingTrimmedStringSchema,
});

export const CalculatedPriceApiSchema = Schema.Struct({
  amount: Schema.Number.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isGreaterThanOrEqualTo(0))
  ),
  currencyCode: CurrencyCodeSchema,
  priceSetId: PriceSetSerializedIdSchema,
  quantity: Schema.Number.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isGreaterThan(0))
  ),
  subtotal: Schema.Number.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isGreaterThanOrEqualTo(0))
  ),
  trace: Schema.Struct({
    moneyAmountId: MoneyAmountSerializedIdSchema,
    priceListId: Schema.NullOr(PriceListSerializedIdSchema),
    ruleMatches: Schema.Array(PricingTrimmedStringSchema),
    source: Schema.Literals(["base", "price-list"]),
  }),
});

export const CurrencyApiListSchema = Schema.Array(CurrencyApiRecordSchema);

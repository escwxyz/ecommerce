import { Schema } from "effect";

export const promotionCampaignTableName = "promotion_campaign" as const;
export const promotionTableName = "promotion_promotion" as const;
export const promotionRuleTableName = "promotion_rule" as const;
export const promotionUsageLimitTableName = "promotion_usage_limit" as const;
export const promotionRedemptionTableName = "promotion_redemption" as const;

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

export const PromotionTrimmedStringSchema = Schema.Trimmed.pipe(
  Schema.check(Schema.isMinLength(1))
);
export const PromotionIsoDateTimeStringSchema =
  PromotionTrimmedStringSchema.pipe(
    Schema.check(Schema.makeFilter(isCanonicalIsoDateTime))
  );
export const PromotionMetadataSchema = Schema.Record(
  Schema.String,
  Schema.Unknown
);
export const PromotionRuleAttributesSchema = Schema.Record(
  Schema.String,
  PromotionTrimmedStringSchema
);
export const PromotionCurrencyCodeSchema = PromotionTrimmedStringSchema.pipe(
  Schema.check(Schema.isMinLength(3)),
  Schema.check(Schema.isMaxLength(3))
);
export const PromotionNonNegativeIntegerSchema = Schema.Number.pipe(
  Schema.check(Schema.isInt()),
  Schema.check(Schema.isGreaterThanOrEqualTo(0))
);
export const PromotionPositiveIntegerSchema = Schema.Number.pipe(
  Schema.check(Schema.isInt()),
  Schema.check(Schema.isGreaterThan(0))
);
export const PromotionDiscountAmountSchema = Schema.Number.pipe(
  Schema.check(Schema.isInt()),
  Schema.check(Schema.isLessThanOrEqualTo(0))
);

export const CampaignIdSchema = createPrefixedIdentifierSchema(
  "pcamp_",
  "CampaignId"
);
export const CampaignSerializedIdSchema =
  createSerializedIdentifierSchema("pcamp_");
export const PromotionIdSchema = createPrefixedIdentifierSchema(
  "promo_",
  "PromotionId"
);
export const PromotionSerializedIdSchema =
  createSerializedIdentifierSchema("promo_");
export const PromotionRuleIdSchema = createPrefixedIdentifierSchema(
  "prule_",
  "PromotionRuleId"
);
export const PromotionRuleSerializedIdSchema =
  createSerializedIdentifierSchema("prule_");
export const PromotionUsageLimitIdSchema = createPrefixedIdentifierSchema(
  "plimit_",
  "PromotionUsageLimitId"
);
export const PromotionUsageLimitSerializedIdSchema =
  createSerializedIdentifierSchema("plimit_");
export const PromotionAdjustmentIdSchema = createPrefixedIdentifierSchema(
  "padj_",
  "PromotionAdjustmentId"
);
export const PromotionAdjustmentSerializedIdSchema =
  createSerializedIdentifierSchema("padj_");
export const PromotionRedemptionIdSchema = createPrefixedIdentifierSchema(
  "pred_",
  "PromotionRedemptionId"
);
export const PromotionRedemptionSerializedIdSchema =
  createSerializedIdentifierSchema("pred_");

export const PromotionStatusSchema = Schema.Literals([
  "draft",
  "active",
  "disabled",
]);

export const PromotionApplicationMethodSchema = Schema.Struct({
  allocation: Schema.Literals(["cart", "line-item"]),
  target: Schema.Literals(["subtotal", "line-item"]),
  type: Schema.Literals(["fixed", "percentage"]),
  value: PromotionPositiveIntegerSchema.pipe(
    Schema.check(Schema.isLessThanOrEqualTo(100))
  ),
});

export const CampaignRecordSchema = Schema.Struct({
  createdAt: Schema.Date,
  description: Schema.NullOr(PromotionTrimmedStringSchema),
  id: CampaignIdSchema,
  metadata: PromotionMetadataSchema,
  name: PromotionTrimmedStringSchema,
  updatedAt: Schema.Date,
});

export const CreateCampaignInputSchema = Schema.Struct({
  description: Schema.optional(PromotionTrimmedStringSchema),
  metadata: Schema.optional(PromotionMetadataSchema),
  name: PromotionTrimmedStringSchema,
});

export const PromotionRecordSchema = Schema.Struct({
  applicationMethod: PromotionApplicationMethodSchema,
  campaignId: Schema.NullOr(CampaignIdSchema),
  code: Schema.NullOr(PromotionTrimmedStringSchema),
  createdAt: Schema.Date,
  endsAt: Schema.NullOr(Schema.Date),
  id: PromotionIdSchema,
  metadata: PromotionMetadataSchema,
  startsAt: Schema.NullOr(Schema.Date),
  status: PromotionStatusSchema,
  title: PromotionTrimmedStringSchema,
  updatedAt: Schema.Date,
});

export const CreatePromotionInputSchema = Schema.Struct({
  applicationMethod: PromotionApplicationMethodSchema,
  campaignId: Schema.optional(CampaignIdSchema),
  code: Schema.optional(PromotionTrimmedStringSchema),
  endsAt: Schema.optional(Schema.Date),
  metadata: Schema.optional(PromotionMetadataSchema),
  startsAt: Schema.optional(Schema.Date),
  status: Schema.optional(PromotionStatusSchema),
  title: PromotionTrimmedStringSchema,
});

export const PromotionRuleRecordSchema = Schema.Struct({
  attribute: PromotionTrimmedStringSchema,
  createdAt: Schema.Date,
  id: PromotionRuleIdSchema,
  promotionId: PromotionIdSchema,
  updatedAt: Schema.Date,
  value: PromotionTrimmedStringSchema,
});

export const CreatePromotionRuleInputSchema = Schema.Struct({
  attribute: PromotionTrimmedStringSchema,
  promotionId: PromotionIdSchema,
  value: PromotionTrimmedStringSchema,
});

export const PromotionUsageLimitScopeSchema = Schema.Literals([
  "total",
  "customer",
]);

export const PromotionUsageLimitRecordSchema = Schema.Struct({
  createdAt: Schema.Date,
  id: PromotionUsageLimitIdSchema,
  limit: PromotionPositiveIntegerSchema,
  promotionId: PromotionIdSchema,
  scope: PromotionUsageLimitScopeSchema,
  updatedAt: Schema.Date,
});

export const CreatePromotionUsageLimitInputSchema = Schema.Struct({
  limit: PromotionPositiveIntegerSchema,
  promotionId: PromotionIdSchema,
  scope: PromotionUsageLimitScopeSchema,
});

export const PromotionRedemptionRecordSchema = Schema.Struct({
  adjustmentIds: Schema.Array(PromotionAdjustmentIdSchema),
  cartId: PromotionTrimmedStringSchema,
  createdAt: Schema.Date,
  id: PromotionRedemptionIdSchema,
  promotionId: PromotionIdSchema,
});

export const RecordPromotionRedemptionInputSchema = Schema.Struct({
  adjustmentIds: Schema.Array(PromotionAdjustmentIdSchema),
  cartId: PromotionTrimmedStringSchema,
  promotionId: PromotionIdSchema,
});

export const PromotionCartInputSchema = Schema.Struct({
  currencyCode: PromotionCurrencyCodeSchema,
  id: PromotionTrimmedStringSchema,
  lines: Schema.optional(
    Schema.Array(
      Schema.Struct({
        id: PromotionTrimmedStringSchema,
        quantity: PromotionPositiveIntegerSchema,
        subtotal: PromotionNonNegativeIntegerSchema,
      })
    )
  ),
  subtotal: PromotionNonNegativeIntegerSchema,
});

export const CalculatePromotionAdjustmentsInputSchema = Schema.Struct({
  cart: PromotionCartInputSchema,
  context: Schema.optional(PromotionRuleAttributesSchema),
  promotionCodes: Schema.optional(Schema.Array(PromotionTrimmedStringSchema)),
});

export const PromotionAdjustmentTraceSchema = Schema.Struct({
  promotionCode: Schema.NullOr(PromotionTrimmedStringSchema),
  ruleMatches: Schema.Array(PromotionTrimmedStringSchema),
  source: Schema.Literals(["automatic", "discount-code"]),
});

export const PromotionAdjustmentSchema = Schema.Struct({
  amount: PromotionDiscountAmountSchema,
  currencyCode: PromotionCurrencyCodeSchema,
  id: PromotionAdjustmentIdSchema,
  promotionId: PromotionIdSchema,
  target: Schema.Literals(["subtotal", "line-item"]),
  trace: PromotionAdjustmentTraceSchema,
});

export const PromotionAdjustmentResultSchema = Schema.Struct({
  adjustments: Schema.Array(PromotionAdjustmentSchema),
  cartId: PromotionTrimmedStringSchema,
  currencyCode: PromotionCurrencyCodeSchema,
  subtotal: PromotionNonNegativeIntegerSchema,
  totalDiscount: PromotionDiscountAmountSchema,
});

export const PromotionAdjustmentApiSchema = Schema.Struct({
  amount: PromotionDiscountAmountSchema,
  currencyCode: PromotionCurrencyCodeSchema,
  id: PromotionAdjustmentSerializedIdSchema,
  promotionId: PromotionSerializedIdSchema,
  target: Schema.Literals(["subtotal", "line-item"]),
  trace: PromotionAdjustmentTraceSchema,
});

export const PromotionAdjustmentResultApiSchema = Schema.Struct({
  adjustments: Schema.Array(PromotionAdjustmentApiSchema),
  cartId: PromotionTrimmedStringSchema,
  currencyCode: PromotionCurrencyCodeSchema,
  subtotal: PromotionNonNegativeIntegerSchema,
  totalDiscount: PromotionDiscountAmountSchema,
});

export const PromotionIdentifierSchema = Schema.Struct({
  id: PromotionIdSchema,
});

export const CampaignApiRecordSchema = Schema.Struct({
  createdAt: PromotionIsoDateTimeStringSchema,
  description: Schema.NullOr(PromotionTrimmedStringSchema),
  id: CampaignSerializedIdSchema,
  metadata: PromotionMetadataSchema,
  name: PromotionTrimmedStringSchema,
  updatedAt: PromotionIsoDateTimeStringSchema,
});

export const PromotionApiRecordSchema = Schema.Struct({
  applicationMethod: PromotionApplicationMethodSchema,
  campaignId: Schema.NullOr(CampaignSerializedIdSchema),
  code: Schema.NullOr(PromotionTrimmedStringSchema),
  createdAt: PromotionIsoDateTimeStringSchema,
  endsAt: Schema.NullOr(PromotionIsoDateTimeStringSchema),
  id: PromotionSerializedIdSchema,
  metadata: PromotionMetadataSchema,
  startsAt: Schema.NullOr(PromotionIsoDateTimeStringSchema),
  status: PromotionStatusSchema,
  title: PromotionTrimmedStringSchema,
  updatedAt: PromotionIsoDateTimeStringSchema,
});

export const PromotionRuleApiRecordSchema = Schema.Struct({
  attribute: PromotionTrimmedStringSchema,
  createdAt: PromotionIsoDateTimeStringSchema,
  id: PromotionRuleSerializedIdSchema,
  promotionId: PromotionSerializedIdSchema,
  updatedAt: PromotionIsoDateTimeStringSchema,
  value: PromotionTrimmedStringSchema,
});

export const PromotionUsageLimitApiRecordSchema = Schema.Struct({
  createdAt: PromotionIsoDateTimeStringSchema,
  id: PromotionUsageLimitSerializedIdSchema,
  limit: PromotionPositiveIntegerSchema,
  promotionId: PromotionSerializedIdSchema,
  scope: PromotionUsageLimitScopeSchema,
  updatedAt: PromotionIsoDateTimeStringSchema,
});

export const PromotionRedemptionApiRecordSchema = Schema.Struct({
  adjustmentIds: Schema.Array(PromotionAdjustmentSerializedIdSchema),
  cartId: PromotionTrimmedStringSchema,
  createdAt: PromotionIsoDateTimeStringSchema,
  id: PromotionRedemptionSerializedIdSchema,
  promotionId: PromotionSerializedIdSchema,
});

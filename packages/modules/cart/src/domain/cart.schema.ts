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

export const CartTrimmedStringSchema = Schema.Trimmed.pipe(
  Schema.check(Schema.isMinLength(1))
);
export const CartIsoDateTimeStringSchema = CartTrimmedStringSchema.pipe(
  Schema.check(Schema.makeFilter(isCanonicalIsoDateTime))
);
export const CartMetadataSchema = Schema.Record(Schema.String, Schema.Unknown);
export const CartNullableStringSchema = Schema.NullOr(CartTrimmedStringSchema);

export const CartIdSchema = createPrefixedIdentifierSchema("cart_", "CartId");
export const CartSerializedIdSchema = createSerializedIdentifierSchema("cart_");
export const CartLineItemIdSchema = createPrefixedIdentifierSchema(
  "clitem_",
  "CartLineItemId"
);
export const CartLineItemSerializedIdSchema =
  createSerializedIdentifierSchema("clitem_");
export const CartAdjustmentIdSchema = createPrefixedIdentifierSchema(
  "cadj_",
  "CartAdjustmentId"
);
export const CartAdjustmentSerializedIdSchema =
  createSerializedIdentifierSchema("cadj_");

export const CartCountryCodeSchema = CartTrimmedStringSchema.pipe(
  Schema.check(Schema.isMinLength(2)),
  Schema.check(Schema.isMaxLength(2))
);
export const CartCurrencyCodeSchema = CartTrimmedStringSchema.pipe(
  Schema.check(Schema.isMinLength(3)),
  Schema.check(Schema.isMaxLength(3))
);
export const CartNonNegativeIntegerSchema = Schema.Number.pipe(
  Schema.check(Schema.isInt()),
  Schema.check(Schema.isGreaterThanOrEqualTo(0))
);
export const CartPositiveIntegerSchema = Schema.Number.pipe(
  Schema.check(Schema.isInt()),
  Schema.check(Schema.isGreaterThan(0))
);
export const CartAdjustmentAmountSchema = Schema.Number.pipe(
  Schema.check(Schema.isInt())
);

export const CartAddressSchema = Schema.Struct({
  address1: CartTrimmedStringSchema,
  address2: Schema.optional(CartTrimmedStringSchema),
  city: CartTrimmedStringSchema,
  company: Schema.optional(CartTrimmedStringSchema),
  countryCode: CartCountryCodeSchema,
  firstName: Schema.optional(CartTrimmedStringSchema),
  lastName: Schema.optional(CartTrimmedStringSchema),
  phone: Schema.optional(CartTrimmedStringSchema),
  postalCode: CartTrimmedStringSchema,
  province: Schema.optional(CartTrimmedStringSchema),
});

export const CartTotalsSnapshotSchema = Schema.Struct({
  adjustmentTotal: CartAdjustmentAmountSchema,
  currencyCode: CartCurrencyCodeSchema,
  discountTotal: CartNonNegativeIntegerSchema,
  giftCardTotal: CartNonNegativeIntegerSchema,
  itemSubtotal: CartNonNegativeIntegerSchema,
  shippingTotal: CartNonNegativeIntegerSchema,
  subtotal: CartNonNegativeIntegerSchema,
  taxTotal: CartNonNegativeIntegerSchema,
  total: CartNonNegativeIntegerSchema,
});

export const CartStatusSchema = Schema.Literals([
  "active",
  "completed",
  "canceled",
]);

export const CartRecordSchema = Schema.Struct({
  billingAddress: Schema.NullOr(CartAddressSchema),
  completedAt: Schema.NullOr(Schema.Date),
  createdAt: Schema.Date,
  currencyCode: CartCurrencyCodeSchema,
  customerId: CartNullableStringSchema,
  email: Schema.NullOr(CartTrimmedStringSchema),
  id: CartIdSchema,
  metadata: CartMetadataSchema,
  paymentCollectionId: CartNullableStringSchema,
  regionId: CartNullableStringSchema,
  salesChannelId: CartNullableStringSchema,
  shippingAddress: Schema.NullOr(CartAddressSchema),
  shippingOptionId: CartNullableStringSchema,
  status: CartStatusSchema,
  totals: CartTotalsSnapshotSchema,
  updatedAt: Schema.Date,
});

export const CartLineItemRecordSchema = Schema.Struct({
  cartId: CartIdSchema,
  createdAt: Schema.Date,
  id: CartLineItemIdSchema,
  metadata: CartMetadataSchema,
  productId: CartTrimmedStringSchema,
  quantity: CartPositiveIntegerSchema,
  title: CartTrimmedStringSchema,
  unitPrice: CartNonNegativeIntegerSchema,
  updatedAt: Schema.Date,
  variantId: CartTrimmedStringSchema,
});

export const CartAdjustmentTypeSchema = Schema.Literals([
  "discount",
  "promotion",
  "shipping",
  "tax",
  "manual",
]);

export const CartAdjustmentRecordSchema = Schema.Struct({
  amount: CartAdjustmentAmountSchema,
  cartId: CartIdSchema,
  createdAt: Schema.Date,
  id: CartAdjustmentIdSchema,
  lineItemId: Schema.NullOr(CartLineItemIdSchema),
  metadata: CartMetadataSchema,
  source: CartTrimmedStringSchema,
  type: CartAdjustmentTypeSchema,
  updatedAt: Schema.Date,
});

export const CartAggregateSchema = Schema.Struct({
  adjustments: Schema.Array(CartAdjustmentRecordSchema),
  cart: CartRecordSchema,
  lineItems: Schema.Array(CartLineItemRecordSchema),
});

export const CartCoordinationMetadataSchema = Schema.Struct({
  causationId: Schema.optional(CartTrimmedStringSchema),
  correlationId: CartTrimmedStringSchema,
  idempotencyKey: CartTrimmedStringSchema,
  workflowRunId: Schema.optional(CartTrimmedStringSchema),
});

export const CreateCartInputSchema = Schema.Struct({
  currencyCode: CartCurrencyCodeSchema,
  customerId: Schema.optional(CartTrimmedStringSchema),
  email: Schema.optional(CartTrimmedStringSchema),
  metadata: Schema.optional(CartMetadataSchema),
  regionId: Schema.optional(CartTrimmedStringSchema),
  salesChannelId: Schema.optional(CartTrimmedStringSchema),
});

export const AddCartLineItemInputSchema = Schema.Struct({
  ...CartCoordinationMetadataSchema.fields,
  cartId: CartIdSchema,
  metadata: Schema.optional(CartMetadataSchema),
  productId: CartTrimmedStringSchema,
  quantity: CartPositiveIntegerSchema,
  title: CartTrimmedStringSchema,
  unitPrice: CartNonNegativeIntegerSchema,
  variantId: CartTrimmedStringSchema,
});

export const UpdateCartLineItemInputSchema = Schema.Struct({
  ...CartCoordinationMetadataSchema.fields,
  cartId: CartIdSchema,
  lineItemId: CartLineItemIdSchema,
  quantity: CartNonNegativeIntegerSchema,
});

export const AssociateCartCustomerInputSchema = Schema.Struct({
  ...CartCoordinationMetadataSchema.fields,
  cartId: CartIdSchema,
  customerId: Schema.optional(CartTrimmedStringSchema),
  email: Schema.optional(CartTrimmedStringSchema),
});

export const SetCartAddressesInputSchema = Schema.Struct({
  ...CartCoordinationMetadataSchema.fields,
  billingAddress: Schema.optional(CartAddressSchema),
  cartId: CartIdSchema,
  shippingAddress: Schema.optional(CartAddressSchema),
});

export const SetCartRegionChannelInputSchema = Schema.Struct({
  ...CartCoordinationMetadataSchema.fields,
  cartId: CartIdSchema,
  currencyCode: Schema.optional(CartCurrencyCodeSchema),
  regionId: Schema.optional(CartTrimmedStringSchema),
  salesChannelId: Schema.optional(CartTrimmedStringSchema),
});

export const SetCartCheckoutReferencesInputSchema = Schema.Struct({
  ...CartCoordinationMetadataSchema.fields,
  cartId: CartIdSchema,
  paymentCollectionId: Schema.optional(CartTrimmedStringSchema),
  shippingOptionId: Schema.optional(CartTrimmedStringSchema),
});

export const ApplyCartAdjustmentInputSchema = Schema.Struct({
  ...CartCoordinationMetadataSchema.fields,
  amount: CartAdjustmentAmountSchema,
  cartId: CartIdSchema,
  lineItemId: Schema.optional(CartLineItemIdSchema),
  metadata: Schema.optional(CartMetadataSchema),
  source: CartTrimmedStringSchema,
  type: CartAdjustmentTypeSchema,
});

export const UpdateCartTotalsInputSchema = Schema.Struct({
  ...CartCoordinationMetadataSchema.fields,
  cartId: CartIdSchema,
  totals: CartTotalsSnapshotSchema,
});

export const CartIdentifierSchema = Schema.Struct({
  id: CartIdSchema,
});

export const CartApiRecordSchema = Schema.Struct({
  billingAddress: Schema.NullOr(CartAddressSchema),
  completedAt: Schema.NullOr(CartIsoDateTimeStringSchema),
  createdAt: CartIsoDateTimeStringSchema,
  currencyCode: CartCurrencyCodeSchema,
  customerId: CartNullableStringSchema,
  email: Schema.NullOr(CartTrimmedStringSchema),
  id: CartSerializedIdSchema,
  metadata: CartMetadataSchema,
  paymentCollectionId: CartNullableStringSchema,
  regionId: CartNullableStringSchema,
  salesChannelId: CartNullableStringSchema,
  shippingAddress: Schema.NullOr(CartAddressSchema),
  shippingOptionId: CartNullableStringSchema,
  status: CartStatusSchema,
  totals: CartTotalsSnapshotSchema,
  updatedAt: CartIsoDateTimeStringSchema,
});

export const CartLineItemApiRecordSchema = Schema.Struct({
  cartId: CartSerializedIdSchema,
  createdAt: CartIsoDateTimeStringSchema,
  id: CartLineItemSerializedIdSchema,
  metadata: CartMetadataSchema,
  productId: CartTrimmedStringSchema,
  quantity: CartPositiveIntegerSchema,
  title: CartTrimmedStringSchema,
  unitPrice: CartNonNegativeIntegerSchema,
  updatedAt: CartIsoDateTimeStringSchema,
  variantId: CartTrimmedStringSchema,
});

export const CartAdjustmentApiRecordSchema = Schema.Struct({
  amount: CartAdjustmentAmountSchema,
  cartId: CartSerializedIdSchema,
  createdAt: CartIsoDateTimeStringSchema,
  id: CartAdjustmentSerializedIdSchema,
  lineItemId: Schema.NullOr(CartLineItemSerializedIdSchema),
  metadata: CartMetadataSchema,
  source: CartTrimmedStringSchema,
  type: CartAdjustmentTypeSchema,
  updatedAt: CartIsoDateTimeStringSchema,
});

export const CartAggregateApiSchema = Schema.Struct({
  adjustments: Schema.Array(CartAdjustmentApiRecordSchema),
  cart: CartApiRecordSchema,
  lineItems: Schema.Array(CartLineItemApiRecordSchema),
});

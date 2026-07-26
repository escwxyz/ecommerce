import { Schema } from "effect";

const isCanonicalIsoDateTime = (value: string): boolean => {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
};

const isEmailLike = (value: string): boolean => /\S+@\S+\.\S+/u.test(value);

export const OrderTrimmedStringSchema = Schema.Trimmed.pipe(
  Schema.check(Schema.isMinLength(1))
);
export const OrderMetadataSchema = Schema.Record(Schema.String, Schema.Unknown);

export const OrderIdSchema = Schema.NonEmptyString.pipe(
  Schema.check(Schema.isStartsWith("ord_")),
  Schema.brand("OrderId")
);
export const OrderLineItemIdSchema = Schema.NonEmptyString.pipe(
  Schema.check(Schema.isStartsWith("ordli_")),
  Schema.brand("OrderLineItemId")
);
export const OrderTransactionIdSchema = Schema.NonEmptyString.pipe(
  Schema.check(Schema.isStartsWith("ordtxn_")),
  Schema.brand("OrderTransactionId")
);
export const OrderSerializedIdSchema = OrderTrimmedStringSchema.pipe(
  Schema.check(Schema.isStartsWith("ord_"))
);
export const OrderLineItemSerializedIdSchema = OrderTrimmedStringSchema.pipe(
  Schema.check(Schema.isStartsWith("ordli_"))
);
export const OrderTransactionSerializedIdSchema =
  OrderTrimmedStringSchema.pipe(Schema.check(Schema.isStartsWith("ordtxn_")));

export const OrderIsoDateTimeStringSchema = OrderTrimmedStringSchema.pipe(
  Schema.check(Schema.makeFilter(isCanonicalIsoDateTime))
);
export const OrderNullableIsoDateTimeStringSchema = Schema.NullOr(
  OrderIsoDateTimeStringSchema
);

export const OrderEmailSchema = OrderTrimmedStringSchema.pipe(
  Schema.check(Schema.makeFilter(isEmailLike))
);
export const OrderCountryCodeSchema = OrderTrimmedStringSchema.pipe(
  Schema.check(Schema.isMinLength(2)),
  Schema.check(Schema.isMaxLength(2))
);
export const OrderCurrencyCodeSchema = OrderTrimmedStringSchema.pipe(
  Schema.check(Schema.isMinLength(3)),
  Schema.check(Schema.isMaxLength(3))
);
export const OrderNonNegativeIntegerSchema = Schema.Number.pipe(
  Schema.check(Schema.isInt()),
  Schema.check(Schema.isGreaterThanOrEqualTo(0))
);
export const OrderPositiveIntegerSchema = Schema.Number.pipe(
  Schema.check(Schema.isInt()),
  Schema.check(Schema.isGreaterThan(0))
);

export const OrderCoordinationMetadataSchema = Schema.Struct({
  causationId: Schema.optional(OrderTrimmedStringSchema),
  correlationId: OrderTrimmedStringSchema,
  idempotencyKey: OrderTrimmedStringSchema,
  workflowRunId: Schema.optional(OrderTrimmedStringSchema),
});

export const OrderAddressSnapshotSchema = Schema.Struct({
  address1: OrderTrimmedStringSchema,
  address2: Schema.optional(OrderTrimmedStringSchema),
  city: OrderTrimmedStringSchema,
  company: Schema.optional(OrderTrimmedStringSchema),
  countryCode: OrderCountryCodeSchema,
  firstName: Schema.optional(OrderTrimmedStringSchema),
  lastName: Schema.optional(OrderTrimmedStringSchema),
  phone: Schema.optional(OrderTrimmedStringSchema),
  postalCode: OrderTrimmedStringSchema,
  province: Schema.optional(OrderTrimmedStringSchema),
});

export const OrderTotalsSnapshotSchema = Schema.Struct({
  adjustmentTotal: Schema.Int,
  currencyCode: OrderCurrencyCodeSchema,
  discountTotal: OrderNonNegativeIntegerSchema,
  giftCardTotal: OrderNonNegativeIntegerSchema,
  itemSubtotal: OrderNonNegativeIntegerSchema,
  shippingTotal: OrderNonNegativeIntegerSchema,
  subtotal: OrderNonNegativeIntegerSchema,
  taxTotal: OrderNonNegativeIntegerSchema,
  total: OrderNonNegativeIntegerSchema,
});

export const OrderItemSnapshotSchema = Schema.Struct({
  metadata: Schema.optional(OrderMetadataSchema),
  productId: OrderTrimmedStringSchema,
  productTitle: OrderTrimmedStringSchema,
  sku: Schema.optional(OrderTrimmedStringSchema),
  thumbnailUrl: Schema.optional(OrderTrimmedStringSchema),
  variantId: OrderTrimmedStringSchema,
  variantTitle: OrderTrimmedStringSchema,
});

export const OrderPaymentReferenceSchema = Schema.Struct({
  amount: OrderNonNegativeIntegerSchema,
  currencyCode: OrderCurrencyCodeSchema,
  paymentCollectionId: Schema.optional(OrderTrimmedStringSchema),
  paymentId: OrderTrimmedStringSchema,
  providerId: Schema.optional(OrderTrimmedStringSchema),
  status: OrderTrimmedStringSchema,
});

export const OrderFulfillmentReferenceSchema = Schema.Struct({
  fulfillmentId: Schema.optional(OrderTrimmedStringSchema),
  providerId: Schema.optional(OrderTrimmedStringSchema),
  shippingOptionId: OrderTrimmedStringSchema,
  status: OrderTrimmedStringSchema,
});

export const OrderStatusSchema = Schema.Literals([
  "placed",
  "processing",
  "completed",
  "canceled",
]);
export const OrderTransactionTypeSchema = Schema.Literals([
  "payment",
  "refund",
  "capture",
  "adjustment",
]);
export const OrderPostPurchaseOperationTypeSchema = Schema.Literals([
  "edit",
  "exchange",
  "claim",
  "return",
  "cancellation",
]);

export const OrderRecordSchema = Schema.Struct({
  billingAddress: Schema.NullOr(OrderAddressSnapshotSchema),
  cartId: OrderTrimmedStringSchema,
  completedAt: Schema.NullOr(Schema.Date),
  createdAt: Schema.Date,
  currencyCode: OrderCurrencyCodeSchema,
  customerId: Schema.NullOr(OrderTrimmedStringSchema),
  email: Schema.NullOr(OrderEmailSchema),
  fulfillmentReferences: Schema.Array(OrderFulfillmentReferenceSchema),
  id: OrderIdSchema,
  metadata: OrderMetadataSchema,
  paymentReferences: Schema.Array(OrderPaymentReferenceSchema),
  shippingAddress: Schema.NullOr(OrderAddressSnapshotSchema),
  status: OrderStatusSchema,
  totals: OrderTotalsSnapshotSchema,
  updatedAt: Schema.Date,
});

export const OrderLineItemRecordSchema = Schema.Struct({
  createdAt: Schema.Date,
  id: OrderLineItemIdSchema,
  itemSnapshot: OrderItemSnapshotSchema,
  metadata: OrderMetadataSchema,
  orderId: OrderIdSchema,
  quantity: OrderPositiveIntegerSchema,
  taxTotal: OrderNonNegativeIntegerSchema,
  title: OrderTrimmedStringSchema,
  total: OrderNonNegativeIntegerSchema,
  unitPrice: OrderNonNegativeIntegerSchema,
  updatedAt: Schema.Date,
});

export const OrderTransactionRecordSchema = Schema.Struct({
  amount: Schema.Int,
  createdAt: Schema.Date,
  currencyCode: OrderCurrencyCodeSchema,
  id: OrderTransactionIdSchema,
  metadata: OrderMetadataSchema,
  orderId: OrderIdSchema,
  referenceId: Schema.NullOr(OrderTrimmedStringSchema),
  type: OrderTransactionTypeSchema,
  updatedAt: Schema.Date,
});

export const OrderStateTransitionRecordSchema = Schema.Struct({
  changedAt: Schema.Date,
  fromStatus: Schema.NullOr(OrderStatusSchema),
  metadata: OrderMetadataSchema,
  orderId: OrderIdSchema,
  toStatus: OrderStatusSchema,
});

export const OrderPostPurchaseOperationRecordSchema = Schema.Struct({
  createdAt: Schema.Date,
  id: OrderTrimmedStringSchema,
  metadata: OrderMetadataSchema,
  orderId: OrderIdSchema,
  status: OrderTrimmedStringSchema,
  type: OrderPostPurchaseOperationTypeSchema,
  updatedAt: Schema.Date,
});

export const OrderAggregateSchema = Schema.Struct({
  lineItems: Schema.Array(OrderLineItemRecordSchema),
  operations: Schema.Array(OrderPostPurchaseOperationRecordSchema),
  order: OrderRecordSchema,
  stateTransitions: Schema.Array(OrderStateTransitionRecordSchema),
  transactions: Schema.Array(OrderTransactionRecordSchema),
});

export const CreateOrderLineItemInputSchema = Schema.Struct({
  itemSnapshot: OrderItemSnapshotSchema,
  metadata: Schema.optional(OrderMetadataSchema),
  quantity: OrderPositiveIntegerSchema,
  taxTotal: Schema.optional(OrderNonNegativeIntegerSchema),
  title: OrderTrimmedStringSchema,
  total: OrderNonNegativeIntegerSchema,
  unitPrice: OrderNonNegativeIntegerSchema,
});

export const CreateOrderFromCheckoutInputSchema = Schema.Struct({
  billingAddress: Schema.optional(Schema.NullOr(OrderAddressSnapshotSchema)),
  cartId: OrderTrimmedStringSchema,
  causationId: Schema.optional(OrderTrimmedStringSchema),
  correlationId: OrderTrimmedStringSchema,
  customerId: Schema.optional(OrderTrimmedStringSchema),
  email: Schema.optional(OrderEmailSchema),
  fulfillmentReferences: Schema.optional(
    Schema.Array(OrderFulfillmentReferenceSchema)
  ),
  idempotencyKey: OrderTrimmedStringSchema,
  lineItems: Schema.NonEmptyArray(CreateOrderLineItemInputSchema),
  metadata: Schema.optional(OrderMetadataSchema),
  paymentReferences: Schema.optional(Schema.Array(OrderPaymentReferenceSchema)),
  shippingAddress: Schema.optional(Schema.NullOr(OrderAddressSnapshotSchema)),
  totals: OrderTotalsSnapshotSchema,
  workflowRunId: Schema.optional(OrderTrimmedStringSchema),
});

export const TransitionOrderStatusInputSchema = Schema.Struct({
  causationId: Schema.optional(OrderTrimmedStringSchema),
  correlationId: OrderTrimmedStringSchema,
  idempotencyKey: OrderTrimmedStringSchema,
  metadata: Schema.optional(OrderMetadataSchema),
  orderId: OrderSerializedIdSchema,
  status: OrderStatusSchema,
  workflowRunId: Schema.optional(OrderTrimmedStringSchema),
});

export const RecordOrderTransactionInputSchema = Schema.Struct({
  amount: Schema.Int,
  causationId: Schema.optional(OrderTrimmedStringSchema),
  correlationId: OrderTrimmedStringSchema,
  currencyCode: OrderCurrencyCodeSchema,
  idempotencyKey: OrderTrimmedStringSchema,
  metadata: Schema.optional(OrderMetadataSchema),
  orderId: OrderSerializedIdSchema,
  referenceId: Schema.optional(OrderTrimmedStringSchema),
  type: OrderTransactionTypeSchema,
  workflowRunId: Schema.optional(OrderTrimmedStringSchema),
});

export const OrderIdentifierSchema = Schema.Struct({
  id: OrderSerializedIdSchema,
});

export const OrderApiRecordSchema = Schema.Struct({
  billingAddress: Schema.NullOr(OrderAddressSnapshotSchema),
  cartId: OrderTrimmedStringSchema,
  completedAt: OrderNullableIsoDateTimeStringSchema,
  createdAt: OrderIsoDateTimeStringSchema,
  currencyCode: OrderCurrencyCodeSchema,
  customerId: Schema.NullOr(OrderTrimmedStringSchema),
  email: Schema.NullOr(OrderEmailSchema),
  fulfillmentReferences: Schema.Array(OrderFulfillmentReferenceSchema),
  id: OrderIdSchema,
  metadata: OrderMetadataSchema,
  paymentReferences: Schema.Array(OrderPaymentReferenceSchema),
  shippingAddress: Schema.NullOr(OrderAddressSnapshotSchema),
  status: OrderStatusSchema,
  totals: OrderTotalsSnapshotSchema,
  updatedAt: OrderIsoDateTimeStringSchema,
});
export const OrderLineItemApiRecordSchema = Schema.Struct({
  createdAt: OrderIsoDateTimeStringSchema,
  id: OrderLineItemIdSchema,
  itemSnapshot: OrderItemSnapshotSchema,
  metadata: OrderMetadataSchema,
  orderId: OrderIdSchema,
  quantity: OrderPositiveIntegerSchema,
  taxTotal: OrderNonNegativeIntegerSchema,
  title: OrderTrimmedStringSchema,
  total: OrderNonNegativeIntegerSchema,
  unitPrice: OrderNonNegativeIntegerSchema,
  updatedAt: OrderIsoDateTimeStringSchema,
});
export const OrderTransactionApiRecordSchema = Schema.Struct({
  amount: Schema.Int,
  createdAt: OrderIsoDateTimeStringSchema,
  currencyCode: OrderCurrencyCodeSchema,
  id: OrderTransactionIdSchema,
  metadata: OrderMetadataSchema,
  orderId: OrderIdSchema,
  referenceId: Schema.NullOr(OrderTrimmedStringSchema),
  type: OrderTransactionTypeSchema,
  updatedAt: OrderIsoDateTimeStringSchema,
});
export const OrderStateTransitionApiRecordSchema = Schema.Struct({
  changedAt: OrderIsoDateTimeStringSchema,
  fromStatus: Schema.NullOr(OrderStatusSchema),
  metadata: OrderMetadataSchema,
  orderId: OrderIdSchema,
  toStatus: OrderStatusSchema,
});
export const OrderPostPurchaseOperationApiRecordSchema = Schema.Struct({
  createdAt: OrderIsoDateTimeStringSchema,
  id: OrderTrimmedStringSchema,
  metadata: OrderMetadataSchema,
  orderId: OrderIdSchema,
  status: OrderTrimmedStringSchema,
  type: OrderPostPurchaseOperationTypeSchema,
  updatedAt: OrderIsoDateTimeStringSchema,
});
export const OrderAggregateApiSchema = Schema.Struct({
  lineItems: Schema.Array(OrderLineItemApiRecordSchema),
  operations: Schema.Array(OrderPostPurchaseOperationApiRecordSchema),
  order: OrderApiRecordSchema,
  stateTransitions: Schema.Array(OrderStateTransitionApiRecordSchema),
  transactions: Schema.Array(OrderTransactionApiRecordSchema),
});
export const OrderApiListSchema = Schema.Array(OrderApiRecordSchema);

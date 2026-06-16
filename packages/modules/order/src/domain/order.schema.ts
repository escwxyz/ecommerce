import { z } from "zod";

const MetadataSchema = z.record(z.string(), z.unknown());
const NullableStringSchema = z.string().min(1).nullable();

export const OrderCoordinationMetadataSchema = z.object({
  causationId: z.string().min(1).optional(),
  correlationId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  workflowRunId: z.string().min(1).optional(),
});

export const OrderAddressSnapshotSchema = z.object({
  address1: z.string().min(1),
  address2: z.string().min(1).optional(),
  city: z.string().min(1),
  company: z.string().min(1).optional(),
  countryCode: z
    .string()
    .min(2)
    .max(2)
    .transform((value) => value.toUpperCase()),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  postalCode: z.string().min(1),
  province: z.string().min(1).optional(),
});

export const OrderTotalsSnapshotSchema = z.object({
  adjustmentTotal: z.number().int(),
  currencyCode: z
    .string()
    .min(3)
    .max(3)
    .transform((value) => value.toUpperCase()),
  discountTotal: z.number().int().nonnegative(),
  giftCardTotal: z.number().int().nonnegative(),
  itemSubtotal: z.number().int().nonnegative(),
  shippingTotal: z.number().int().nonnegative(),
  subtotal: z.number().int().nonnegative(),
  taxTotal: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

export const OrderItemSnapshotSchema = z.object({
  metadata: MetadataSchema.optional(),
  productId: z.string().min(1),
  productTitle: z.string().min(1),
  sku: z.string().min(1).optional(),
  thumbnailUrl: z.string().min(1).optional(),
  variantId: z.string().min(1),
  variantTitle: z.string().min(1),
});

export const OrderPaymentReferenceSchema = z.object({
  amount: z.number().int().nonnegative(),
  currencyCode: z.string().min(3).max(3),
  paymentCollectionId: z.string().min(1).optional(),
  paymentId: z.string().min(1),
  providerId: z.string().min(1).optional(),
  status: z.string().min(1),
});

export const OrderFulfillmentReferenceSchema = z.object({
  fulfillmentId: z.string().min(1).optional(),
  providerId: z.string().min(1).optional(),
  shippingOptionId: z.string().min(1),
  status: z.string().min(1),
});

export const OrderStatusSchema = z.enum([
  "placed",
  "processing",
  "completed",
  "canceled",
]);

export const OrderTransactionTypeSchema = z.enum([
  "payment",
  "refund",
  "capture",
  "adjustment",
]);

export const OrderPostPurchaseOperationTypeSchema = z.enum([
  "edit",
  "exchange",
  "claim",
  "return",
  "cancellation",
]);

export const OrderRecordSchema = z.object({
  billingAddress: OrderAddressSnapshotSchema.nullable(),
  cartId: z.string().min(1),
  completedAt: z.date().nullable(),
  createdAt: z.date(),
  currencyCode: z.string().min(3).max(3),
  customerId: NullableStringSchema,
  email: z.string().email().nullable(),
  fulfillmentReferences: z.array(OrderFulfillmentReferenceSchema).readonly(),
  id: z.string().min(1).startsWith("ord_"),
  metadata: MetadataSchema,
  paymentReferences: z.array(OrderPaymentReferenceSchema).readonly(),
  shippingAddress: OrderAddressSnapshotSchema.nullable(),
  status: OrderStatusSchema,
  totals: OrderTotalsSnapshotSchema,
  updatedAt: z.date(),
});

export const OrderLineItemRecordSchema = z.object({
  createdAt: z.date(),
  id: z.string().min(1).startsWith("ordli_"),
  itemSnapshot: OrderItemSnapshotSchema,
  metadata: MetadataSchema,
  orderId: z.string().min(1).startsWith("ord_"),
  quantity: z.number().int().positive(),
  taxTotal: z.number().int().nonnegative(),
  title: z.string().min(1),
  total: z.number().int().nonnegative(),
  unitPrice: z.number().int().nonnegative(),
  updatedAt: z.date(),
});

export const OrderTransactionRecordSchema = z.object({
  amount: z.number().int(),
  createdAt: z.date(),
  currencyCode: z.string().min(3).max(3),
  id: z.string().min(1).startsWith("ordtxn_"),
  metadata: MetadataSchema,
  orderId: z.string().min(1).startsWith("ord_"),
  referenceId: z.string().min(1).nullable(),
  type: OrderTransactionTypeSchema,
  updatedAt: z.date(),
});

export const OrderStateTransitionRecordSchema = z.object({
  changedAt: z.date(),
  fromStatus: OrderStatusSchema.nullable(),
  metadata: MetadataSchema,
  orderId: z.string().min(1).startsWith("ord_"),
  toStatus: OrderStatusSchema,
});

export const OrderPostPurchaseOperationRecordSchema = z.object({
  createdAt: z.date(),
  id: z.string().min(1),
  metadata: MetadataSchema,
  orderId: z.string().min(1).startsWith("ord_"),
  status: z.string().min(1),
  type: OrderPostPurchaseOperationTypeSchema,
  updatedAt: z.date(),
});

export const OrderAggregateSchema = z.object({
  lineItems: z.array(OrderLineItemRecordSchema).readonly(),
  operations: z.array(OrderPostPurchaseOperationRecordSchema).readonly(),
  order: OrderRecordSchema,
  stateTransitions: z.array(OrderStateTransitionRecordSchema).readonly(),
  transactions: z.array(OrderTransactionRecordSchema).readonly(),
});

export const CreateOrderLineItemInputSchema = z.object({
  itemSnapshot: OrderItemSnapshotSchema,
  metadata: MetadataSchema.optional(),
  quantity: z.number().int().positive(),
  taxTotal: z.number().int().nonnegative().optional(),
  title: z.string().min(1),
  total: z.number().int().nonnegative(),
  unitPrice: z.number().int().nonnegative(),
});

export const CreateOrderFromCheckoutInputSchema =
  OrderCoordinationMetadataSchema.extend({
    billingAddress: OrderAddressSnapshotSchema.nullable().optional(),
    cartId: z.string().min(1),
    customerId: z.string().min(1).optional(),
    email: z.string().email().optional(),
    fulfillmentReferences: z
      .array(OrderFulfillmentReferenceSchema)
      .readonly()
      .optional(),
    lineItems: z.array(CreateOrderLineItemInputSchema).min(1).readonly(),
    metadata: MetadataSchema.optional(),
    paymentReferences: z
      .array(OrderPaymentReferenceSchema)
      .readonly()
      .optional(),
    shippingAddress: OrderAddressSnapshotSchema.nullable().optional(),
    totals: OrderTotalsSnapshotSchema,
  });

export const TransitionOrderStatusInputSchema =
  OrderCoordinationMetadataSchema.extend({
    metadata: MetadataSchema.optional(),
    orderId: z.string().min(1).startsWith("ord_"),
    status: OrderStatusSchema,
  });

export const RecordOrderTransactionInputSchema =
  OrderCoordinationMetadataSchema.extend({
    amount: z.number().int(),
    currencyCode: z.string().min(3).max(3),
    metadata: MetadataSchema.optional(),
    orderId: z.string().min(1).startsWith("ord_"),
    referenceId: z.string().min(1).optional(),
    type: OrderTransactionTypeSchema,
  });

export const OrderIdentifierSchema = z.object({
  id: z.string().min(1).startsWith("ord_"),
});

const ApiDateFields = {
  completedAt: z.string().min(1).nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
} as const;

export const OrderApiRecordSchema = OrderRecordSchema.extend(ApiDateFields);
export const OrderLineItemApiRecordSchema = OrderLineItemRecordSchema.extend({
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});
export const OrderTransactionApiRecordSchema =
  OrderTransactionRecordSchema.extend({
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
  });
export const OrderStateTransitionApiRecordSchema =
  OrderStateTransitionRecordSchema.extend({
    changedAt: z.string().min(1),
  });
export const OrderPostPurchaseOperationApiRecordSchema =
  OrderPostPurchaseOperationRecordSchema.extend({
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
  });
export const OrderAggregateApiSchema = OrderAggregateSchema.extend({
  lineItems: z.array(OrderLineItemApiRecordSchema).readonly(),
  operations: z.array(OrderPostPurchaseOperationApiRecordSchema).readonly(),
  order: OrderApiRecordSchema,
  stateTransitions: z.array(OrderStateTransitionApiRecordSchema).readonly(),
  transactions: z.array(OrderTransactionApiRecordSchema).readonly(),
});
export const OrderApiListSchema = z.array(OrderApiRecordSchema).readonly();

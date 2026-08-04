import { Schema } from "effect";

export const CheckoutTrimmedStringSchema = Schema.Trimmed.pipe(
  Schema.check(Schema.isMinLength(1))
);

export const CheckoutMetadataSchema = Schema.Record(
  Schema.String,
  Schema.Unknown
);

export const CheckoutCartIdSchema = CheckoutTrimmedStringSchema.pipe(
  Schema.check(Schema.isStartsWith("cart_"))
);

export const CheckoutShippingOptionIdSchema = CheckoutTrimmedStringSchema.pipe(
  Schema.check(Schema.isStartsWith("shipopt_"))
);

export const CheckoutPaymentInputSchema = Schema.Struct({
  capture: Schema.optional(Schema.Boolean),
  paymentMethodId: Schema.optional(CheckoutTrimmedStringSchema),
  providerKey: CheckoutTrimmedStringSchema,
});

export const CompleteCheckoutInputSchema = Schema.Struct({
  cartId: CheckoutCartIdSchema,
  causationId: Schema.optional(CheckoutTrimmedStringSchema),
  correlationId: CheckoutTrimmedStringSchema,
  idempotencyKey: CheckoutTrimmedStringSchema,
  metadata: Schema.optional(CheckoutMetadataSchema),
  payment: CheckoutPaymentInputSchema,
  shippingOptionId: CheckoutShippingOptionIdSchema,
});

export const CheckoutCompletionStatusSchema = Schema.Literals([
  "completed",
  "duplicate",
]);

export const CheckoutCompletionResultSchema = Schema.Struct({
  cartId: CheckoutTrimmedStringSchema,
  fulfillmentIds: Schema.Array(CheckoutTrimmedStringSchema),
  orderId: CheckoutTrimmedStringSchema,
  paymentId: CheckoutTrimmedStringSchema,
  status: CheckoutCompletionStatusSchema,
  workflowRunId: CheckoutTrimmedStringSchema,
});

export type CompleteCheckoutInput = typeof CompleteCheckoutInputSchema.Type;
export type CheckoutCompletionResult =
  typeof CheckoutCompletionResultSchema.Type;

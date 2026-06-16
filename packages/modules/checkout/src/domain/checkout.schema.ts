import { z } from "zod";

const MetadataSchema = z.record(z.string(), z.unknown());

const CheckoutPaymentInputSchema = z.object({
  capture: z.boolean().optional(),
  paymentMethodId: z.string().min(1).optional(),
  providerKey: z.string().min(1),
});

export const CompleteCheckoutInputSchema = z.object({
  cartId: z.string().min(1).startsWith("cart_"),
  causationId: z.string().min(1).optional(),
  correlationId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  metadata: MetadataSchema.optional(),
  payment: CheckoutPaymentInputSchema,
  shippingOptionId: z.string().min(1).startsWith("shipopt_"),
});

export const CheckoutCompletionStatusSchema = z.enum([
  "completed",
  "duplicate",
]);

export const CheckoutCompletionResultSchema = z.object({
  cartId: z.string().min(1),
  fulfillmentIds: z.array(z.string().min(1)).readonly(),
  orderId: z.string().min(1),
  paymentId: z.string().min(1),
  status: CheckoutCompletionStatusSchema,
  workflowRunId: z.string().min(1),
});

export type CompleteCheckoutInput = z.infer<typeof CompleteCheckoutInputSchema>;
export type CheckoutCompletionResult = z.infer<
  typeof CheckoutCompletionResultSchema
>;

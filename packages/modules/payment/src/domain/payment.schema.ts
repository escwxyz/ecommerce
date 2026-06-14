import { z } from "zod";

export const PaymentMetadataSchema = z.record(z.string(), z.unknown());

export const PaymentMoneySchema = z.object({
  amount: z.number().int().nonnegative(),
  currencyCode: z
    .string()
    .min(3)
    .max(3)
    .transform((value) => value.toUpperCase()),
});

export const PaymentCollectionStatusSchema = z.enum([
  "pending",
  "authorized",
  "partially-captured",
  "captured",
  "partially-refunded",
  "refunded",
  "canceled",
  "failed",
]);

export const PaymentSessionStatusSchema = z.enum([
  "pending",
  "requires-action",
  "authorized",
  "captured",
  "canceled",
  "failed",
]);

export const PaymentStatusSchema = z.enum([
  "authorized",
  "captured",
  "partially-captured",
  "canceled",
  "failed",
]);

export const PaymentCaptureStatusSchema = z.enum([
  "pending",
  "succeeded",
  "failed",
]);
export const PaymentRefundStatusSchema = z.enum([
  "pending",
  "succeeded",
  "failed",
  "canceled",
]);

export const PaymentProviderRecordSchema = z.object({
  createdAt: z.date(),
  id: z.string().min(1).startsWith("payprov_"),
  isEnabled: z.boolean(),
  providerKey: z.string().min(1),
  providerRecordId: z.string().min(1),
  updatedAt: z.date(),
});

export const PaymentAccountHolderSchema = z.object({
  createdAt: z.date(),
  customerId: z.string().min(1),
  email: z.string().email().optional(),
  id: z.string().min(1).startsWith("payacct_"),
  metadata: PaymentMetadataSchema,
  providerAccountHolderId: z.string().min(1),
  providerKey: z.string().min(1),
  updatedAt: z.date(),
});

export const PaymentMethodSchema = z.object({
  accountHolderId: z.string().min(1).startsWith("payacct_").optional(),
  createdAt: z.date(),
  displayName: z.string().min(1).optional(),
  id: z.string().min(1).startsWith("paymtd_"),
  metadata: PaymentMetadataSchema,
  providerKey: z.string().min(1),
  providerPaymentMethodId: z.string().min(1),
  reusable: z.boolean(),
  type: z.string().min(1),
  updatedAt: z.date(),
});

export const PaymentCollectionSchema = z.object({
  amount: z.number().int().nonnegative(),
  cartId: z.string().min(1).optional(),
  createdAt: z.date(),
  currencyCode: z.string().min(3).max(3),
  id: z.string().min(1).startsWith("paycol_"),
  metadata: PaymentMetadataSchema,
  status: PaymentCollectionStatusSchema,
  updatedAt: z.date(),
});

export const CreatePaymentCollectionInputSchema = z.object({
  amount: z.number().int().nonnegative(),
  cartId: z.string().min(1).optional(),
  currencyCode: z.string().min(3).max(3),
  metadata: PaymentMetadataSchema.optional(),
});

export const PaymentSessionSchema = z.object({
  amount: z.number().int().nonnegative(),
  collectionId: z.string().min(1).startsWith("paycol_"),
  createdAt: z.date(),
  currencyCode: z.string().min(3).max(3),
  id: z.string().min(1).startsWith("payses_"),
  metadata: PaymentMetadataSchema,
  providerCheckoutSessionId: z.string().min(1).optional(),
  providerKey: z.string().min(1),
  providerPaymentIntentId: z.string().min(1).optional(),
  status: PaymentSessionStatusSchema,
  updatedAt: z.date(),
});

export const CreatePaymentSessionInputSchema = z.object({
  accountHolderId: z.string().min(1).startsWith("payacct_").optional(),
  cancelUrl: z.string().url().optional(),
  collectionId: z.string().min(1).startsWith("paycol_"),
  idempotencyKey: z.string().min(1),
  metadata: PaymentMetadataSchema.optional(),
  providerKey: z.string().min(1),
  successUrl: z.string().url().optional(),
});

export const PaymentSchema = z.object({
  amount: z.number().int().nonnegative(),
  collectionId: z.string().min(1).startsWith("paycol_"),
  createdAt: z.date(),
  currencyCode: z.string().min(3).max(3),
  id: z.string().min(1).startsWith("pay_"),
  metadata: PaymentMetadataSchema,
  providerKey: z.string().min(1),
  providerPaymentIntentId: z.string().min(1),
  sessionId: z.string().min(1).startsWith("payses_"),
  status: PaymentStatusSchema,
  updatedAt: z.date(),
});

export const AuthorizePaymentSessionInputSchema = z.object({
  idempotencyKey: z.string().min(1),
  paymentMethodId: z.string().min(1).startsWith("paymtd_").optional(),
  sessionId: z.string().min(1).startsWith("payses_"),
});

export const PaymentCaptureSchema = z.object({
  amount: z.number().int().nonnegative(),
  createdAt: z.date(),
  currencyCode: z.string().min(3).max(3),
  id: z.string().min(1).startsWith("paycap_"),
  idempotencyKey: z.string().min(1),
  paymentId: z.string().min(1).startsWith("pay_"),
  providerCaptureId: z.string().min(1).optional(),
  status: PaymentCaptureStatusSchema,
});

export const CapturePaymentInputSchema = z.object({
  amount: z.number().int().positive().optional(),
  idempotencyKey: z.string().min(1),
  paymentId: z.string().min(1).startsWith("pay_"),
});

export const PaymentRefundSchema = z.object({
  amount: z.number().int().nonnegative(),
  createdAt: z.date(),
  currencyCode: z.string().min(3).max(3),
  id: z.string().min(1).startsWith("payref_"),
  idempotencyKey: z.string().min(1),
  paymentId: z.string().min(1).startsWith("pay_"),
  providerRefundId: z.string().min(1),
  reason: z.string().min(1).optional(),
  status: PaymentRefundStatusSchema,
});

export const RefundPaymentInputSchema = z.object({
  amount: z.number().int().positive().optional(),
  idempotencyKey: z.string().min(1),
  paymentId: z.string().min(1).startsWith("pay_"),
  reason: z.string().min(1).optional(),
});

export const CreatePaymentAccountHolderInputSchema = z.object({
  customerId: z.string().min(1),
  email: z.string().email().optional(),
  metadata: PaymentMetadataSchema.optional(),
  name: z.string().min(1).optional(),
  providerKey: z.string().min(1),
});

export const AttachPaymentMethodInputSchema = z.object({
  accountHolderId: z.string().min(1).startsWith("payacct_"),
  providerPaymentMethodId: z.string().min(1),
});

const ApiDateFields = {
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
} as const;

export const PaymentProviderApiRecordSchema =
  PaymentProviderRecordSchema.extend(ApiDateFields);
export const PaymentAccountHolderApiSchema =
  PaymentAccountHolderSchema.extend(ApiDateFields);
export const PaymentMethodApiSchema = PaymentMethodSchema.extend(ApiDateFields);
export const PaymentCollectionApiSchema =
  PaymentCollectionSchema.extend(ApiDateFields);
export const PaymentSessionApiSchema =
  PaymentSessionSchema.extend(ApiDateFields);
export const PaymentApiSchema = PaymentSchema.extend(ApiDateFields);
export const PaymentCaptureApiSchema = PaymentCaptureSchema.extend({
  createdAt: z.string().min(1),
});
export const PaymentRefundApiSchema = PaymentRefundSchema.extend({
  createdAt: z.string().min(1),
});

export const PaymentCollectionDetailApiSchema =
  PaymentCollectionApiSchema.extend({
    payments: z.array(PaymentApiSchema).readonly(),
    sessions: z.array(PaymentSessionApiSchema).readonly(),
  });

export const PaymentListApiSchema = z
  .array(PaymentCollectionApiSchema)
  .readonly();

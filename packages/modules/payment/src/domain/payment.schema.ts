import { Schema } from "effect";

const isCanonicalIsoDateTime = (value: string): boolean => {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
};

const isEmailLike = (value: string): boolean => /\S+@\S+\.\S+/u.test(value);

const isUrlLike = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.href.length > 0;
  } catch {
    return false;
  }
};

const createPrefixedIdentifierSchema = (prefix: string, brand: string) =>
  Schema.NonEmptyString.pipe(
    Schema.check(Schema.isStartsWith(prefix)),
    Schema.brand(brand)
  );

const createSerializedIdentifierSchema = (prefix: string) =>
  Schema.NonEmptyString.pipe(Schema.check(Schema.isStartsWith(prefix)));

export const paymentProviderTableName = "payment_provider" as const;
export const paymentAccountHolderTableName = "payment_account_holder" as const;
export const paymentMethodTableName = "payment_method" as const;
export const paymentCollectionTableName = "payment_collection" as const;
export const paymentSessionTableName = "payment_session" as const;
export const paymentTableName = "payment" as const;
export const paymentCaptureTableName = "payment_capture" as const;
export const paymentRefundTableName = "payment_refund" as const;

export const PAYMENT_COLLECTION_ID_PREFIX = "paycol_" as const;
export const PAYMENT_SESSION_ID_PREFIX = "payses_" as const;
export const PAYMENT_ID_PREFIX = "pay_" as const;
export const PAYMENT_CAPTURE_ID_PREFIX = "paycap_" as const;
export const PAYMENT_REFUND_ID_PREFIX = "payref_" as const;
export const PAYMENT_ACCOUNT_HOLDER_ID_PREFIX = "payacct_" as const;
export const PAYMENT_METHOD_ID_PREFIX = "paymtd_" as const;
export const PAYMENT_PROVIDER_RECORD_ID_PREFIX = "payprov_" as const;

export const PaymentTrimmedStringSchema = Schema.Trimmed.pipe(
  Schema.check(Schema.isMinLength(1))
);

export const PaymentIsoDateTimeStringSchema = PaymentTrimmedStringSchema.pipe(
  Schema.check(Schema.makeFilter(isCanonicalIsoDateTime))
);

export const PaymentMetadataSchema = Schema.Record(
  Schema.String,
  Schema.Unknown
);

export const PaymentNonNegativeIntegerSchema = Schema.Number.pipe(
  Schema.check(Schema.isInt()),
  Schema.check(Schema.isGreaterThanOrEqualTo(0))
);

export const PaymentPositiveIntegerSchema = Schema.Number.pipe(
  Schema.check(Schema.isInt()),
  Schema.check(Schema.isGreaterThan(0))
);

export const PaymentCurrencyCodeSchema = PaymentTrimmedStringSchema.pipe(
  Schema.check(Schema.isMinLength(3)),
  Schema.check(Schema.isMaxLength(3))
);

export const PaymentEmailSchema = PaymentTrimmedStringSchema.pipe(
  Schema.check(Schema.makeFilter(isEmailLike))
);

export const PaymentUrlSchema = PaymentTrimmedStringSchema.pipe(
  Schema.check(Schema.makeFilter(isUrlLike))
);

export const PaymentCollectionIdSchema = createPrefixedIdentifierSchema(
  PAYMENT_COLLECTION_ID_PREFIX,
  "PaymentCollectionId"
);
export const PaymentCollectionSerializedIdSchema =
  createSerializedIdentifierSchema(PAYMENT_COLLECTION_ID_PREFIX);
export const PaymentSessionIdSchema = createPrefixedIdentifierSchema(
  PAYMENT_SESSION_ID_PREFIX,
  "PaymentSessionId"
);
export const PaymentSessionSerializedIdSchema =
  createSerializedIdentifierSchema(PAYMENT_SESSION_ID_PREFIX);
export const PaymentIdSchema = createPrefixedIdentifierSchema(
  PAYMENT_ID_PREFIX,
  "PaymentId"
);
export const PaymentSerializedIdSchema =
  createSerializedIdentifierSchema(PAYMENT_ID_PREFIX);
export const PaymentCaptureIdSchema = createPrefixedIdentifierSchema(
  PAYMENT_CAPTURE_ID_PREFIX,
  "PaymentCaptureId"
);
export const PaymentCaptureSerializedIdSchema =
  createSerializedIdentifierSchema(PAYMENT_CAPTURE_ID_PREFIX);
export const PaymentRefundIdSchema = createPrefixedIdentifierSchema(
  PAYMENT_REFUND_ID_PREFIX,
  "PaymentRefundId"
);
export const PaymentRefundSerializedIdSchema = createSerializedIdentifierSchema(
  PAYMENT_REFUND_ID_PREFIX
);
export const PaymentAccountHolderIdSchema = createPrefixedIdentifierSchema(
  PAYMENT_ACCOUNT_HOLDER_ID_PREFIX,
  "PaymentAccountHolderId"
);
export const PaymentAccountHolderSerializedIdSchema =
  createSerializedIdentifierSchema(PAYMENT_ACCOUNT_HOLDER_ID_PREFIX);
export const PaymentMethodIdSchema = createPrefixedIdentifierSchema(
  PAYMENT_METHOD_ID_PREFIX,
  "PaymentMethodId"
);
export const PaymentMethodSerializedIdSchema = createSerializedIdentifierSchema(
  PAYMENT_METHOD_ID_PREFIX
);
export const PaymentProviderRecordIdSchema = createPrefixedIdentifierSchema(
  PAYMENT_PROVIDER_RECORD_ID_PREFIX,
  "PaymentProviderRecordId"
);
export const PaymentProviderRecordSerializedIdSchema =
  createSerializedIdentifierSchema(PAYMENT_PROVIDER_RECORD_ID_PREFIX);

export const PaymentMoneySchema = Schema.Struct({
  amount: PaymentNonNegativeIntegerSchema,
  currencyCode: PaymentCurrencyCodeSchema,
});

export const PaymentCollectionStatusSchema = Schema.Literals([
  "pending",
  "authorized",
  "partially-captured",
  "captured",
  "partially-refunded",
  "refunded",
  "canceled",
  "failed",
]);

export const PaymentSessionStatusSchema = Schema.Literals([
  "pending",
  "requires-action",
  "authorized",
  "captured",
  "canceled",
  "failed",
]);

export const PaymentStatusSchema = Schema.Literals([
  "authorized",
  "captured",
  "partially-captured",
  "canceled",
  "failed",
]);

export const PaymentCaptureStatusSchema = Schema.Literals([
  "pending",
  "succeeded",
  "failed",
]);

export const PaymentRefundStatusSchema = Schema.Literals([
  "pending",
  "succeeded",
  "failed",
  "canceled",
]);

export const PaymentProviderRecordSchema = Schema.Struct({
  createdAt: Schema.Date,
  id: PaymentProviderRecordIdSchema,
  isEnabled: Schema.Boolean,
  providerKey: PaymentTrimmedStringSchema,
  providerRecordId: PaymentTrimmedStringSchema,
  updatedAt: Schema.Date,
});

export const PaymentAccountHolderSchema = Schema.Struct({
  createdAt: Schema.Date,
  customerId: PaymentTrimmedStringSchema,
  email: Schema.optional(PaymentEmailSchema),
  id: PaymentAccountHolderIdSchema,
  metadata: PaymentMetadataSchema,
  providerAccountHolderId: PaymentTrimmedStringSchema,
  providerKey: PaymentTrimmedStringSchema,
  updatedAt: Schema.Date,
});

export const PaymentMethodSchema = Schema.Struct({
  accountHolderId: Schema.optional(PaymentAccountHolderIdSchema),
  createdAt: Schema.Date,
  displayName: Schema.optional(PaymentTrimmedStringSchema),
  id: PaymentMethodIdSchema,
  metadata: PaymentMetadataSchema,
  providerKey: PaymentTrimmedStringSchema,
  providerPaymentMethodId: PaymentTrimmedStringSchema,
  reusable: Schema.Boolean,
  type: PaymentTrimmedStringSchema,
  updatedAt: Schema.Date,
});

export const PaymentCollectionSchema = Schema.Struct({
  amount: PaymentNonNegativeIntegerSchema,
  cartId: Schema.optional(PaymentTrimmedStringSchema),
  createdAt: Schema.Date,
  currencyCode: PaymentCurrencyCodeSchema,
  id: PaymentCollectionIdSchema,
  metadata: PaymentMetadataSchema,
  status: PaymentCollectionStatusSchema,
  updatedAt: Schema.Date,
});

export const CreatePaymentCollectionInputSchema = Schema.Struct({
  amount: PaymentNonNegativeIntegerSchema,
  cartId: Schema.optional(PaymentTrimmedStringSchema),
  currencyCode: PaymentCurrencyCodeSchema,
  metadata: Schema.optional(PaymentMetadataSchema),
});

export const PaymentSessionSchema = Schema.Struct({
  amount: PaymentNonNegativeIntegerSchema,
  collectionId: PaymentCollectionIdSchema,
  createdAt: Schema.Date,
  currencyCode: PaymentCurrencyCodeSchema,
  id: PaymentSessionIdSchema,
  metadata: PaymentMetadataSchema,
  providerCheckoutSessionId: Schema.optional(PaymentTrimmedStringSchema),
  providerKey: PaymentTrimmedStringSchema,
  providerPaymentIntentId: Schema.optional(PaymentTrimmedStringSchema),
  status: PaymentSessionStatusSchema,
  updatedAt: Schema.Date,
});

export const CreatePaymentSessionInputSchema = Schema.Struct({
  accountHolderId: Schema.optional(PaymentAccountHolderIdSchema),
  cancelUrl: Schema.optional(PaymentUrlSchema),
  collectionId: PaymentCollectionIdSchema,
  idempotencyKey: PaymentTrimmedStringSchema,
  metadata: Schema.optional(PaymentMetadataSchema),
  providerKey: PaymentTrimmedStringSchema,
  successUrl: Schema.optional(PaymentUrlSchema),
});

export const PaymentSchema = Schema.Struct({
  amount: PaymentNonNegativeIntegerSchema,
  collectionId: PaymentCollectionIdSchema,
  createdAt: Schema.Date,
  currencyCode: PaymentCurrencyCodeSchema,
  id: PaymentIdSchema,
  metadata: PaymentMetadataSchema,
  providerKey: PaymentTrimmedStringSchema,
  providerPaymentIntentId: PaymentTrimmedStringSchema,
  sessionId: PaymentSessionIdSchema,
  status: PaymentStatusSchema,
  updatedAt: Schema.Date,
});

export const AuthorizePaymentSessionInputSchema = Schema.Struct({
  idempotencyKey: PaymentTrimmedStringSchema,
  paymentMethodId: Schema.optional(PaymentMethodIdSchema),
  sessionId: PaymentSessionIdSchema,
});

export const PaymentCaptureSchema = Schema.Struct({
  amount: PaymentNonNegativeIntegerSchema,
  createdAt: Schema.Date,
  currencyCode: PaymentCurrencyCodeSchema,
  id: PaymentCaptureIdSchema,
  idempotencyKey: PaymentTrimmedStringSchema,
  paymentId: PaymentIdSchema,
  providerCaptureId: Schema.optional(PaymentTrimmedStringSchema),
  status: PaymentCaptureStatusSchema,
});

export const CapturePaymentInputSchema = Schema.Struct({
  amount: Schema.optional(PaymentPositiveIntegerSchema),
  idempotencyKey: PaymentTrimmedStringSchema,
  paymentId: PaymentIdSchema,
});

export const PaymentRefundSchema = Schema.Struct({
  amount: PaymentNonNegativeIntegerSchema,
  createdAt: Schema.Date,
  currencyCode: PaymentCurrencyCodeSchema,
  id: PaymentRefundIdSchema,
  idempotencyKey: PaymentTrimmedStringSchema,
  paymentId: PaymentIdSchema,
  providerRefundId: PaymentTrimmedStringSchema,
  reason: Schema.optional(PaymentTrimmedStringSchema),
  status: PaymentRefundStatusSchema,
});

export const RefundPaymentInputSchema = Schema.Struct({
  amount: Schema.optional(PaymentPositiveIntegerSchema),
  idempotencyKey: PaymentTrimmedStringSchema,
  paymentId: PaymentIdSchema,
  reason: Schema.optional(PaymentTrimmedStringSchema),
});

export const CreatePaymentAccountHolderInputSchema = Schema.Struct({
  customerId: PaymentTrimmedStringSchema,
  email: Schema.optional(PaymentEmailSchema),
  metadata: Schema.optional(PaymentMetadataSchema),
  name: Schema.optional(PaymentTrimmedStringSchema),
  providerKey: PaymentTrimmedStringSchema,
});

export const AttachPaymentMethodInputSchema = Schema.Struct({
  accountHolderId: PaymentAccountHolderIdSchema,
  providerPaymentMethodId: PaymentTrimmedStringSchema,
});

export const PaymentProviderApiRecordSchema = Schema.Struct({
  createdAt: PaymentIsoDateTimeStringSchema,
  id: PaymentProviderRecordSerializedIdSchema,
  isEnabled: Schema.Boolean,
  providerKey: PaymentTrimmedStringSchema,
  providerRecordId: PaymentTrimmedStringSchema,
  updatedAt: PaymentIsoDateTimeStringSchema,
});

export const PaymentAccountHolderApiSchema = Schema.Struct({
  createdAt: PaymentIsoDateTimeStringSchema,
  customerId: PaymentTrimmedStringSchema,
  email: Schema.optional(PaymentEmailSchema),
  id: PaymentAccountHolderSerializedIdSchema,
  metadata: PaymentMetadataSchema,
  providerAccountHolderId: PaymentTrimmedStringSchema,
  providerKey: PaymentTrimmedStringSchema,
  updatedAt: PaymentIsoDateTimeStringSchema,
});

export const PaymentMethodApiSchema = Schema.Struct({
  accountHolderId: Schema.optional(PaymentAccountHolderSerializedIdSchema),
  createdAt: PaymentIsoDateTimeStringSchema,
  displayName: Schema.optional(PaymentTrimmedStringSchema),
  id: PaymentMethodSerializedIdSchema,
  metadata: PaymentMetadataSchema,
  providerKey: PaymentTrimmedStringSchema,
  providerPaymentMethodId: PaymentTrimmedStringSchema,
  reusable: Schema.Boolean,
  type: PaymentTrimmedStringSchema,
  updatedAt: PaymentIsoDateTimeStringSchema,
});

export const PaymentCollectionApiSchema = Schema.Struct({
  amount: PaymentNonNegativeIntegerSchema,
  cartId: Schema.optional(PaymentTrimmedStringSchema),
  createdAt: PaymentIsoDateTimeStringSchema,
  currencyCode: PaymentCurrencyCodeSchema,
  id: PaymentCollectionSerializedIdSchema,
  metadata: PaymentMetadataSchema,
  status: PaymentCollectionStatusSchema,
  updatedAt: PaymentIsoDateTimeStringSchema,
});

export const PaymentSessionApiSchema = Schema.Struct({
  amount: PaymentNonNegativeIntegerSchema,
  collectionId: PaymentCollectionSerializedIdSchema,
  createdAt: PaymentIsoDateTimeStringSchema,
  currencyCode: PaymentCurrencyCodeSchema,
  id: PaymentSessionSerializedIdSchema,
  metadata: PaymentMetadataSchema,
  providerCheckoutSessionId: Schema.optional(PaymentTrimmedStringSchema),
  providerKey: PaymentTrimmedStringSchema,
  providerPaymentIntentId: Schema.optional(PaymentTrimmedStringSchema),
  status: PaymentSessionStatusSchema,
  updatedAt: PaymentIsoDateTimeStringSchema,
});

export const PaymentApiSchema = Schema.Struct({
  amount: PaymentNonNegativeIntegerSchema,
  collectionId: PaymentCollectionSerializedIdSchema,
  createdAt: PaymentIsoDateTimeStringSchema,
  currencyCode: PaymentCurrencyCodeSchema,
  id: PaymentSerializedIdSchema,
  metadata: PaymentMetadataSchema,
  providerKey: PaymentTrimmedStringSchema,
  providerPaymentIntentId: PaymentTrimmedStringSchema,
  sessionId: PaymentSessionSerializedIdSchema,
  status: PaymentStatusSchema,
  updatedAt: PaymentIsoDateTimeStringSchema,
});

export const PaymentCaptureApiSchema = Schema.Struct({
  amount: PaymentNonNegativeIntegerSchema,
  createdAt: PaymentIsoDateTimeStringSchema,
  currencyCode: PaymentCurrencyCodeSchema,
  id: PaymentCaptureSerializedIdSchema,
  idempotencyKey: PaymentTrimmedStringSchema,
  paymentId: PaymentSerializedIdSchema,
  providerCaptureId: Schema.optional(PaymentTrimmedStringSchema),
  status: PaymentCaptureStatusSchema,
});

export const PaymentRefundApiSchema = Schema.Struct({
  amount: PaymentNonNegativeIntegerSchema,
  createdAt: PaymentIsoDateTimeStringSchema,
  currencyCode: PaymentCurrencyCodeSchema,
  id: PaymentRefundSerializedIdSchema,
  idempotencyKey: PaymentTrimmedStringSchema,
  paymentId: PaymentSerializedIdSchema,
  providerRefundId: PaymentTrimmedStringSchema,
  reason: Schema.optional(PaymentTrimmedStringSchema),
  status: PaymentRefundStatusSchema,
});

export const PaymentCollectionDetailApiSchema = Schema.Struct({
  amount: PaymentNonNegativeIntegerSchema,
  cartId: Schema.optional(PaymentTrimmedStringSchema),
  createdAt: PaymentIsoDateTimeStringSchema,
  currencyCode: PaymentCurrencyCodeSchema,
  id: PaymentCollectionSerializedIdSchema,
  metadata: PaymentMetadataSchema,
  payments: Schema.Array(PaymentApiSchema),
  sessions: Schema.Array(PaymentSessionApiSchema),
  status: PaymentCollectionStatusSchema,
  updatedAt: PaymentIsoDateTimeStringSchema,
});

export const PaymentListApiSchema = Schema.Array(PaymentCollectionApiSchema);

export const PaymentCollectionIdentifierSchema = Schema.Struct({
  id: PaymentCollectionIdSchema,
});

export const PaymentProviderIdentifierSchema = Schema.Struct({
  providerKey: PaymentTrimmedStringSchema,
});

export const PaymentWebhookInputSchema = Schema.Struct({
  headers: Schema.Record(Schema.String, Schema.String),
  payload: PaymentTrimmedStringSchema,
  providerKey: PaymentTrimmedStringSchema,
});

export const PaymentWebhookActionSchema = Schema.Union([
  Schema.Struct({
    idempotencyKey: Schema.optional(PaymentTrimmedStringSchema),
    paymentIntentId: PaymentTrimmedStringSchema,
    providerKey: PaymentTrimmedStringSchema,
    type: Schema.Literals([
      "payment.authorized",
      "payment.captured",
      "payment.failed",
    ]),
  }),
  Schema.Struct({
    idempotencyKey: Schema.optional(PaymentTrimmedStringSchema),
    paymentIntentId: PaymentTrimmedStringSchema,
    providerKey: PaymentTrimmedStringSchema,
    refundId: PaymentTrimmedStringSchema,
    type: Schema.Literal("refund.succeeded"),
  }),
  Schema.Struct({
    checkoutSessionId: PaymentTrimmedStringSchema,
    idempotencyKey: Schema.optional(PaymentTrimmedStringSchema),
    paymentIntentId: Schema.optional(PaymentTrimmedStringSchema),
    providerKey: PaymentTrimmedStringSchema,
    type: Schema.Literal("checkout.completed"),
  }),
  Schema.Struct({
    idempotencyKey: Schema.optional(PaymentTrimmedStringSchema),
    providerKey: PaymentTrimmedStringSchema,
    type: Schema.Literal("ignored"),
  }),
]);

export const PaymentWebhookActionResultSchema = Schema.Struct({
  actions: Schema.Array(PaymentWebhookActionSchema),
});

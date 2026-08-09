import { Context } from "effect";
import type { Effect as EffectValue } from "effect/Effect";

import type { PaymentExpectedError } from "./payment.errors";
import type {
  AttachPaymentMethodInputSchema,
  AuthorizePaymentSessionInputSchema,
  CancelPaymentInputSchema,
  CapturePaymentInputSchema,
  CreatePaymentAccountHolderInputSchema,
  CreatePaymentCollectionInputSchema,
  CreatePaymentSessionInputSchema,
  PaymentAccountHolderApiSchema,
  PaymentAccountHolderIdSchema,
  PaymentAccountHolderSchema,
  PaymentApiSchema,
  PaymentCaptureApiSchema,
  PaymentCaptureIdSchema,
  PaymentCaptureSchema,
  PaymentCollectionApiSchema,
  PaymentCollectionDetailApiSchema,
  PaymentCollectionIdSchema,
  PaymentCollectionSchema,
  PaymentCollectionStatusSchema,
  PaymentIdSchema,
  PaymentListApiSchema,
  PaymentMethodApiSchema,
  PaymentMethodIdSchema,
  PaymentMethodSchema,
  PaymentMoneySchema,
  PaymentProviderApiRecordSchema,
  PaymentProviderRecordIdSchema,
  PaymentProviderRecordSchema,
  PaymentRefundApiSchema,
  PaymentRefundIdSchema,
  PaymentRefundSchema,
  PaymentSchema,
  PaymentSessionApiSchema,
  PaymentSessionIdSchema,
  PaymentSessionSchema,
  PaymentSessionStatusSchema,
  PaymentStatusSchema,
  PaymentWebhookActionResultSchema,
  PaymentWebhookActionSchema,
  PaymentWebhookInputSchema,
  RefundPaymentInputSchema,
} from "./payment.schema";

export type PaymentCollectionId = typeof PaymentCollectionIdSchema.Type;
export type PaymentSessionId = typeof PaymentSessionIdSchema.Type;
export type PaymentId = typeof PaymentIdSchema.Type;
export type PaymentCaptureId = typeof PaymentCaptureIdSchema.Type;
export type PaymentRefundId = typeof PaymentRefundIdSchema.Type;
export type PaymentAccountHolderId = typeof PaymentAccountHolderIdSchema.Type;
export type PaymentMethodId = typeof PaymentMethodIdSchema.Type;
export type PaymentProviderRecordId = typeof PaymentProviderRecordIdSchema.Type;

export type PaymentMoney = typeof PaymentMoneySchema.Type;
export type PaymentCollectionStatus = typeof PaymentCollectionStatusSchema.Type;
export type PaymentSessionStatus = typeof PaymentSessionStatusSchema.Type;
export type PaymentStatus = typeof PaymentStatusSchema.Type;
export type CreatePaymentCollectionInput =
  typeof CreatePaymentCollectionInputSchema.Type;
export type CreatePaymentSessionInput =
  typeof CreatePaymentSessionInputSchema.Type;
export type AuthorizePaymentSessionInput =
  typeof AuthorizePaymentSessionInputSchema.Type;
export type CancelPaymentInput = typeof CancelPaymentInputSchema.Type;
export type CapturePaymentInput = typeof CapturePaymentInputSchema.Type;
export type RefundPaymentInput = typeof RefundPaymentInputSchema.Type;
export type CreatePaymentAccountHolderInput =
  typeof CreatePaymentAccountHolderInputSchema.Type;
export type AttachPaymentMethodInput =
  typeof AttachPaymentMethodInputSchema.Type;

export type PaymentProviderRecord = typeof PaymentProviderRecordSchema.Type;
export type PaymentAccountHolder = typeof PaymentAccountHolderSchema.Type;
export type PaymentMethod = typeof PaymentMethodSchema.Type;
export type PaymentCollection = typeof PaymentCollectionSchema.Type;
export type PaymentSession = typeof PaymentSessionSchema.Type;
export type Payment = typeof PaymentSchema.Type;
export type PaymentCapture = typeof PaymentCaptureSchema.Type;
export type PaymentRefund = typeof PaymentRefundSchema.Type;

export type PaymentProviderApiRecord =
  typeof PaymentProviderApiRecordSchema.Type;
export type PaymentAccountHolderApiRecord =
  typeof PaymentAccountHolderApiSchema.Type;
export type PaymentMethodApiRecord = typeof PaymentMethodApiSchema.Type;
export type PaymentCollectionApiRecord = typeof PaymentCollectionApiSchema.Type;
export type PaymentSessionApiRecord = typeof PaymentSessionApiSchema.Type;
export type PaymentApiRecord = typeof PaymentApiSchema.Type;
export type PaymentCaptureApiRecord = typeof PaymentCaptureApiSchema.Type;
export type PaymentRefundApiRecord = typeof PaymentRefundApiSchema.Type;
export type PaymentCollectionDetailApiRecord =
  typeof PaymentCollectionDetailApiSchema.Type;
export type PaymentListApiRecord = typeof PaymentListApiSchema.Type;
export type PaymentWebhookInput = typeof PaymentWebhookInputSchema.Type;
export type PaymentWebhookAction = typeof PaymentWebhookActionSchema.Type;
export type PaymentWebhookActionResult =
  typeof PaymentWebhookActionResultSchema.Type;

export interface PaymentCollectionDetail {
  readonly collection: PaymentCollection;
  readonly payments: readonly Payment[];
  readonly sessions: readonly PaymentSession[];
}

export interface PaymentRepository {
  readonly findAccountHolderById: (
    id: PaymentAccountHolderId
  ) => EffectValue<PaymentAccountHolder | null, PaymentExpectedError>;
  readonly findAccountHolderByProviderId: (input: {
    readonly providerAccountHolderId: string;
    readonly providerKey: string;
  }) => EffectValue<PaymentAccountHolder | null, PaymentExpectedError>;
  readonly findCaptureByIdempotencyKey: (
    idempotencyKey: string
  ) => EffectValue<PaymentCapture | null, PaymentExpectedError>;
  readonly findCollectionById: (
    id: PaymentCollectionId
  ) => EffectValue<PaymentCollection | null, PaymentExpectedError>;
  readonly findMethodById: (
    id: PaymentMethodId
  ) => EffectValue<PaymentMethod | null, PaymentExpectedError>;
  readonly findPaymentById: (
    id: PaymentId
  ) => EffectValue<Payment | null, PaymentExpectedError>;
  readonly findPaymentByProviderIntent: (input: {
    readonly providerKey: string;
    readonly providerPaymentIntentId: string;
  }) => EffectValue<Payment | null, PaymentExpectedError>;
  readonly findRefundByIdempotencyKey: (
    idempotencyKey: string
  ) => EffectValue<PaymentRefund | null, PaymentExpectedError>;
  readonly findSessionById: (
    id: PaymentSessionId
  ) => EffectValue<PaymentSession | null, PaymentExpectedError>;
  readonly findSessionByProviderIntent: (input: {
    readonly providerKey: string;
    readonly providerPaymentIntentId: string;
  }) => EffectValue<PaymentSession | null, PaymentExpectedError>;
  readonly listCollections: EffectValue<
    readonly PaymentCollection[],
    PaymentExpectedError
  >;
  readonly listPaymentsForCollection: (
    collectionId: PaymentCollectionId
  ) => EffectValue<readonly Payment[], PaymentExpectedError>;
  readonly listSessionsForCollection: (
    collectionId: PaymentCollectionId
  ) => EffectValue<readonly PaymentSession[], PaymentExpectedError>;
  readonly saveAccountHolder: (
    accountHolder: PaymentAccountHolder
  ) => EffectValue<PaymentAccountHolder, PaymentExpectedError>;
  readonly saveCapture: (
    capture: PaymentCapture
  ) => EffectValue<PaymentCapture, PaymentExpectedError>;
  readonly saveCollection: (
    collection: PaymentCollection
  ) => EffectValue<PaymentCollection, PaymentExpectedError>;
  readonly saveMethod: (
    method: PaymentMethod
  ) => EffectValue<PaymentMethod, PaymentExpectedError>;
  readonly savePayment: (
    payment: Payment
  ) => EffectValue<Payment, PaymentExpectedError>;
  readonly saveProviderRecord: (
    providerRecord: PaymentProviderRecord
  ) => EffectValue<PaymentProviderRecord, PaymentExpectedError>;
  readonly saveRefund: (
    refund: PaymentRefund
  ) => EffectValue<PaymentRefund, PaymentExpectedError>;
  readonly saveSession: (
    session: PaymentSession
  ) => EffectValue<PaymentSession, PaymentExpectedError>;
}

/** Effect-native payment repository contract consumed by payment services. */
export const PaymentRepositoryService = Context.Service<PaymentRepository>(
  "@ecommerce/payment/PaymentRepositoryService"
);

import type { Brand } from "@ecommerce/core/brand";
import type { z } from "zod";

import type {
  AttachPaymentMethodInputSchema,
  AuthorizePaymentSessionInputSchema,
  CapturePaymentInputSchema,
  CreatePaymentAccountHolderInputSchema,
  CreatePaymentCollectionInputSchema,
  CreatePaymentSessionInputSchema,
  PaymentAccountHolderApiSchema,
  PaymentAccountHolderSchema,
  PaymentApiSchema,
  PaymentCaptureApiSchema,
  PaymentCaptureSchema,
  PaymentCollectionApiSchema,
  PaymentCollectionDetailApiSchema,
  PaymentCollectionSchema,
  PaymentCollectionStatusSchema,
  PaymentListApiSchema,
  PaymentMethodApiSchema,
  PaymentMethodSchema,
  PaymentProviderApiRecordSchema,
  PaymentProviderRecordSchema,
  PaymentRefundApiSchema,
  PaymentRefundSchema,
  PaymentSchema,
  PaymentSessionApiSchema,
  PaymentSessionSchema,
  PaymentSessionStatusSchema,
  PaymentStatusSchema,
  RefundPaymentInputSchema,
} from "./payment.schema";

export type PaymentCollectionId = Brand<string, "payment-collection">;
export type PaymentSessionId = Brand<string, "payment-session">;
export type PaymentId = Brand<string, "payment">;
export type PaymentCaptureId = Brand<string, "payment-capture">;
export type PaymentRefundId = Brand<string, "payment-refund">;
export type PaymentAccountHolderId = Brand<string, "payment-account-holder">;
export type PaymentMethodId = Brand<string, "payment-method">;
export type PaymentProviderRecordId = Brand<string, "payment-provider-record">;

export type PaymentCollectionStatus = z.infer<
  typeof PaymentCollectionStatusSchema
>;
export type PaymentSessionStatus = z.infer<typeof PaymentSessionStatusSchema>;
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;
export type CreatePaymentCollectionInput = z.infer<
  typeof CreatePaymentCollectionInputSchema
>;
export type CreatePaymentSessionInput = z.infer<
  typeof CreatePaymentSessionInputSchema
>;
export type AuthorizePaymentSessionInput = z.infer<
  typeof AuthorizePaymentSessionInputSchema
>;
export type CapturePaymentInput = z.infer<typeof CapturePaymentInputSchema>;
export type RefundPaymentInput = z.infer<typeof RefundPaymentInputSchema>;
export type CreatePaymentAccountHolderInput = z.infer<
  typeof CreatePaymentAccountHolderInputSchema
>;
export type AttachPaymentMethodInput = z.infer<
  typeof AttachPaymentMethodInputSchema
>;

export type PaymentProviderRecord = Omit<
  z.infer<typeof PaymentProviderRecordSchema>,
  "id"
> & { readonly id: PaymentProviderRecordId };
export type PaymentAccountHolder = Omit<
  z.infer<typeof PaymentAccountHolderSchema>,
  "id"
> & { readonly id: PaymentAccountHolderId };
export type PaymentMethod = Omit<
  z.infer<typeof PaymentMethodSchema>,
  "accountHolderId" | "id"
> & {
  readonly accountHolderId?: PaymentAccountHolderId;
  readonly id: PaymentMethodId;
};
export type PaymentCollection = Omit<
  z.infer<typeof PaymentCollectionSchema>,
  "id"
> & { readonly id: PaymentCollectionId };
export type PaymentSession = Omit<
  z.infer<typeof PaymentSessionSchema>,
  "collectionId" | "id"
> & {
  readonly collectionId: PaymentCollectionId;
  readonly id: PaymentSessionId;
};
export type Payment = Omit<
  z.infer<typeof PaymentSchema>,
  "collectionId" | "id" | "sessionId"
> & {
  readonly collectionId: PaymentCollectionId;
  readonly id: PaymentId;
  readonly sessionId: PaymentSessionId;
};
export type PaymentCapture = Omit<
  z.infer<typeof PaymentCaptureSchema>,
  "id" | "paymentId"
> & {
  readonly id: PaymentCaptureId;
  readonly paymentId: PaymentId;
};
export type PaymentRefund = Omit<
  z.infer<typeof PaymentRefundSchema>,
  "id" | "paymentId"
> & {
  readonly id: PaymentRefundId;
  readonly paymentId: PaymentId;
};

export type PaymentProviderApiRecord = z.infer<
  typeof PaymentProviderApiRecordSchema
>;
export type PaymentAccountHolderApiRecord = z.infer<
  typeof PaymentAccountHolderApiSchema
>;
export type PaymentMethodApiRecord = z.infer<typeof PaymentMethodApiSchema>;
export type PaymentCollectionApiRecord = z.infer<
  typeof PaymentCollectionApiSchema
>;
export type PaymentSessionApiRecord = z.infer<typeof PaymentSessionApiSchema>;
export type PaymentApiRecord = z.infer<typeof PaymentApiSchema>;
export type PaymentCaptureApiRecord = z.infer<typeof PaymentCaptureApiSchema>;
export type PaymentRefundApiRecord = z.infer<typeof PaymentRefundApiSchema>;
export type PaymentCollectionDetailApiRecord = z.infer<
  typeof PaymentCollectionDetailApiSchema
>;
export type PaymentListApiRecord = z.infer<typeof PaymentListApiSchema>;

export interface PaymentCollectionDetail {
  readonly collection: PaymentCollection;
  readonly payments: readonly Payment[];
  readonly sessions: readonly PaymentSession[];
}

export interface PaymentRepository {
  findAccountHolderById(
    id: PaymentAccountHolderId
  ): Promise<PaymentAccountHolder | null>;
  findAccountHolderByProviderId(input: {
    readonly providerAccountHolderId: string;
    readonly providerKey: string;
  }): Promise<PaymentAccountHolder | null>;
  findCaptureByIdempotencyKey(
    idempotencyKey: string
  ): Promise<PaymentCapture | null>;
  findCollectionById(
    id: PaymentCollectionId
  ): Promise<PaymentCollection | null>;
  findMethodById(id: PaymentMethodId): Promise<PaymentMethod | null>;
  findPaymentById(id: PaymentId): Promise<Payment | null>;
  findPaymentByProviderIntent(input: {
    readonly providerKey: string;
    readonly providerPaymentIntentId: string;
  }): Promise<Payment | null>;
  findRefundByIdempotencyKey(
    idempotencyKey: string
  ): Promise<PaymentRefund | null>;
  findSessionById(id: PaymentSessionId): Promise<PaymentSession | null>;
  findSessionByProviderIntent(input: {
    readonly providerKey: string;
    readonly providerPaymentIntentId: string;
  }): Promise<PaymentSession | null>;
  listCollections(): Promise<readonly PaymentCollection[]>;
  listPaymentsForCollection(
    collectionId: PaymentCollectionId
  ): Promise<readonly Payment[]>;
  listSessionsForCollection(
    collectionId: PaymentCollectionId
  ): Promise<readonly PaymentSession[]>;
  saveAccountHolder(
    accountHolder: PaymentAccountHolder
  ): Promise<PaymentAccountHolder>;
  saveCapture(capture: PaymentCapture): Promise<PaymentCapture>;
  saveCollection(collection: PaymentCollection): Promise<PaymentCollection>;
  saveMethod(method: PaymentMethod): Promise<PaymentMethod>;
  savePayment(payment: Payment): Promise<Payment>;
  saveProviderRecord(
    providerRecord: PaymentProviderRecord
  ): Promise<PaymentProviderRecord>;
  saveRefund(refund: PaymentRefund): Promise<PaymentRefund>;
  saveSession(session: PaymentSession): Promise<PaymentSession>;
}

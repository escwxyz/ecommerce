import { Effect } from "effect";

import { PaymentInvalidIdentifier } from "./payment.errors";
import {
  PAYMENT_ACCOUNT_HOLDER_ID_PREFIX,
  PAYMENT_CAPTURE_ID_PREFIX,
  PAYMENT_COLLECTION_ID_PREFIX,
  PAYMENT_ID_PREFIX,
  PAYMENT_METHOD_ID_PREFIX,
  PAYMENT_PROVIDER_RECORD_ID_PREFIX,
  PAYMENT_REFUND_ID_PREFIX,
  PAYMENT_SESSION_ID_PREFIX,
} from "./payment.schema";
import type {
  PaymentAccountHolderId,
  PaymentCaptureId,
  PaymentCollectionId,
  PaymentId,
  PaymentMethodId,
  PaymentProviderRecordId,
  PaymentRefundId,
  PaymentSessionId,
} from "./payment.types";

const assertPrefixedId = (
  value: string,
  prefix: string,
  label: string
): void => {
  if (!value.startsWith(prefix)) {
    throw new Error(`${label} must start with "${prefix}".`);
  }
};

const createPrefixedIdEffect = <TId extends string>(
  value: string,
  prefix: string
): Effect.Effect<TId, PaymentInvalidIdentifier> =>
  value.startsWith(prefix)
    ? Effect.succeed(value as TId)
    : Effect.fail(
        new PaymentInvalidIdentifier({ expectedPrefix: prefix, value })
      );

export const createPaymentCollectionId = (
  value: string
): PaymentCollectionId => {
  assertPrefixedId(
    value,
    PAYMENT_COLLECTION_ID_PREFIX,
    "Payment collection ID"
  );
  return value as PaymentCollectionId;
};

export const createPaymentCollectionIdEffect = (value: string) =>
  createPrefixedIdEffect<PaymentCollectionId>(
    value,
    PAYMENT_COLLECTION_ID_PREFIX
  );

export const createPaymentSessionId = (value: string): PaymentSessionId => {
  assertPrefixedId(value, PAYMENT_SESSION_ID_PREFIX, "Payment session ID");
  return value as PaymentSessionId;
};

export const createPaymentSessionIdEffect = (value: string) =>
  createPrefixedIdEffect<PaymentSessionId>(value, PAYMENT_SESSION_ID_PREFIX);

export const createPaymentId = (value: string): PaymentId => {
  assertPrefixedId(value, PAYMENT_ID_PREFIX, "Payment ID");
  return value as PaymentId;
};

export const createPaymentIdEffect = (value: string) =>
  createPrefixedIdEffect<PaymentId>(value, PAYMENT_ID_PREFIX);

export const createPaymentCaptureId = (value: string): PaymentCaptureId => {
  assertPrefixedId(value, PAYMENT_CAPTURE_ID_PREFIX, "Payment capture ID");
  return value as PaymentCaptureId;
};

export const createPaymentCaptureIdEffect = (value: string) =>
  createPrefixedIdEffect<PaymentCaptureId>(value, PAYMENT_CAPTURE_ID_PREFIX);

export const createPaymentRefundId = (value: string): PaymentRefundId => {
  assertPrefixedId(value, PAYMENT_REFUND_ID_PREFIX, "Payment refund ID");
  return value as PaymentRefundId;
};

export const createPaymentRefundIdEffect = (value: string) =>
  createPrefixedIdEffect<PaymentRefundId>(value, PAYMENT_REFUND_ID_PREFIX);

export const createPaymentAccountHolderId = (
  value: string
): PaymentAccountHolderId => {
  assertPrefixedId(
    value,
    PAYMENT_ACCOUNT_HOLDER_ID_PREFIX,
    "Payment account holder ID"
  );
  return value as PaymentAccountHolderId;
};

export const createPaymentAccountHolderIdEffect = (value: string) =>
  createPrefixedIdEffect<PaymentAccountHolderId>(
    value,
    PAYMENT_ACCOUNT_HOLDER_ID_PREFIX
  );

export const createPaymentMethodId = (value: string): PaymentMethodId => {
  assertPrefixedId(value, PAYMENT_METHOD_ID_PREFIX, "Payment method ID");
  return value as PaymentMethodId;
};

export const createPaymentMethodIdEffect = (value: string) =>
  createPrefixedIdEffect<PaymentMethodId>(value, PAYMENT_METHOD_ID_PREFIX);

export const createPaymentProviderRecordId = (
  value: string
): PaymentProviderRecordId => {
  assertPrefixedId(
    value,
    PAYMENT_PROVIDER_RECORD_ID_PREFIX,
    "Payment provider record ID"
  );
  return value as PaymentProviderRecordId;
};

export const createPaymentProviderRecordIdEffect = (value: string) =>
  createPrefixedIdEffect<PaymentProviderRecordId>(
    value,
    PAYMENT_PROVIDER_RECORD_ID_PREFIX
  );

export const serializePaymentCollectionId = (id: PaymentCollectionId): string =>
  id;
export const serializePaymentSessionId = (id: PaymentSessionId): string => id;
export const serializePaymentId = (id: PaymentId): string => id;
export const serializePaymentCaptureId = (id: PaymentCaptureId): string => id;
export const serializePaymentRefundId = (id: PaymentRefundId): string => id;
export const serializePaymentAccountHolderId = (
  id: PaymentAccountHolderId
): string => id;
export const serializePaymentMethodId = (id: PaymentMethodId): string => id;
export const serializePaymentProviderRecordId = (
  id: PaymentProviderRecordId
): string => id;

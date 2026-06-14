import { brand } from "@ecommerce/core/brand";

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

export const PAYMENT_COLLECTION_ID_PREFIX = "paycol_" as const;
export const PAYMENT_SESSION_ID_PREFIX = "payses_" as const;
export const PAYMENT_ID_PREFIX = "pay_" as const;
export const PAYMENT_CAPTURE_ID_PREFIX = "paycap_" as const;
export const PAYMENT_REFUND_ID_PREFIX = "payref_" as const;
export const PAYMENT_ACCOUNT_HOLDER_ID_PREFIX = "payacct_" as const;
export const PAYMENT_METHOD_ID_PREFIX = "paymtd_" as const;
export const PAYMENT_PROVIDER_RECORD_ID_PREFIX = "payprov_" as const;

const assertPrefixedId = (
  value: string,
  prefix: string,
  label: string
): void => {
  if (!value.startsWith(prefix)) {
    throw new Error(`${label} must start with "${prefix}".`);
  }
};

export const createPaymentCollectionId = (
  value: string
): PaymentCollectionId => {
  assertPrefixedId(
    value,
    PAYMENT_COLLECTION_ID_PREFIX,
    "Payment collection ID"
  );
  return brand<"payment-collection", string>(value);
};

export const createPaymentSessionId = (value: string): PaymentSessionId => {
  assertPrefixedId(value, PAYMENT_SESSION_ID_PREFIX, "Payment session ID");
  return brand<"payment-session", string>(value);
};

export const createPaymentId = (value: string): PaymentId => {
  assertPrefixedId(value, PAYMENT_ID_PREFIX, "Payment ID");
  return brand<"payment", string>(value);
};

export const createPaymentCaptureId = (value: string): PaymentCaptureId => {
  assertPrefixedId(value, PAYMENT_CAPTURE_ID_PREFIX, "Payment capture ID");
  return brand<"payment-capture", string>(value);
};

export const createPaymentRefundId = (value: string): PaymentRefundId => {
  assertPrefixedId(value, PAYMENT_REFUND_ID_PREFIX, "Payment refund ID");
  return brand<"payment-refund", string>(value);
};

export const createPaymentAccountHolderId = (
  value: string
): PaymentAccountHolderId => {
  assertPrefixedId(
    value,
    PAYMENT_ACCOUNT_HOLDER_ID_PREFIX,
    "Payment account holder ID"
  );
  return brand<"payment-account-holder", string>(value);
};

export const createPaymentMethodId = (value: string): PaymentMethodId => {
  assertPrefixedId(value, PAYMENT_METHOD_ID_PREFIX, "Payment method ID");
  return brand<"payment-method", string>(value);
};

export const createPaymentProviderRecordId = (
  value: string
): PaymentProviderRecordId => {
  assertPrefixedId(
    value,
    PAYMENT_PROVIDER_RECORD_ID_PREFIX,
    "Payment provider record ID"
  );
  return brand<"payment-provider-record", string>(value);
};

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

import type { Insertable, Kysely } from "kysely";

import type {
  Payment,
  PaymentAccountHolder,
  PaymentAccountHolderId,
  PaymentAccountHolderRow,
  PaymentCapture,
  PaymentCaptureRow,
  PaymentCollection,
  PaymentCollectionId,
  PaymentCollectionRow,
  PaymentDatabase,
  PaymentId,
  PaymentMethod,
  PaymentMethodId,
  PaymentMethodRow,
  PaymentProviderRecord,
  PaymentRefund,
  PaymentRefundRow,
  PaymentRepository,
  PaymentRow,
  PaymentSession,
  PaymentSessionId,
  PaymentSessionRow,
} from "../../domain";
import {
  createPaymentAccountHolderId,
  createPaymentCaptureId,
  createPaymentCollectionId,
  createPaymentId,
  createPaymentMethodId,
  createPaymentRefundId,
  createPaymentSessionId,
} from "../../domain";

export type PaymentD1Database = Kysely<PaymentDatabase>;

export interface CreateD1PaymentRepositoryOptions {
  readonly db: PaymentD1Database;
}

const parseJsonColumn = <Value>(value: string): Value => JSON.parse(value);
const toJsonColumn = (value: unknown): string => JSON.stringify(value);
const toBooleanColumn = (value: boolean): number => (value ? 1 : 0);
const fromBooleanColumn = (value: number): boolean => value === 1;

const toAccountHolder = (
  row: PaymentAccountHolderRow
): PaymentAccountHolder => ({
  createdAt: new Date(row.created_at),
  customerId: row.customer_id,
  email: row.email ?? undefined,
  id: createPaymentAccountHolderId(row.id),
  metadata: parseJsonColumn(row.metadata_json),
  providerAccountHolderId: row.provider_account_holder_id,
  providerKey: row.provider_key,
  updatedAt: new Date(row.updated_at),
});

const toMethod = (row: PaymentMethodRow): PaymentMethod => ({
  accountHolderId: row.account_holder_id
    ? createPaymentAccountHolderId(row.account_holder_id)
    : undefined,
  createdAt: new Date(row.created_at),
  displayName: row.display_name ?? undefined,
  id: createPaymentMethodId(row.id),
  metadata: parseJsonColumn(row.metadata_json),
  providerKey: row.provider_key,
  providerPaymentMethodId: row.provider_payment_method_id,
  reusable: fromBooleanColumn(row.reusable),
  type: row.type,
  updatedAt: new Date(row.updated_at),
});

const toCollection = (row: PaymentCollectionRow): PaymentCollection => ({
  amount: row.amount,
  cartId: row.cart_id ?? undefined,
  createdAt: new Date(row.created_at),
  currencyCode: row.currency_code,
  id: createPaymentCollectionId(row.id),
  metadata: parseJsonColumn(row.metadata_json),
  status: row.status as PaymentCollection["status"],
  updatedAt: new Date(row.updated_at),
});

const toSession = (row: PaymentSessionRow): PaymentSession => ({
  amount: row.amount,
  collectionId: createPaymentCollectionId(row.collection_id),
  createdAt: new Date(row.created_at),
  currencyCode: row.currency_code,
  id: createPaymentSessionId(row.id),
  metadata: parseJsonColumn(row.metadata_json),
  providerCheckoutSessionId: row.provider_checkout_session_id ?? undefined,
  providerKey: row.provider_key,
  providerPaymentIntentId: row.provider_payment_intent_id ?? undefined,
  status: row.status as PaymentSession["status"],
  updatedAt: new Date(row.updated_at),
});

const toPayment = (row: PaymentRow): Payment => ({
  amount: row.amount,
  collectionId: createPaymentCollectionId(row.collection_id),
  createdAt: new Date(row.created_at),
  currencyCode: row.currency_code,
  id: createPaymentId(row.id),
  metadata: parseJsonColumn(row.metadata_json),
  providerKey: row.provider_key,
  providerPaymentIntentId: row.provider_payment_intent_id,
  sessionId: createPaymentSessionId(row.session_id),
  status: row.status as Payment["status"],
  updatedAt: new Date(row.updated_at),
});

const toCapture = (row: PaymentCaptureRow): PaymentCapture => ({
  amount: row.amount,
  createdAt: new Date(row.created_at),
  currencyCode: row.currency_code,
  id: createPaymentCaptureId(row.id),
  idempotencyKey: row.idempotency_key,
  paymentId: createPaymentId(row.payment_id),
  providerCaptureId: row.provider_capture_id ?? undefined,
  status: row.status as PaymentCapture["status"],
});

const toRefund = (row: PaymentRefundRow): PaymentRefund => ({
  amount: row.amount,
  createdAt: new Date(row.created_at),
  currencyCode: row.currency_code,
  id: createPaymentRefundId(row.id),
  idempotencyKey: row.idempotency_key,
  paymentId: createPaymentId(row.payment_id),
  providerRefundId: row.provider_refund_id,
  reason: row.reason ?? undefined,
  status: row.status as PaymentRefund["status"],
});

const providerInsert = (
  record: PaymentProviderRecord
): Insertable<PaymentDatabase["payment_provider"]> => ({
  created_at: record.createdAt.getTime(),
  id: record.id,
  is_enabled: toBooleanColumn(record.isEnabled),
  provider_key: record.providerKey,
  provider_record_id: record.providerRecordId,
  updated_at: record.updatedAt.getTime(),
});

const accountHolderInsert = (
  record: PaymentAccountHolder
): Insertable<PaymentDatabase["payment_account_holder"]> => ({
  created_at: record.createdAt.getTime(),
  customer_id: record.customerId,
  email: record.email ?? null,
  id: record.id,
  metadata_json: toJsonColumn(record.metadata),
  provider_account_holder_id: record.providerAccountHolderId,
  provider_key: record.providerKey,
  updated_at: record.updatedAt.getTime(),
});

const methodInsert = (
  record: PaymentMethod
): Insertable<PaymentDatabase["payment_method"]> => ({
  account_holder_id: record.accountHolderId ?? null,
  created_at: record.createdAt.getTime(),
  display_name: record.displayName ?? null,
  id: record.id,
  metadata_json: toJsonColumn(record.metadata),
  provider_key: record.providerKey,
  provider_payment_method_id: record.providerPaymentMethodId,
  reusable: toBooleanColumn(record.reusable),
  type: record.type,
  updated_at: record.updatedAt.getTime(),
});

const collectionInsert = (
  record: PaymentCollection
): Insertable<PaymentDatabase["payment_collection"]> => ({
  amount: record.amount,
  cart_id: record.cartId ?? null,
  created_at: record.createdAt.getTime(),
  currency_code: record.currencyCode,
  id: record.id,
  metadata_json: toJsonColumn(record.metadata),
  status: record.status,
  updated_at: record.updatedAt.getTime(),
});

const sessionInsert = (
  record: PaymentSession
): Insertable<PaymentDatabase["payment_session"]> => ({
  amount: record.amount,
  collection_id: record.collectionId,
  created_at: record.createdAt.getTime(),
  currency_code: record.currencyCode,
  id: record.id,
  metadata_json: toJsonColumn(record.metadata),
  provider_checkout_session_id: record.providerCheckoutSessionId ?? null,
  provider_key: record.providerKey,
  provider_payment_intent_id: record.providerPaymentIntentId ?? null,
  status: record.status,
  updated_at: record.updatedAt.getTime(),
});

const paymentInsert = (
  record: Payment
): Insertable<PaymentDatabase["payment"]> => ({
  amount: record.amount,
  collection_id: record.collectionId,
  created_at: record.createdAt.getTime(),
  currency_code: record.currencyCode,
  id: record.id,
  metadata_json: toJsonColumn(record.metadata),
  provider_key: record.providerKey,
  provider_payment_intent_id: record.providerPaymentIntentId,
  session_id: record.sessionId,
  status: record.status,
  updated_at: record.updatedAt.getTime(),
});

const captureInsert = (
  record: PaymentCapture
): Insertable<PaymentDatabase["payment_capture"]> => ({
  amount: record.amount,
  created_at: record.createdAt.getTime(),
  currency_code: record.currencyCode,
  id: record.id,
  idempotency_key: record.idempotencyKey,
  payment_id: record.paymentId,
  provider_capture_id: record.providerCaptureId ?? null,
  status: record.status,
});

const refundInsert = (
  record: PaymentRefund
): Insertable<PaymentDatabase["payment_refund"]> => ({
  amount: record.amount,
  created_at: record.createdAt.getTime(),
  currency_code: record.currencyCode,
  id: record.id,
  idempotency_key: record.idempotencyKey,
  payment_id: record.paymentId,
  provider_refund_id: record.providerRefundId,
  reason: record.reason ?? null,
  status: record.status,
});

export const createD1PaymentRepository = ({
  db,
}: CreateD1PaymentRepositoryOptions): PaymentRepository => ({
  findAccountHolderById: async (id: PaymentAccountHolderId) => {
    const row = await db
      .selectFrom("payment_account_holder")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return row ? toAccountHolder(row) : null;
  },
  findAccountHolderByProviderId: async ({
    providerAccountHolderId,
    providerKey,
  }) => {
    const row = await db
      .selectFrom("payment_account_holder")
      .selectAll()
      .where("provider_key", "=", providerKey)
      .where("provider_account_holder_id", "=", providerAccountHolderId)
      .executeTakeFirst();

    return row ? toAccountHolder(row) : null;
  },
  findCaptureByIdempotencyKey: async (idempotencyKey) => {
    const row = await db
      .selectFrom("payment_capture")
      .selectAll()
      .where("idempotency_key", "=", idempotencyKey)
      .executeTakeFirst();

    return row ? toCapture(row) : null;
  },
  findCollectionById: async (id: PaymentCollectionId) => {
    const row = await db
      .selectFrom("payment_collection")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return row ? toCollection(row) : null;
  },
  findMethodById: async (id: PaymentMethodId) => {
    const row = await db
      .selectFrom("payment_method")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return row ? toMethod(row) : null;
  },
  findPaymentById: async (id: PaymentId) => {
    const row = await db
      .selectFrom("payment")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return row ? toPayment(row) : null;
  },
  findPaymentByProviderIntent: async ({
    providerKey,
    providerPaymentIntentId,
  }) => {
    const row = await db
      .selectFrom("payment")
      .selectAll()
      .where("provider_key", "=", providerKey)
      .where("provider_payment_intent_id", "=", providerPaymentIntentId)
      .executeTakeFirst();

    return row ? toPayment(row) : null;
  },
  findRefundByIdempotencyKey: async (idempotencyKey) => {
    const row = await db
      .selectFrom("payment_refund")
      .selectAll()
      .where("idempotency_key", "=", idempotencyKey)
      .executeTakeFirst();

    return row ? toRefund(row) : null;
  },
  findSessionById: async (id: PaymentSessionId) => {
    const row = await db
      .selectFrom("payment_session")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return row ? toSession(row) : null;
  },
  findSessionByProviderIntent: async ({
    providerKey,
    providerPaymentIntentId,
  }) => {
    const row = await db
      .selectFrom("payment_session")
      .selectAll()
      .where("provider_key", "=", providerKey)
      .where("provider_payment_intent_id", "=", providerPaymentIntentId)
      .executeTakeFirst();

    return row ? toSession(row) : null;
  },
  listCollections: async () => {
    const rows = await db
      .selectFrom("payment_collection")
      .selectAll()
      .orderBy("created_at", "desc")
      .execute();

    return rows.map(toCollection);
  },
  listPaymentsForCollection: async (collectionId) => {
    const rows = await db
      .selectFrom("payment")
      .selectAll()
      .where("collection_id", "=", collectionId)
      .orderBy("created_at", "desc")
      .execute();

    return rows.map(toPayment);
  },
  listSessionsForCollection: async (collectionId) => {
    const rows = await db
      .selectFrom("payment_session")
      .selectAll()
      .where("collection_id", "=", collectionId)
      .orderBy("created_at", "desc")
      .execute();

    return rows.map(toSession);
  },
  saveAccountHolder: async (accountHolder) => {
    await db
      .insertInto("payment_account_holder")
      .values(accountHolderInsert(accountHolder))
      .onConflict((oc) =>
        oc.column("id").doUpdateSet(accountHolderInsert(accountHolder))
      )
      .execute();

    return accountHolder;
  },
  saveCapture: async (capture) => {
    await db
      .insertInto("payment_capture")
      .values(captureInsert(capture))
      .onConflict((oc) => oc.column("id").doUpdateSet(captureInsert(capture)))
      .execute();

    return capture;
  },
  saveCollection: async (collection) => {
    await db
      .insertInto("payment_collection")
      .values(collectionInsert(collection))
      .onConflict((oc) =>
        oc.column("id").doUpdateSet(collectionInsert(collection))
      )
      .execute();

    return collection;
  },
  saveMethod: async (method) => {
    await db
      .insertInto("payment_method")
      .values(methodInsert(method))
      .onConflict((oc) => oc.column("id").doUpdateSet(methodInsert(method)))
      .execute();

    return method;
  },
  savePayment: async (payment) => {
    await db
      .insertInto("payment")
      .values(paymentInsert(payment))
      .onConflict((oc) => oc.column("id").doUpdateSet(paymentInsert(payment)))
      .execute();

    return payment;
  },
  saveProviderRecord: async (providerRecord) => {
    await db
      .insertInto("payment_provider")
      .values(providerInsert(providerRecord))
      .onConflict((oc) =>
        oc.column("id").doUpdateSet(providerInsert(providerRecord))
      )
      .execute();

    return providerRecord;
  },
  saveRefund: async (refund) => {
    await db
      .insertInto("payment_refund")
      .values(refundInsert(refund))
      .onConflict((oc) => oc.column("id").doUpdateSet(refundInsert(refund)))
      .execute();

    return refund;
  },
  saveSession: async (session) => {
    await db
      .insertInto("payment_session")
      .values(sessionInsert(session))
      .onConflict((oc) => oc.column("id").doUpdateSet(sessionInsert(session)))
      .execute();

    return session;
  },
});

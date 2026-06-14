import type {
  ColumnType,
  Insertable,
  Kysely,
  Migration,
  Selectable,
} from "kysely";

export const paymentProviderTableName = "payment_provider" as const;
export const paymentAccountHolderTableName = "payment_account_holder" as const;
export const paymentMethodTableName = "payment_method" as const;
export const paymentCollectionTableName = "payment_collection" as const;
export const paymentSessionTableName = "payment_session" as const;
export const paymentTableName = "payment" as const;
export const paymentCaptureTableName = "payment_capture" as const;
export const paymentRefundTableName = "payment_refund" as const;
export const paymentProviderKeyIndexName = "payment_provider_key_idx" as const;
export const paymentAccountHolderProviderIndexName =
  "payment_account_holder_provider_idx" as const;
export const paymentMethodAccountHolderIndexName =
  "payment_method_account_holder_idx" as const;
export const paymentSessionCollectionIndexName =
  "payment_session_collection_idx" as const;
export const paymentProviderIntentIndexName =
  "payment_provider_intent_idx" as const;
export const paymentCollectionStatusIndexName =
  "payment_collection_status_idx" as const;
export const paymentCaptureIdempotencyIndexName =
  "payment_capture_idempotency_idx" as const;
export const paymentRefundIdempotencyIndexName =
  "payment_refund_idempotency_idx" as const;

type TimestampMsColumn = ColumnType<number, number, number>;
type BooleanColumn = ColumnType<number, number, number>;

export interface PaymentProviderTable {
  created_at: TimestampMsColumn;
  id: string;
  is_enabled: BooleanColumn;
  provider_key: string;
  provider_record_id: string;
  updated_at: TimestampMsColumn;
}

export interface PaymentAccountHolderTable {
  created_at: TimestampMsColumn;
  customer_id: string;
  email: string | null;
  id: string;
  metadata_json: string;
  provider_account_holder_id: string;
  provider_key: string;
  updated_at: TimestampMsColumn;
}

export interface PaymentMethodTable {
  account_holder_id: string | null;
  created_at: TimestampMsColumn;
  display_name: string | null;
  id: string;
  metadata_json: string;
  provider_key: string;
  provider_payment_method_id: string;
  reusable: BooleanColumn;
  type: string;
  updated_at: TimestampMsColumn;
}

export interface PaymentCollectionTable {
  amount: number;
  cart_id: string | null;
  created_at: TimestampMsColumn;
  currency_code: string;
  id: string;
  metadata_json: string;
  status: string;
  updated_at: TimestampMsColumn;
}

export interface PaymentSessionTable {
  amount: number;
  collection_id: string;
  created_at: TimestampMsColumn;
  currency_code: string;
  id: string;
  metadata_json: string;
  provider_checkout_session_id: string | null;
  provider_key: string;
  provider_payment_intent_id: string | null;
  status: string;
  updated_at: TimestampMsColumn;
}

export interface PaymentTable {
  amount: number;
  collection_id: string;
  created_at: TimestampMsColumn;
  currency_code: string;
  id: string;
  metadata_json: string;
  provider_key: string;
  provider_payment_intent_id: string;
  session_id: string;
  status: string;
  updated_at: TimestampMsColumn;
}

export interface PaymentCaptureTable {
  amount: number;
  created_at: TimestampMsColumn;
  currency_code: string;
  id: string;
  idempotency_key: string;
  payment_id: string;
  provider_capture_id: string | null;
  status: string;
}

export interface PaymentRefundTable {
  amount: number;
  created_at: TimestampMsColumn;
  currency_code: string;
  id: string;
  idempotency_key: string;
  payment_id: string;
  provider_refund_id: string;
  reason: string | null;
  status: string;
}

export interface PaymentDatabase {
  payment: PaymentTable;
  payment_account_holder: PaymentAccountHolderTable;
  payment_capture: PaymentCaptureTable;
  payment_collection: PaymentCollectionTable;
  payment_method: PaymentMethodTable;
  payment_provider: PaymentProviderTable;
  payment_refund: PaymentRefundTable;
  payment_session: PaymentSessionTable;
}

export const paymentSchema = {
  accountHolder: paymentAccountHolderTableName,
  capture: paymentCaptureTableName,
  collection: paymentCollectionTableName,
  method: paymentMethodTableName,
  payment: paymentTableName,
  provider: paymentProviderTableName,
  refund: paymentRefundTableName,
  session: paymentSessionTableName,
} as const;

export type PaymentProviderRow = Selectable<PaymentProviderTable>;
export type PaymentProviderInsert = Insertable<PaymentProviderTable>;
export type PaymentAccountHolderRow = Selectable<PaymentAccountHolderTable>;
export type PaymentAccountHolderInsert = Insertable<PaymentAccountHolderTable>;
export type PaymentMethodRow = Selectable<PaymentMethodTable>;
export type PaymentMethodInsert = Insertable<PaymentMethodTable>;
export type PaymentCollectionRow = Selectable<PaymentCollectionTable>;
export type PaymentCollectionInsert = Insertable<PaymentCollectionTable>;
export type PaymentSessionRow = Selectable<PaymentSessionTable>;
export type PaymentSessionInsert = Insertable<PaymentSessionTable>;
export type PaymentRow = Selectable<PaymentTable>;
export type PaymentInsert = Insertable<PaymentTable>;
export type PaymentCaptureRow = Selectable<PaymentCaptureTable>;
export type PaymentCaptureInsert = Insertable<PaymentCaptureTable>;
export type PaymentRefundRow = Selectable<PaymentRefundTable>;
export type PaymentRefundInsert = Insertable<PaymentRefundTable>;
export type PaymentDatabaseSchema = PaymentDatabase;
export type PaymentSchemaKey = keyof PaymentDatabase;

export const paymentMigration: Migration = {
  down: async (db: Kysely<unknown>) => {
    await db.schema.dropTable(paymentRefundTableName).ifExists().execute();
    await db.schema.dropTable(paymentCaptureTableName).ifExists().execute();
    await db.schema.dropTable(paymentTableName).ifExists().execute();
    await db.schema.dropTable(paymentSessionTableName).ifExists().execute();
    await db.schema.dropTable(paymentCollectionTableName).ifExists().execute();
    await db.schema.dropTable(paymentMethodTableName).ifExists().execute();
    await db.schema
      .dropTable(paymentAccountHolderTableName)
      .ifExists()
      .execute();
    await db.schema.dropTable(paymentProviderTableName).ifExists().execute();
  },
  up: async (db: Kysely<unknown>) => {
    await db.schema
      .createTable(paymentProviderTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("provider_key", "text", (column) => column.notNull())
      .addColumn("provider_record_id", "text", (column) => column.notNull())
      .addColumn("is_enabled", "integer", (column) => column.notNull())
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex(paymentProviderKeyIndexName)
      .ifNotExists()
      .unique()
      .on(paymentProviderTableName)
      .column("provider_key")
      .execute();

    await db.schema
      .createTable(paymentAccountHolderTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("customer_id", "text", (column) => column.notNull())
      .addColumn("provider_key", "text", (column) => column.notNull())
      .addColumn("provider_account_holder_id", "text", (column) =>
        column.notNull()
      )
      .addColumn("email", "text")
      .addColumn("metadata_json", "text", (column) => column.notNull())
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex(paymentAccountHolderProviderIndexName)
      .ifNotExists()
      .unique()
      .on(paymentAccountHolderTableName)
      .columns(["provider_key", "provider_account_holder_id"])
      .execute();

    await db.schema
      .createTable(paymentMethodTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("account_holder_id", "text")
      .addColumn("provider_key", "text", (column) => column.notNull())
      .addColumn("provider_payment_method_id", "text", (column) =>
        column.notNull()
      )
      .addColumn("type", "text", (column) => column.notNull())
      .addColumn("display_name", "text")
      .addColumn("reusable", "integer", (column) => column.notNull())
      .addColumn("metadata_json", "text", (column) => column.notNull())
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex(paymentMethodAccountHolderIndexName)
      .ifNotExists()
      .on(paymentMethodTableName)
      .column("account_holder_id")
      .execute();

    await db.schema
      .createTable(paymentCollectionTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("cart_id", "text")
      .addColumn("amount", "integer", (column) => column.notNull())
      .addColumn("currency_code", "text", (column) => column.notNull())
      .addColumn("status", "text", (column) => column.notNull())
      .addColumn("metadata_json", "text", (column) => column.notNull())
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex(paymentCollectionStatusIndexName)
      .ifNotExists()
      .on(paymentCollectionTableName)
      .column("status")
      .execute();

    await db.schema
      .createTable(paymentSessionTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("collection_id", "text", (column) => column.notNull())
      .addColumn("provider_key", "text", (column) => column.notNull())
      .addColumn("provider_checkout_session_id", "text")
      .addColumn("provider_payment_intent_id", "text")
      .addColumn("amount", "integer", (column) => column.notNull())
      .addColumn("currency_code", "text", (column) => column.notNull())
      .addColumn("status", "text", (column) => column.notNull())
      .addColumn("metadata_json", "text", (column) => column.notNull())
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex(paymentSessionCollectionIndexName)
      .ifNotExists()
      .on(paymentSessionTableName)
      .column("collection_id")
      .execute();

    await db.schema
      .createTable(paymentTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("collection_id", "text", (column) => column.notNull())
      .addColumn("session_id", "text", (column) => column.notNull())
      .addColumn("provider_key", "text", (column) => column.notNull())
      .addColumn("provider_payment_intent_id", "text", (column) =>
        column.notNull()
      )
      .addColumn("amount", "integer", (column) => column.notNull())
      .addColumn("currency_code", "text", (column) => column.notNull())
      .addColumn("status", "text", (column) => column.notNull())
      .addColumn("metadata_json", "text", (column) => column.notNull())
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex(paymentProviderIntentIndexName)
      .ifNotExists()
      .unique()
      .on(paymentTableName)
      .columns(["provider_key", "provider_payment_intent_id"])
      .execute();

    await db.schema
      .createTable(paymentCaptureTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("payment_id", "text", (column) => column.notNull())
      .addColumn("idempotency_key", "text", (column) => column.notNull())
      .addColumn("provider_capture_id", "text")
      .addColumn("amount", "integer", (column) => column.notNull())
      .addColumn("currency_code", "text", (column) => column.notNull())
      .addColumn("status", "text", (column) => column.notNull())
      .addColumn("created_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex(paymentCaptureIdempotencyIndexName)
      .ifNotExists()
      .unique()
      .on(paymentCaptureTableName)
      .column("idempotency_key")
      .execute();

    await db.schema
      .createTable(paymentRefundTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("payment_id", "text", (column) => column.notNull())
      .addColumn("idempotency_key", "text", (column) => column.notNull())
      .addColumn("provider_refund_id", "text", (column) => column.notNull())
      .addColumn("amount", "integer", (column) => column.notNull())
      .addColumn("currency_code", "text", (column) => column.notNull())
      .addColumn("status", "text", (column) => column.notNull())
      .addColumn("reason", "text")
      .addColumn("created_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex(paymentRefundIdempotencyIndexName)
      .ifNotExists()
      .unique()
      .on(paymentRefundTableName)
      .column("idempotency_key")
      .execute();
  },
};

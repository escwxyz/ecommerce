import type {
  ColumnType,
  Insertable,
  Kysely,
  Migration,
  Selectable,
} from "kysely";

export const orderTableName = "order_record" as const;
export const orderLineItemTableName = "order_line_item" as const;
export const orderTransactionTableName = "order_transaction" as const;
export const orderStateTransitionTableName = "order_state_transition" as const;
export const orderPostPurchaseOperationTableName =
  "order_post_purchase_operation" as const;
export const orderCartIndexName = "order_cart_id_idx" as const;
export const orderCustomerIndexName = "order_customer_id_idx" as const;
export const orderLineItemOrderIndexName = "order_line_item_order_id_idx";
export const orderTransactionOrderIndexName = "order_transaction_order_id_idx";

type TimestampMsColumn = ColumnType<number, number, number>;
type NullableTimestampMsColumn = ColumnType<
  number | null,
  number | null,
  number | null
>;

/**
 * Kysely table type for order-owned post-checkout records.
 *
 * Order stores immutable snapshots and stable references received from
 * checkout workflows. Provider-side payment, fulfillment, inventory, pricing,
 * and cart state remains owned by those modules.
 */
export interface OrderTable {
  billing_address: string | null;
  cart_id: string;
  completed_at: NullableTimestampMsColumn;
  created_at: TimestampMsColumn;
  currency_code: string;
  customer_id: string | null;
  email: string | null;
  fulfillment_references: string;
  id: string;
  idempotency_key: string;
  metadata: string;
  payment_references: string;
  shipping_address: string | null;
  status: string;
  totals: string;
  updated_at: TimestampMsColumn;
}

export interface OrderLineItemTable {
  created_at: TimestampMsColumn;
  id: string;
  item_snapshot: string;
  metadata: string;
  order_id: string;
  quantity: number;
  tax_total: number;
  title: string;
  total: number;
  unit_price: number;
  updated_at: TimestampMsColumn;
}

export interface OrderTransactionTable {
  amount: number;
  created_at: TimestampMsColumn;
  currency_code: string;
  id: string;
  idempotency_key: string;
  metadata: string;
  order_id: string;
  reference_id: string | null;
  type: string;
  updated_at: TimestampMsColumn;
}

export interface OrderStateTransitionTable {
  changed_at: TimestampMsColumn;
  from_status: string | null;
  idempotency_key: string;
  metadata: string;
  order_id: string;
  to_status: string;
}

export interface OrderPostPurchaseOperationTable {
  created_at: TimestampMsColumn;
  id: string;
  metadata: string;
  order_id: string;
  status: string;
  type: string;
  updated_at: TimestampMsColumn;
}

export interface OrderDatabase {
  order_line_item: OrderLineItemTable;
  order_post_purchase_operation: OrderPostPurchaseOperationTable;
  order_record: OrderTable;
  order_state_transition: OrderStateTransitionTable;
  order_transaction: OrderTransactionTable;
}

export const orderSchema = {
  lineItem: orderLineItemTableName,
  order: orderTableName,
  operation: orderPostPurchaseOperationTableName,
  stateTransition: orderStateTransitionTableName,
  transaction: orderTransactionTableName,
} as const;

export type OrderRow = Selectable<OrderTable>;
export type OrderInsert = Insertable<OrderTable>;
export type OrderDatabaseSchema = OrderDatabase;
export type OrderSchemaKey = keyof OrderDatabase;

const createOrderTables = async (db: Kysely<unknown>): Promise<void> => {
  await db.schema
    .createTable(orderTableName)
    .ifNotExists()
    .addColumn("id", "text", (column) => column.primaryKey())
    .addColumn("cart_id", "text", (column) => column.notNull())
    .addColumn("customer_id", "text")
    .addColumn("email", "text")
    .addColumn("status", "text", (column) => column.notNull())
    .addColumn("currency_code", "text", (column) => column.notNull())
    .addColumn("totals", "text", (column) => column.notNull())
    .addColumn("billing_address", "text")
    .addColumn("shipping_address", "text")
    .addColumn("payment_references", "text", (column) => column.notNull())
    .addColumn("fulfillment_references", "text", (column) => column.notNull())
    .addColumn("metadata", "text", (column) => column.notNull())
    .addColumn("idempotency_key", "text", (column) => column.notNull().unique())
    .addColumn("completed_at", "integer")
    .addColumn("created_at", "integer", (column) => column.notNull())
    .addColumn("updated_at", "integer", (column) => column.notNull())
    .execute();

  await db.schema
    .createIndex(orderCartIndexName)
    .ifNotExists()
    .on(orderTableName)
    .column("cart_id")
    .execute();

  await db.schema
    .createIndex(orderCustomerIndexName)
    .ifNotExists()
    .on(orderTableName)
    .column("customer_id")
    .execute();

  await db.schema
    .createTable(orderLineItemTableName)
    .ifNotExists()
    .addColumn("id", "text", (column) => column.primaryKey())
    .addColumn("order_id", "text", (column) =>
      column.notNull().references(`${orderTableName}.id`).onDelete("cascade")
    )
    .addColumn("title", "text", (column) => column.notNull())
    .addColumn("quantity", "integer", (column) => column.notNull())
    .addColumn("unit_price", "integer", (column) => column.notNull())
    .addColumn("tax_total", "integer", (column) => column.notNull())
    .addColumn("total", "integer", (column) => column.notNull())
    .addColumn("item_snapshot", "text", (column) => column.notNull())
    .addColumn("metadata", "text", (column) => column.notNull())
    .addColumn("created_at", "integer", (column) => column.notNull())
    .addColumn("updated_at", "integer", (column) => column.notNull())
    .execute();

  await db.schema
    .createIndex(orderLineItemOrderIndexName)
    .ifNotExists()
    .on(orderLineItemTableName)
    .column("order_id")
    .execute();

  await db.schema
    .createTable(orderTransactionTableName)
    .ifNotExists()
    .addColumn("id", "text", (column) => column.primaryKey())
    .addColumn("order_id", "text", (column) =>
      column.notNull().references(`${orderTableName}.id`).onDelete("cascade")
    )
    .addColumn("type", "text", (column) => column.notNull())
    .addColumn("amount", "integer", (column) => column.notNull())
    .addColumn("currency_code", "text", (column) => column.notNull())
    .addColumn("reference_id", "text")
    .addColumn("metadata", "text", (column) => column.notNull())
    .addColumn("idempotency_key", "text", (column) => column.notNull().unique())
    .addColumn("created_at", "integer", (column) => column.notNull())
    .addColumn("updated_at", "integer", (column) => column.notNull())
    .execute();

  await db.schema
    .createIndex(orderTransactionOrderIndexName)
    .ifNotExists()
    .on(orderTransactionTableName)
    .column("order_id")
    .execute();

  await db.schema
    .createTable(orderStateTransitionTableName)
    .ifNotExists()
    .addColumn("order_id", "text", (column) =>
      column.notNull().references(`${orderTableName}.id`).onDelete("cascade")
    )
    .addColumn("from_status", "text")
    .addColumn("to_status", "text", (column) => column.notNull())
    .addColumn("metadata", "text", (column) => column.notNull())
    .addColumn("idempotency_key", "text", (column) => column.notNull().unique())
    .addColumn("changed_at", "integer", (column) => column.notNull())
    .execute();

  await db.schema
    .createTable(orderPostPurchaseOperationTableName)
    .ifNotExists()
    .addColumn("id", "text", (column) => column.primaryKey())
    .addColumn("order_id", "text", (column) =>
      column.notNull().references(`${orderTableName}.id`).onDelete("cascade")
    )
    .addColumn("type", "text", (column) => column.notNull())
    .addColumn("status", "text", (column) => column.notNull())
    .addColumn("metadata", "text", (column) => column.notNull())
    .addColumn("created_at", "integer", (column) => column.notNull())
    .addColumn("updated_at", "integer", (column) => column.notNull())
    .execute();
};

const dropOrderTables = async (db: Kysely<unknown>): Promise<void> => {
  await db.schema
    .dropTable(orderPostPurchaseOperationTableName)
    .ifExists()
    .execute();
  await db.schema.dropTable(orderStateTransitionTableName).ifExists().execute();
  await db.schema.dropTable(orderTransactionTableName).ifExists().execute();
  await db.schema.dropTable(orderLineItemTableName).ifExists().execute();
  await db.schema.dropTable(orderTableName).ifExists().execute();
};

export const orderMigration: Migration = {
  down: dropOrderTables,
  up: createOrderTables,
};

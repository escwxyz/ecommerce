import type {
  ColumnType,
  Insertable,
  Kysely,
  Migration,
  Selectable,
} from "kysely";

export const cartTableName = "cart" as const;
export const cartLineItemTableName = "cart_line_item" as const;
export const cartAdjustmentTableName = "cart_adjustment" as const;
export const cartCustomerIndexName = "cart_customer_idx" as const;
export const cartLineItemCartIndexName = "cart_line_item_cart_idx" as const;
export const cartLineItemIdempotencyIndexName =
  "cart_line_item_idempotency_idx" as const;
export const cartAdjustmentCartIndexName = "cart_adjustment_cart_idx" as const;
export const cartAdjustmentIdempotencyIndexName =
  "cart_adjustment_idempotency_idx" as const;

type TimestampMsColumn = ColumnType<number, number, number>;

export interface CartTable {
  billing_address_json: string | null;
  completed_at: TimestampMsColumn | null;
  created_at: TimestampMsColumn;
  currency_code: string;
  customer_id: string | null;
  email: string | null;
  id: string;
  metadata_json: string;
  payment_collection_id: string | null;
  region_id: string | null;
  sales_channel_id: string | null;
  shipping_address_json: string | null;
  shipping_option_id: string | null;
  status: string;
  totals_json: string;
  updated_at: TimestampMsColumn;
}

export interface CartLineItemTable {
  cart_id: string;
  created_at: TimestampMsColumn;
  id: string;
  idempotency_key: string | null;
  metadata_json: string;
  product_id: string;
  quantity: number;
  title: string;
  unit_price: number;
  updated_at: TimestampMsColumn;
  variant_id: string;
}

export interface CartAdjustmentTable {
  amount: number;
  cart_id: string;
  created_at: TimestampMsColumn;
  id: string;
  idempotency_key: string;
  line_item_id: string | null;
  metadata_json: string;
  source: string;
  type: string;
  updated_at: TimestampMsColumn;
}

export interface CartDatabase {
  cart: CartTable;
  cart_adjustment: CartAdjustmentTable;
  cart_line_item: CartLineItemTable;
}

export const cartSchema = {
  adjustment: cartAdjustmentTableName,
  cart: cartTableName,
  lineItem: cartLineItemTableName,
} as const;

export type CartRow = Selectable<CartTable>;
export type CartInsert = Insertable<CartTable>;
export type CartLineItemRow = Selectable<CartLineItemTable>;
export type CartLineItemInsert = Insertable<CartLineItemTable>;
export type CartAdjustmentRow = Selectable<CartAdjustmentTable>;
export type CartAdjustmentInsert = Insertable<CartAdjustmentTable>;
export type CartDatabaseSchema = CartDatabase;
export type CartSchemaKey = keyof CartDatabase;

export const cartMigration: Migration = {
  down: async (db: Kysely<unknown>) => {
    await db.schema.dropTable(cartAdjustmentTableName).ifExists().execute();
    await db.schema.dropTable(cartLineItemTableName).ifExists().execute();
    await db.schema.dropTable(cartTableName).ifExists().execute();
  },
  up: async (db: Kysely<unknown>) => {
    await db.schema
      .createTable(cartTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("customer_id", "text")
      .addColumn("email", "text")
      .addColumn("region_id", "text")
      .addColumn("sales_channel_id", "text")
      .addColumn("currency_code", "text", (column) => column.notNull())
      .addColumn("shipping_option_id", "text")
      .addColumn("payment_collection_id", "text")
      .addColumn("billing_address_json", "text")
      .addColumn("shipping_address_json", "text")
      .addColumn("totals_json", "text", (column) => column.notNull())
      .addColumn("metadata_json", "text", (column) => column.notNull())
      .addColumn("status", "text", (column) => column.notNull())
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .addColumn("completed_at", "integer")
      .execute();

    await db.schema
      .createIndex(cartCustomerIndexName)
      .ifNotExists()
      .on(cartTableName)
      .column("customer_id")
      .execute();

    await db.schema
      .createTable(cartLineItemTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("cart_id", "text", (column) =>
        column.notNull().references(`${cartTableName}.id`).onDelete("cascade")
      )
      .addColumn("product_id", "text", (column) => column.notNull())
      .addColumn("variant_id", "text", (column) => column.notNull())
      .addColumn("title", "text", (column) => column.notNull())
      .addColumn("quantity", "integer", (column) => column.notNull())
      .addColumn("unit_price", "integer", (column) => column.notNull())
      .addColumn("metadata_json", "text", (column) => column.notNull())
      .addColumn("idempotency_key", "text")
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex(cartLineItemCartIndexName)
      .ifNotExists()
      .on(cartLineItemTableName)
      .column("cart_id")
      .execute();

    await db.schema
      .createIndex(cartLineItemIdempotencyIndexName)
      .ifNotExists()
      .unique()
      .on(cartLineItemTableName)
      .column("idempotency_key")
      .execute();

    await db.schema
      .createTable(cartAdjustmentTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("cart_id", "text", (column) =>
        column.notNull().references(`${cartTableName}.id`).onDelete("cascade")
      )
      .addColumn("line_item_id", "text")
      .addColumn("type", "text", (column) => column.notNull())
      .addColumn("source", "text", (column) => column.notNull())
      .addColumn("amount", "integer", (column) => column.notNull())
      .addColumn("metadata_json", "text", (column) => column.notNull())
      .addColumn("idempotency_key", "text", (column) => column.notNull())
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex(cartAdjustmentCartIndexName)
      .ifNotExists()
      .on(cartAdjustmentTableName)
      .column("cart_id")
      .execute();

    await db.schema
      .createIndex(cartAdjustmentIdempotencyIndexName)
      .ifNotExists()
      .unique()
      .on(cartAdjustmentTableName)
      .column("idempotency_key")
      .execute();
  },
};

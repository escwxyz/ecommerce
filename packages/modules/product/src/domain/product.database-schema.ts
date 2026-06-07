import type {
  ColumnType,
  Insertable,
  Kysely,
  Migration,
  Selectable,
} from "kysely";

export const productTableName = "product" as const;
export const productHandleIndexName = "product_handle_idx" as const;

type TimestampMsColumn = ColumnType<number, number, number>;

/**
 * Kysely table type for product primary storage.
 *
 * The product module owns this table surface once. Concrete adapters reuse it
 * through the shared database assembly instead of redefining table builders for
 * D1, libSQL, and PostgreSQL separately.
 */
export interface ProductTable {
  created_at: TimestampMsColumn;
  handle: string;
  id: string;
  status: string;
  title: string;
  updated_at: TimestampMsColumn;
}

export interface ProductDatabase {
  product: ProductTable;
}

export const productSchema = {
  product: productTableName,
} as const;

export type ProductRow = Selectable<ProductTable>;
export type ProductInsert = Insertable<ProductTable>;
export type ProductDatabaseSchema = ProductDatabase;
export type ProductSchemaKey = keyof ProductDatabase;

export const productMigration: Migration = {
  down: async (db: Kysely<unknown>) => {
    await db.schema.dropTable(productTableName).ifExists().execute();
  },
  up: async (db: Kysely<unknown>) => {
    await db.schema
      .createTable(productTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("handle", "text", (column) => column.notNull())
      .addColumn("title", "text", (column) => column.notNull())
      .addColumn("status", "text", (column) => column.notNull())
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex(productHandleIndexName)
      .ifNotExists()
      .unique()
      .on(productTableName)
      .column("handle")
      .execute();
  },
};

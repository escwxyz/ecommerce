import type {
  ColumnType,
  Insertable,
  Kysely,
  Migration,
  Selectable,
} from "kysely";

export const storeTableName = "store" as const;

type TimestampMsColumn = ColumnType<number, number, number>;

/**
 * Kysely table type for the store module's platform commerce defaults.
 *
 * The module owns the table contract, while concrete adapters decide how a
 * Kysely instance is created and migrated for a specific runtime.
 */
export interface StoreTable {
  created_at: TimestampMsColumn;
  default_currency_code: string;
  default_locale: string;
  default_region_id: string | null;
  default_sales_channel_id: string | null;
  id: string;
  metadata_json: string;
  name: string;
  supported_currency_codes_json: string;
  timezone: string;
  updated_at: TimestampMsColumn;
}

export interface StoreDatabase {
  store: StoreTable;
}

export const storeSchema = {
  store: storeTableName,
} as const;

export type StoreRow = Selectable<StoreTable>;
export type StoreInsert = Insertable<StoreTable>;
export type StoreDatabaseSchema = StoreDatabase;
export type StoreSchemaKey = keyof StoreDatabase;

export const storeMigration: Migration = {
  down: async (db: Kysely<unknown>) => {
    await db.schema.dropTable(storeTableName).ifExists().execute();
  },
  up: async (db: Kysely<unknown>) => {
    await db.schema
      .createTable(storeTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("name", "text", (column) => column.notNull())
      .addColumn("default_currency_code", "text", (column) => column.notNull())
      .addColumn("supported_currency_codes_json", "text", (column) =>
        column.notNull()
      )
      .addColumn("default_region_id", "text")
      .addColumn("default_sales_channel_id", "text")
      .addColumn("default_locale", "text", (column) => column.notNull())
      .addColumn("timezone", "text", (column) => column.notNull())
      .addColumn("metadata_json", "text", (column) => column.notNull())
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();
  },
};

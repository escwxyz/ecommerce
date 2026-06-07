import type {
  ColumnType,
  Insertable,
  Kysely,
  Migration,
  Selectable,
} from "kysely";

export const regionTableName = "region" as const;
export const regionCountryTableName = "region_country" as const;
export const salesChannelTableName = "sales_channel" as const;
export const salesChannelProductTableName = "sales_channel_product" as const;
export const regionCountryIndexName = "region_country_region_idx" as const;
export const salesChannelProductIndexName =
  "sales_channel_product_channel_idx" as const;

type TimestampMsColumn = ColumnType<number, number, number>;

export interface RegionTable {
  created_at: TimestampMsColumn;
  currency_code: string;
  fulfillment_option_ids_json: string;
  id: string;
  metadata_json: string;
  name: string;
  payment_provider_ids_json: string;
  tax_provider_id: string | null;
  updated_at: TimestampMsColumn;
}

export interface RegionCountryTable {
  country_code: string;
  region_id: string;
}

export interface SalesChannelTable {
  created_at: TimestampMsColumn;
  description: string | null;
  id: string;
  metadata_json: string;
  name: string;
  status: string;
  updated_at: TimestampMsColumn;
}

export interface SalesChannelProductTable {
  product_id: string;
  sales_channel_id: string;
}

export interface RegionSalesChannelDatabase {
  region: RegionTable;
  region_country: RegionCountryTable;
  sales_channel: SalesChannelTable;
  sales_channel_product: SalesChannelProductTable;
}

export const regionSalesChannelSchema = {
  region: regionTableName,
  regionCountry: regionCountryTableName,
  salesChannel: salesChannelTableName,
  salesChannelProduct: salesChannelProductTableName,
} as const;

export type RegionRow = Selectable<RegionTable>;
export type RegionInsert = Insertable<RegionTable>;
export type RegionCountryRow = Selectable<RegionCountryTable>;
export type RegionCountryInsert = Insertable<RegionCountryTable>;
export type SalesChannelRow = Selectable<SalesChannelTable>;
export type SalesChannelInsert = Insertable<SalesChannelTable>;
export type SalesChannelProductRow = Selectable<SalesChannelProductTable>;
export type SalesChannelProductInsert = Insertable<SalesChannelProductTable>;
export type RegionSalesChannelDatabaseSchema = RegionSalesChannelDatabase;
export type RegionSalesChannelSchemaKey = keyof RegionSalesChannelDatabase;

export const regionSalesChannelMigration: Migration = {
  down: async (db: Kysely<unknown>) => {
    await db.schema
      .dropTable(salesChannelProductTableName)
      .ifExists()
      .execute();
    await db.schema.dropTable(salesChannelTableName).ifExists().execute();
    await db.schema.dropTable(regionCountryTableName).ifExists().execute();
    await db.schema.dropTable(regionTableName).ifExists().execute();
  },
  up: async (db: Kysely<unknown>) => {
    await db.schema
      .createTable(regionTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("name", "text", (column) => column.notNull())
      .addColumn("currency_code", "text", (column) => column.notNull())
      .addColumn("tax_provider_id", "text")
      .addColumn("payment_provider_ids_json", "text", (column) =>
        column.notNull()
      )
      .addColumn("fulfillment_option_ids_json", "text", (column) =>
        column.notNull()
      )
      .addColumn("metadata_json", "text", (column) => column.notNull())
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createTable(regionCountryTableName)
      .ifNotExists()
      .addColumn("region_id", "text", (column) => column.notNull())
      .addColumn("country_code", "text", (column) => column.notNull())
      .addPrimaryKeyConstraint("region_country_pk", [
        "region_id",
        "country_code",
      ])
      .execute();

    await db.schema
      .createIndex(regionCountryIndexName)
      .ifNotExists()
      .on(regionCountryTableName)
      .column("region_id")
      .execute();

    await db.schema
      .createTable(salesChannelTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("name", "text", (column) => column.notNull())
      .addColumn("description", "text")
      .addColumn("status", "text", (column) => column.notNull())
      .addColumn("metadata_json", "text", (column) => column.notNull())
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createTable(salesChannelProductTableName)
      .ifNotExists()
      .addColumn("sales_channel_id", "text", (column) => column.notNull())
      .addColumn("product_id", "text", (column) => column.notNull())
      .addPrimaryKeyConstraint("sales_channel_product_pk", [
        "sales_channel_id",
        "product_id",
      ])
      .execute();

    await db.schema
      .createIndex(salesChannelProductIndexName)
      .ifNotExists()
      .on(salesChannelProductTableName)
      .column("sales_channel_id")
      .execute();
  },
};

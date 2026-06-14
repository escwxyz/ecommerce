import type {
  ColumnType,
  Insertable,
  Kysely,
  Migration,
  Selectable,
} from "kysely";

export const taxRegionTableName = "tax_region" as const;
export const taxRateTableName = "tax_rate" as const;
export const taxCategoryTableName = "tax_category" as const;
export const taxProviderConfigTableName = "tax_provider_config" as const;
export const taxCalculationPolicyTableName = "tax_calculation_policy" as const;
export const taxRegionCodeIndexName = "tax_region_code_idx" as const;
export const taxRateRegionIndexName = "tax_rate_region_idx" as const;
export const taxRateCategoryIndexName = "tax_rate_category_idx" as const;
export const taxCategoryCodeIndexName = "tax_category_code_idx" as const;
export const taxProviderConfigKeyIndexName =
  "tax_provider_config_key_idx" as const;

type TimestampMsColumn = ColumnType<number, number, number>;
type BooleanColumn = ColumnType<number, number, number>;

export interface TaxRegionTable {
  code: string;
  country_code: string;
  created_at: TimestampMsColumn;
  id: string;
  metadata_json: string;
  name: string;
  provider_config_id: string | null;
  updated_at: TimestampMsColumn;
}

export interface TaxRateTable {
  category_id: string | null;
  created_at: TimestampMsColumn;
  id: string;
  metadata_json: string;
  name: string;
  percentage: number;
  region_id: string;
  updated_at: TimestampMsColumn;
}

export interface TaxCategoryTable {
  code: string;
  created_at: TimestampMsColumn;
  description: string | null;
  id: string;
  metadata_json: string;
  name: string;
  updated_at: TimestampMsColumn;
}

export interface TaxProviderConfigTable {
  created_at: TimestampMsColumn;
  id: string;
  is_active: BooleanColumn;
  metadata_json: string;
  provider_key: string;
  settings_json: string;
  updated_at: TimestampMsColumn;
}

export interface TaxCalculationPolicyTable {
  id: string;
  prices_include_tax: BooleanColumn;
  region_id: string;
  round_at: string;
  updated_at: TimestampMsColumn;
}

export interface TaxDatabase {
  tax_calculation_policy: TaxCalculationPolicyTable;
  tax_category: TaxCategoryTable;
  tax_provider_config: TaxProviderConfigTable;
  tax_rate: TaxRateTable;
  tax_region: TaxRegionTable;
}

export const taxSchema = {
  category: taxCategoryTableName,
  calculationPolicy: taxCalculationPolicyTableName,
  providerConfig: taxProviderConfigTableName,
  rate: taxRateTableName,
  region: taxRegionTableName,
} as const;

export type TaxRegionRow = Selectable<TaxRegionTable>;
export type TaxRegionInsert = Insertable<TaxRegionTable>;
export type TaxRateRow = Selectable<TaxRateTable>;
export type TaxRateInsert = Insertable<TaxRateTable>;
export type TaxCategoryRow = Selectable<TaxCategoryTable>;
export type TaxCategoryInsert = Insertable<TaxCategoryTable>;
export type TaxProviderConfigRow = Selectable<TaxProviderConfigTable>;
export type TaxProviderConfigInsert = Insertable<TaxProviderConfigTable>;
export type TaxCalculationPolicyRow = Selectable<TaxCalculationPolicyTable>;
export type TaxCalculationPolicyInsert = Insertable<TaxCalculationPolicyTable>;
export type TaxDatabaseSchema = TaxDatabase;
export type TaxSchemaKey = keyof TaxDatabase;

export const taxMigration: Migration = {
  down: async (db: Kysely<unknown>) => {
    await db.schema
      .dropTable(taxCalculationPolicyTableName)
      .ifExists()
      .execute();
    await db.schema.dropTable(taxRateTableName).ifExists().execute();
    await db.schema.dropTable(taxRegionTableName).ifExists().execute();
    await db.schema.dropTable(taxProviderConfigTableName).ifExists().execute();
    await db.schema.dropTable(taxCategoryTableName).ifExists().execute();
  },
  up: async (db: Kysely<unknown>) => {
    await db.schema
      .createTable(taxCategoryTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("code", "text", (column) => column.notNull())
      .addColumn("name", "text", (column) => column.notNull())
      .addColumn("description", "text")
      .addColumn("metadata_json", "text", (column) => column.notNull())
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex(taxCategoryCodeIndexName)
      .ifNotExists()
      .on(taxCategoryTableName)
      .column("code")
      .execute();

    await db.schema
      .createTable(taxProviderConfigTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("provider_key", "text", (column) => column.notNull())
      .addColumn("settings_json", "text", (column) => column.notNull())
      .addColumn("is_active", "integer", (column) => column.notNull())
      .addColumn("metadata_json", "text", (column) => column.notNull())
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex(taxProviderConfigKeyIndexName)
      .ifNotExists()
      .on(taxProviderConfigTableName)
      .column("provider_key")
      .execute();

    await db.schema
      .createTable(taxRegionTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("code", "text", (column) => column.notNull())
      .addColumn("name", "text", (column) => column.notNull())
      .addColumn("country_code", "text", (column) => column.notNull())
      .addColumn("provider_config_id", "text")
      .addColumn("metadata_json", "text", (column) => column.notNull())
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex(taxRegionCodeIndexName)
      .ifNotExists()
      .on(taxRegionTableName)
      .column("code")
      .execute();

    await db.schema
      .createTable(taxRateTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("region_id", "text", (column) => column.notNull())
      .addColumn("category_id", "text")
      .addColumn("name", "text", (column) => column.notNull())
      .addColumn("percentage", "real", (column) => column.notNull())
      .addColumn("metadata_json", "text", (column) => column.notNull())
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex(taxRateRegionIndexName)
      .ifNotExists()
      .on(taxRateTableName)
      .column("region_id")
      .execute();

    await db.schema
      .createIndex(taxRateCategoryIndexName)
      .ifNotExists()
      .on(taxRateTableName)
      .column("category_id")
      .execute();

    await db.schema
      .createTable(taxCalculationPolicyTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("region_id", "text", (column) => column.notNull())
      .addColumn("prices_include_tax", "integer", (column) => column.notNull())
      .addColumn("round_at", "text", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();
  },
};

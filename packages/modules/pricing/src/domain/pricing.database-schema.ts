import type {
  ColumnType,
  Insertable,
  Kysely,
  Migration,
  Selectable,
} from "kysely";

export const currencyTableName = "pricing_currency" as const;
export const priceSetTableName = "pricing_price_set" as const;
export const priceListTableName = "pricing_price_list" as const;
export const moneyAmountTableName = "pricing_money_amount" as const;
export const priceRuleTableName = "pricing_price_rule" as const;
export const pricePreferenceTableName = "pricing_price_preference" as const;
export const moneyAmountPriceSetIndexName =
  "pricing_money_amount_price_set_idx" as const;
export const priceRulePriceListIndexName =
  "pricing_price_rule_price_list_idx" as const;
export const pricePreferenceScopeIndexName =
  "pricing_price_preference_scope_idx" as const;

type TimestampMsColumn = ColumnType<number, number, number>;

export interface CurrencyTable {
  code: string;
  created_at: TimestampMsColumn;
  id: string;
  name: string;
  precision: number;
  updated_at: TimestampMsColumn;
}

export interface PriceSetTable {
  created_at: TimestampMsColumn;
  id: string;
  metadata_json: string;
  title: string;
  updated_at: TimestampMsColumn;
}

export interface PriceListTable {
  created_at: TimestampMsColumn;
  description: string | null;
  ends_at: TimestampMsColumn | null;
  id: string;
  starts_at: TimestampMsColumn | null;
  status: string;
  title: string;
  updated_at: TimestampMsColumn;
}

export interface MoneyAmountTable {
  amount: number;
  created_at: TimestampMsColumn;
  currency_code: string;
  id: string;
  price_list_id: string | null;
  price_set_id: string;
  rules_json: string;
  updated_at: TimestampMsColumn;
}

export interface PriceRuleTable {
  attribute: string;
  created_at: TimestampMsColumn;
  id: string;
  price_list_id: string;
  updated_at: TimestampMsColumn;
  value: string;
}

export interface PricePreferenceTable {
  attribute: string;
  created_at: TimestampMsColumn;
  currency_code: string;
  id: string;
  updated_at: TimestampMsColumn;
  value: string;
}

export interface PricingDatabase {
  pricing_currency: CurrencyTable;
  pricing_money_amount: MoneyAmountTable;
  pricing_price_list: PriceListTable;
  pricing_price_preference: PricePreferenceTable;
  pricing_price_rule: PriceRuleTable;
  pricing_price_set: PriceSetTable;
}

export const pricingSchema = {
  currency: currencyTableName,
  moneyAmount: moneyAmountTableName,
  priceList: priceListTableName,
  pricePreference: pricePreferenceTableName,
  priceRule: priceRuleTableName,
  priceSet: priceSetTableName,
} as const;

export type CurrencyRow = Selectable<CurrencyTable>;
export type CurrencyInsert = Insertable<CurrencyTable>;
export type PriceSetRow = Selectable<PriceSetTable>;
export type PriceSetInsert = Insertable<PriceSetTable>;
export type PriceListRow = Selectable<PriceListTable>;
export type PriceListInsert = Insertable<PriceListTable>;
export type MoneyAmountRow = Selectable<MoneyAmountTable>;
export type MoneyAmountInsert = Insertable<MoneyAmountTable>;
export type PriceRuleRow = Selectable<PriceRuleTable>;
export type PriceRuleInsert = Insertable<PriceRuleTable>;
export type PricePreferenceRow = Selectable<PricePreferenceTable>;
export type PricePreferenceInsert = Insertable<PricePreferenceTable>;
export type PricingDatabaseSchema = PricingDatabase;
export type PricingSchemaKey = keyof PricingDatabase;

export const pricingMigration: Migration = {
  down: async (db: Kysely<unknown>) => {
    await db.schema.dropTable(pricePreferenceTableName).ifExists().execute();
    await db.schema.dropTable(priceRuleTableName).ifExists().execute();
    await db.schema.dropTable(moneyAmountTableName).ifExists().execute();
    await db.schema.dropTable(priceListTableName).ifExists().execute();
    await db.schema.dropTable(priceSetTableName).ifExists().execute();
    await db.schema.dropTable(currencyTableName).ifExists().execute();
  },
  up: async (db: Kysely<unknown>) => {
    await db.schema
      .createTable(currencyTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("code", "text", (column) => column.notNull().unique())
      .addColumn("name", "text", (column) => column.notNull())
      .addColumn("precision", "integer", (column) => column.notNull())
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createTable(priceSetTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("title", "text", (column) => column.notNull())
      .addColumn("metadata_json", "text", (column) => column.notNull())
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createTable(priceListTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("title", "text", (column) => column.notNull())
      .addColumn("description", "text")
      .addColumn("status", "text", (column) => column.notNull())
      .addColumn("starts_at", "integer")
      .addColumn("ends_at", "integer")
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createTable(moneyAmountTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("price_set_id", "text", (column) => column.notNull())
      .addColumn("price_list_id", "text")
      .addColumn("currency_code", "text", (column) => column.notNull())
      .addColumn("amount", "integer", (column) => column.notNull())
      .addColumn("rules_json", "text", (column) => column.notNull())
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex(moneyAmountPriceSetIndexName)
      .ifNotExists()
      .on(moneyAmountTableName)
      .column("price_set_id")
      .execute();

    await db.schema
      .createTable(priceRuleTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("price_list_id", "text", (column) => column.notNull())
      .addColumn("attribute", "text", (column) => column.notNull())
      .addColumn("value", "text", (column) => column.notNull())
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex(priceRulePriceListIndexName)
      .ifNotExists()
      .on(priceRuleTableName)
      .column("price_list_id")
      .execute();

    await db.schema
      .createTable(pricePreferenceTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("attribute", "text", (column) => column.notNull())
      .addColumn("value", "text", (column) => column.notNull())
      .addColumn("currency_code", "text", (column) => column.notNull())
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex(pricePreferenceScopeIndexName)
      .ifNotExists()
      .on(pricePreferenceTableName)
      .columns(["attribute", "value"])
      .execute();
  },
};

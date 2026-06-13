import type {
  ColumnType,
  Insertable,
  Kysely,
  Migration,
  Selectable,
} from "kysely";

export const promotionCampaignTableName = "promotion_campaign" as const;
export const promotionTableName = "promotion_promotion" as const;
export const promotionRuleTableName = "promotion_rule" as const;
export const promotionUsageLimitTableName = "promotion_usage_limit" as const;
export const promotionRedemptionTableName = "promotion_redemption" as const;
export const promotionCodeIndexName = "promotion_code_idx" as const;
export const promotionRulePromotionIndexName =
  "promotion_rule_promotion_idx" as const;
export const promotionUsageLimitPromotionIndexName =
  "promotion_usage_limit_promotion_idx" as const;
export const promotionRedemptionPromotionIndexName =
  "promotion_redemption_promotion_idx" as const;

type TimestampMsColumn = ColumnType<number, number, number>;

export interface PromotionCampaignTable {
  created_at: TimestampMsColumn;
  description: string | null;
  id: string;
  metadata_json: string;
  name: string;
  updated_at: TimestampMsColumn;
}

export interface PromotionTable {
  application_method_json: string;
  campaign_id: string | null;
  code: string | null;
  created_at: TimestampMsColumn;
  ends_at: TimestampMsColumn | null;
  id: string;
  metadata_json: string;
  starts_at: TimestampMsColumn | null;
  status: string;
  title: string;
  updated_at: TimestampMsColumn;
}

export interface PromotionRuleTable {
  attribute: string;
  created_at: TimestampMsColumn;
  id: string;
  promotion_id: string;
  updated_at: TimestampMsColumn;
  value: string;
}

export interface PromotionUsageLimitTable {
  created_at: TimestampMsColumn;
  id: string;
  limit_value: number;
  promotion_id: string;
  scope: string;
  updated_at: TimestampMsColumn;
}

export interface PromotionRedemptionTable {
  adjustment_ids_json: string;
  cart_id: string;
  created_at: TimestampMsColumn;
  id: string;
  promotion_id: string;
}

export interface PromotionDatabase {
  promotion_campaign: PromotionCampaignTable;
  promotion_promotion: PromotionTable;
  promotion_redemption: PromotionRedemptionTable;
  promotion_rule: PromotionRuleTable;
  promotion_usage_limit: PromotionUsageLimitTable;
}

export const promotionSchema = {
  campaign: promotionCampaignTableName,
  promotion: promotionTableName,
  redemption: promotionRedemptionTableName,
  rule: promotionRuleTableName,
  usageLimit: promotionUsageLimitTableName,
} as const;

export type PromotionCampaignRow = Selectable<PromotionCampaignTable>;
export type PromotionCampaignInsert = Insertable<PromotionCampaignTable>;
export type PromotionRow = Selectable<PromotionTable>;
export type PromotionInsert = Insertable<PromotionTable>;
export type PromotionRuleRow = Selectable<PromotionRuleTable>;
export type PromotionRuleInsert = Insertable<PromotionRuleTable>;
export type PromotionUsageLimitRow = Selectable<PromotionUsageLimitTable>;
export type PromotionUsageLimitInsert = Insertable<PromotionUsageLimitTable>;
export type PromotionRedemptionRow = Selectable<PromotionRedemptionTable>;
export type PromotionRedemptionInsert = Insertable<PromotionRedemptionTable>;
export type PromotionDatabaseSchema = PromotionDatabase;
export type PromotionSchemaKey = keyof PromotionDatabase;

export const promotionMigration: Migration = {
  down: async (db: Kysely<unknown>) => {
    await db.schema
      .dropTable(promotionRedemptionTableName)
      .ifExists()
      .execute();
    await db.schema
      .dropTable(promotionUsageLimitTableName)
      .ifExists()
      .execute();
    await db.schema.dropTable(promotionRuleTableName).ifExists().execute();
    await db.schema.dropTable(promotionTableName).ifExists().execute();
    await db.schema.dropTable(promotionCampaignTableName).ifExists().execute();
  },
  up: async (db: Kysely<unknown>) => {
    await db.schema
      .createTable(promotionCampaignTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("name", "text", (column) => column.notNull())
      .addColumn("description", "text")
      .addColumn("metadata_json", "text", (column) => column.notNull())
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createTable(promotionTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("campaign_id", "text")
      .addColumn("code", "text")
      .addColumn("title", "text", (column) => column.notNull())
      .addColumn("status", "text", (column) => column.notNull())
      .addColumn("application_method_json", "text", (column) =>
        column.notNull()
      )
      .addColumn("starts_at", "integer")
      .addColumn("ends_at", "integer")
      .addColumn("metadata_json", "text", (column) => column.notNull())
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex(promotionCodeIndexName)
      .ifNotExists()
      .on(promotionTableName)
      .column("code")
      .execute();

    await db.schema
      .createTable(promotionRuleTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("promotion_id", "text", (column) => column.notNull())
      .addColumn("attribute", "text", (column) => column.notNull())
      .addColumn("value", "text", (column) => column.notNull())
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex(promotionRulePromotionIndexName)
      .ifNotExists()
      .on(promotionRuleTableName)
      .column("promotion_id")
      .execute();

    await db.schema
      .createTable(promotionUsageLimitTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("promotion_id", "text", (column) => column.notNull())
      .addColumn("scope", "text", (column) => column.notNull())
      .addColumn("limit_value", "integer", (column) => column.notNull())
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex(promotionUsageLimitPromotionIndexName)
      .ifNotExists()
      .on(promotionUsageLimitTableName)
      .column("promotion_id")
      .execute();

    await db.schema
      .createTable(promotionRedemptionTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("promotion_id", "text", (column) => column.notNull())
      .addColumn("cart_id", "text", (column) => column.notNull())
      .addColumn("adjustment_ids_json", "text", (column) => column.notNull())
      .addColumn("created_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex(promotionRedemptionPromotionIndexName)
      .ifNotExists()
      .on(promotionRedemptionTableName)
      .column("promotion_id")
      .execute();
  },
};

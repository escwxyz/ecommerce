import {
  CampaignSerializedIdSchema,
  PromotionAdjustmentSerializedIdSchema,
  PromotionApplicationMethodSchema,
  PromotionMetadataSchema,
  PromotionRedemptionSerializedIdSchema,
  PromotionRuleSerializedIdSchema,
  PromotionSerializedIdSchema,
  PromotionStatusSchema,
  PromotionTrimmedStringSchema,
  PromotionUsageLimitScopeSchema,
  PromotionUsageLimitSerializedIdSchema,
} from "@ecommerce/promotion";
import {
  createInsertSchema,
  createSelectSchema,
} from "drizzle-orm/effect-schema";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { Schema } from "effect";

export const postgresPromotionCampaignTableName = "promotion_campaign" as const;
export const postgresPromotionTableName = "promotion_promotion" as const;
export const postgresPromotionRuleTableName = "promotion_rule" as const;
export const postgresPromotionUsageLimitTableName =
  "promotion_usage_limit" as const;
export const postgresPromotionRedemptionTableName =
  "promotion_redemption" as const;

export const postgresPromotionCampaign = pgTable(
  postgresPromotionCampaignTableName,
  {
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    description: text("description"),
    id: text("id").primaryKey(),
    metadataJson: jsonb("metadata_json")
      .$type<typeof PromotionMetadataSchema.Type>()
      .notNull(),
    name: text("name").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("promotion_campaign_created_at_idx").on(table.createdAt)]
);

export const postgresPromotion = pgTable(
  postgresPromotionTableName,
  {
    applicationMethodJson: jsonb("application_method_json")
      .$type<typeof PromotionApplicationMethodSchema.Type>()
      .notNull(),
    campaignId: text("campaign_id").references(
      () => postgresPromotionCampaign.id,
      { onDelete: "set null" }
    ),
    code: text("code"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    id: text("id").primaryKey(),
    metadataJson: jsonb("metadata_json")
      .$type<typeof PromotionMetadataSchema.Type>()
      .notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    status: text("status").notNull(),
    title: text("title").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("promotion_campaign_idx").on(table.campaignId),
    uniqueIndex("promotion_code_idx").on(table.code),
    index("promotion_created_at_idx").on(table.createdAt),
    index("promotion_status_idx").on(table.status),
  ]
);

export const postgresPromotionRule = pgTable(
  postgresPromotionRuleTableName,
  {
    attribute: text("attribute").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    id: text("id").primaryKey(),
    promotionId: text("promotion_id")
      .notNull()
      .references(() => postgresPromotion.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    value: text("value").notNull(),
  },
  (table) => [index("promotion_rule_promotion_idx").on(table.promotionId)]
);

export const postgresPromotionUsageLimit = pgTable(
  postgresPromotionUsageLimitTableName,
  {
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    id: text("id").primaryKey(),
    limit: integer("limit_value").notNull(),
    promotionId: text("promotion_id")
      .notNull()
      .references(() => postgresPromotion.id, { onDelete: "cascade" }),
    scope: text("scope").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("promotion_usage_limit_promotion_idx").on(table.promotionId),
  ]
);

export const postgresPromotionRedemption = pgTable(
  postgresPromotionRedemptionTableName,
  {
    adjustmentIdsJson: jsonb("adjustment_ids_json")
      .$type<readonly (typeof PromotionAdjustmentSerializedIdSchema.Type)[]>()
      .notNull(),
    cartId: text("cart_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    id: text("id").primaryKey(),
    promotionId: text("promotion_id")
      .notNull()
      .references(() => postgresPromotion.id, { onDelete: "cascade" }),
  },
  (table) => [index("promotion_redemption_promotion_idx").on(table.promotionId)]
);

export const PromotionCampaignPostgresRowSchema = createSelectSchema(
  postgresPromotionCampaign,
  {
    id: () => CampaignSerializedIdSchema,
    metadataJson: () => PromotionMetadataSchema,
    name: () => PromotionTrimmedStringSchema,
  }
);
export const PromotionCampaignPostgresInsertSchema = createInsertSchema(
  postgresPromotionCampaign,
  {
    id: () => CampaignSerializedIdSchema,
    metadataJson: () => PromotionMetadataSchema,
    name: () => PromotionTrimmedStringSchema,
  }
);

export const PromotionPostgresRowSchema = createSelectSchema(
  postgresPromotion,
  {
    applicationMethodJson: () => PromotionApplicationMethodSchema,
    campaignId: () => Schema.NullOr(CampaignSerializedIdSchema),
    code: () => Schema.NullOr(PromotionTrimmedStringSchema),
    id: () => PromotionSerializedIdSchema,
    metadataJson: () => PromotionMetadataSchema,
    status: () => PromotionStatusSchema,
    title: () => PromotionTrimmedStringSchema,
  }
);
export const PromotionPostgresInsertSchema = createInsertSchema(
  postgresPromotion,
  {
    applicationMethodJson: () => PromotionApplicationMethodSchema,
    campaignId: () => Schema.NullOr(CampaignSerializedIdSchema),
    code: () => Schema.NullOr(PromotionTrimmedStringSchema),
    id: () => PromotionSerializedIdSchema,
    metadataJson: () => PromotionMetadataSchema,
    status: () => PromotionStatusSchema,
    title: () => PromotionTrimmedStringSchema,
  }
);

export const PromotionRulePostgresRowSchema = createSelectSchema(
  postgresPromotionRule,
  {
    attribute: () => PromotionTrimmedStringSchema,
    id: () => PromotionRuleSerializedIdSchema,
    promotionId: () => PromotionSerializedIdSchema,
    value: () => PromotionTrimmedStringSchema,
  }
);
export const PromotionRulePostgresInsertSchema = createInsertSchema(
  postgresPromotionRule,
  {
    attribute: () => PromotionTrimmedStringSchema,
    id: () => PromotionRuleSerializedIdSchema,
    promotionId: () => PromotionSerializedIdSchema,
    value: () => PromotionTrimmedStringSchema,
  }
);

export const PromotionUsageLimitPostgresRowSchema = createSelectSchema(
  postgresPromotionUsageLimit,
  {
    id: () => PromotionUsageLimitSerializedIdSchema,
    promotionId: () => PromotionSerializedIdSchema,
    scope: () => PromotionUsageLimitScopeSchema,
  }
);
export const PromotionUsageLimitPostgresInsertSchema = createInsertSchema(
  postgresPromotionUsageLimit,
  {
    id: () => PromotionUsageLimitSerializedIdSchema,
    promotionId: () => PromotionSerializedIdSchema,
    scope: () => PromotionUsageLimitScopeSchema,
  }
);

export const PromotionRedemptionPostgresRowSchema = createSelectSchema(
  postgresPromotionRedemption,
  {
    adjustmentIdsJson: () =>
      Schema.Array(PromotionAdjustmentSerializedIdSchema),
    cartId: () => PromotionTrimmedStringSchema,
    id: () => PromotionRedemptionSerializedIdSchema,
    promotionId: () => PromotionSerializedIdSchema,
  }
);
export const PromotionRedemptionPostgresInsertSchema = createInsertSchema(
  postgresPromotionRedemption,
  {
    adjustmentIdsJson: () =>
      Schema.Array(PromotionAdjustmentSerializedIdSchema),
    cartId: () => PromotionTrimmedStringSchema,
    id: () => PromotionRedemptionSerializedIdSchema,
    promotionId: () => PromotionSerializedIdSchema,
  }
);

export type PromotionCampaignPostgresRow =
  typeof postgresPromotionCampaign.$inferSelect;
export type PromotionCampaignPostgresInsert =
  typeof postgresPromotionCampaign.$inferInsert;
export type PromotionPostgresRow = typeof postgresPromotion.$inferSelect;
export type PromotionPostgresInsert = typeof postgresPromotion.$inferInsert;
export type PromotionRulePostgresRow =
  typeof postgresPromotionRule.$inferSelect;
export type PromotionRulePostgresInsert =
  typeof postgresPromotionRule.$inferInsert;
export type PromotionUsageLimitPostgresRow =
  typeof postgresPromotionUsageLimit.$inferSelect;
export type PromotionUsageLimitPostgresInsert =
  typeof postgresPromotionUsageLimit.$inferInsert;
export type PromotionRedemptionPostgresRow =
  typeof postgresPromotionRedemption.$inferSelect;
export type PromotionRedemptionPostgresInsert =
  typeof postgresPromotionRedemption.$inferInsert;

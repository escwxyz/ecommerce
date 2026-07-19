import {
  StoreCurrencyCodeListSchema,
  StoreCurrencyCodeSchema,
  StoreMetadataSchema,
  StoreSerializedIdSchema,
  StoreTrimmedStringSchema,
} from "@ecommerce/store";
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-orm/effect-schema";
import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** PostgreSQL table name for the store module's singleton settings record. */
export const postgresStoreTableName = "store" as const;

/**
 * PostgreSQL Drizzle table owned by the store vertical slice.
 *
 * The store module remains runtime-neutral; this adapter-local table is the
 * PostgreSQL representation used by the `StoreRepositoryService` Layer.
 */
export const postgresStore = pgTable(
  postgresStoreTableName,
  {
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    defaultCurrencyCode: text("default_currency_code").notNull(),
    defaultLocale: text("default_locale").notNull(),
    defaultRegionId: text("default_region_id"),
    defaultSalesChannelId: text("default_sales_channel_id"),
    id: text("id").primaryKey(),
    metadataJson: jsonb("metadata_json")
      .$type<typeof StoreMetadataSchema.Type>()
      .notNull(),
    name: text("name").notNull(),
    supportedCurrencyCodesJson: jsonb("supported_currency_codes_json")
      .$type<typeof StoreCurrencyCodeListSchema.Type>()
      .notNull(),
    timezone: text("timezone").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("store_updated_at_idx").on(table.updatedAt),
    index("store_default_currency_idx").on(table.defaultCurrencyCode),
  ]
);

/** Effect Schema for selected PostgreSQL store rows. */
export const StorePostgresRowSchema = createSelectSchema(postgresStore, {
  defaultCurrencyCode: () => StoreCurrencyCodeSchema,
  defaultLocale: () => StoreTrimmedStringSchema,
  defaultRegionId: () => StoreTrimmedStringSchema,
  defaultSalesChannelId: () => StoreTrimmedStringSchema,
  id: () => StoreSerializedIdSchema,
  metadataJson: () => StoreMetadataSchema,
  name: () => StoreTrimmedStringSchema,
  supportedCurrencyCodesJson: () => StoreCurrencyCodeListSchema,
  timezone: () => StoreTrimmedStringSchema,
});

/** Effect Schema for PostgreSQL store inserts. */
export const StorePostgresInsertSchema = createInsertSchema(postgresStore, {
  defaultCurrencyCode: () => StoreCurrencyCodeSchema,
  defaultLocale: () => StoreTrimmedStringSchema,
  defaultRegionId: () => StoreTrimmedStringSchema,
  defaultSalesChannelId: () => StoreTrimmedStringSchema,
  id: () => StoreSerializedIdSchema,
  metadataJson: () => StoreMetadataSchema,
  name: () => StoreTrimmedStringSchema,
  supportedCurrencyCodesJson: () => StoreCurrencyCodeListSchema,
  timezone: () => StoreTrimmedStringSchema,
});

/** Effect Schema for PostgreSQL store updates. */
export const StorePostgresUpdateSchema = createUpdateSchema(postgresStore, {
  defaultCurrencyCode: () => StoreCurrencyCodeSchema,
  defaultLocale: () => StoreTrimmedStringSchema,
  defaultRegionId: () => StoreTrimmedStringSchema,
  defaultSalesChannelId: () => StoreTrimmedStringSchema,
  id: () => StoreSerializedIdSchema,
  metadataJson: () => StoreMetadataSchema,
  name: () => StoreTrimmedStringSchema,
  supportedCurrencyCodesJson: () => StoreCurrencyCodeListSchema,
  timezone: () => StoreTrimmedStringSchema,
});

export type StorePostgresRow = typeof StorePostgresRowSchema.Type;
export type StorePostgresInsert = typeof StorePostgresInsertSchema.Type;
export type StorePostgresUpdate = typeof StorePostgresUpdateSchema.Type;

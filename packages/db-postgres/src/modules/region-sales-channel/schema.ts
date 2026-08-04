import {
  MetadataSchema,
  RegionCountryCodeSchema,
  RegionCurrencyCodeSchema,
  RegionSalesChannelTrimmedStringSchema,
  RegionSerializedIdSchema,
  SalesChannelSerializedIdSchema,
  SalesChannelStatusSchema,
} from "@ecommerce/region-sales-channel";
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-orm/effect-schema";
import {
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { Schema } from "effect";

export const postgresRegionTableName = "region" as const;
export const postgresRegionCountryTableName = "region_country" as const;
export const postgresSalesChannelTableName = "sales_channel" as const;
export const postgresSalesChannelProductTableName =
  "sales_channel_product" as const;

export const postgresRegion = pgTable(
  postgresRegionTableName,
  {
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    currencyCode: text("currency_code").notNull(),
    fulfillmentOptionIdsJson: jsonb("fulfillment_option_ids_json")
      .$type<readonly string[]>()
      .notNull(),
    id: text("id").primaryKey(),
    metadataJson: jsonb("metadata_json")
      .$type<typeof MetadataSchema.Type>()
      .notNull(),
    name: text("name").notNull(),
    paymentProviderIdsJson: jsonb("payment_provider_ids_json")
      .$type<readonly string[]>()
      .notNull(),
    taxProviderId: text("tax_provider_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("region_currency_idx").on(table.currencyCode),
    index("region_created_at_idx").on(table.createdAt),
  ]
);

export const postgresRegionCountry = pgTable(
  postgresRegionCountryTableName,
  {
    countryCode: text("country_code").notNull(),
    regionId: text("region_id")
      .notNull()
      .references(() => postgresRegion.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.regionId, table.countryCode] }),
    index("region_country_region_idx").on(table.regionId),
  ]
);

export const postgresSalesChannel = pgTable(
  postgresSalesChannelTableName,
  {
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    description: text("description"),
    id: text("id").primaryKey(),
    metadataJson: jsonb("metadata_json")
      .$type<typeof MetadataSchema.Type>()
      .notNull(),
    name: text("name").notNull(),
    status: text("status").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("sales_channel_created_at_idx").on(table.createdAt),
    index("sales_channel_status_idx").on(table.status),
  ]
);

export const postgresSalesChannelProduct = pgTable(
  postgresSalesChannelProductTableName,
  {
    productId: text("product_id").notNull(),
    salesChannelId: text("sales_channel_id")
      .notNull()
      .references(() => postgresSalesChannel.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.salesChannelId, table.productId] }),
    index("sales_channel_product_channel_idx").on(table.salesChannelId),
  ]
);

export const RegionPostgresRowSchema = createSelectSchema(postgresRegion, {
  currencyCode: () => RegionCurrencyCodeSchema,
  fulfillmentOptionIdsJson: () =>
    Schema.Array(RegionSalesChannelTrimmedStringSchema),
  id: () => RegionSerializedIdSchema,
  metadataJson: () => MetadataSchema,
  name: () => RegionSalesChannelTrimmedStringSchema,
  paymentProviderIdsJson: () =>
    Schema.Array(RegionSalesChannelTrimmedStringSchema),
  taxProviderId: () => RegionSalesChannelTrimmedStringSchema,
});

export const RegionPostgresInsertSchema = createInsertSchema(postgresRegion, {
  currencyCode: () => RegionCurrencyCodeSchema,
  fulfillmentOptionIdsJson: () =>
    Schema.Array(RegionSalesChannelTrimmedStringSchema),
  id: () => RegionSerializedIdSchema,
  metadataJson: () => MetadataSchema,
  name: () => RegionSalesChannelTrimmedStringSchema,
  paymentProviderIdsJson: () =>
    Schema.Array(RegionSalesChannelTrimmedStringSchema),
  taxProviderId: () => RegionSalesChannelTrimmedStringSchema,
});

export const RegionPostgresUpdateSchema = createUpdateSchema(postgresRegion, {
  currencyCode: () => RegionCurrencyCodeSchema,
  fulfillmentOptionIdsJson: () =>
    Schema.Array(RegionSalesChannelTrimmedStringSchema),
  id: () => RegionSerializedIdSchema,
  metadataJson: () => MetadataSchema,
  name: () => RegionSalesChannelTrimmedStringSchema,
  paymentProviderIdsJson: () =>
    Schema.Array(RegionSalesChannelTrimmedStringSchema),
  taxProviderId: () => RegionSalesChannelTrimmedStringSchema,
});

export const RegionCountryPostgresRowSchema = createSelectSchema(
  postgresRegionCountry,
  {
    countryCode: () => RegionCountryCodeSchema,
    regionId: () => RegionSerializedIdSchema,
  }
);

export const RegionCountryPostgresInsertSchema = createInsertSchema(
  postgresRegionCountry,
  {
    countryCode: () => RegionCountryCodeSchema,
    regionId: () => RegionSerializedIdSchema,
  }
);

export const SalesChannelPostgresRowSchema = createSelectSchema(
  postgresSalesChannel,
  {
    description: () => RegionSalesChannelTrimmedStringSchema,
    id: () => SalesChannelSerializedIdSchema,
    metadataJson: () => MetadataSchema,
    name: () => RegionSalesChannelTrimmedStringSchema,
    status: () => SalesChannelStatusSchema,
  }
);

export const SalesChannelPostgresInsertSchema = createInsertSchema(
  postgresSalesChannel,
  {
    description: () => RegionSalesChannelTrimmedStringSchema,
    id: () => SalesChannelSerializedIdSchema,
    metadataJson: () => MetadataSchema,
    name: () => RegionSalesChannelTrimmedStringSchema,
    status: () => SalesChannelStatusSchema,
  }
);

export const SalesChannelPostgresUpdateSchema = createUpdateSchema(
  postgresSalesChannel,
  {
    description: () => RegionSalesChannelTrimmedStringSchema,
    id: () => SalesChannelSerializedIdSchema,
    metadataJson: () => MetadataSchema,
    name: () => RegionSalesChannelTrimmedStringSchema,
    status: () => SalesChannelStatusSchema,
  }
);

export const SalesChannelProductPostgresRowSchema = createSelectSchema(
  postgresSalesChannelProduct,
  {
    productId: () => RegionSalesChannelTrimmedStringSchema,
    salesChannelId: () => SalesChannelSerializedIdSchema,
  }
);

export const SalesChannelProductPostgresInsertSchema = createInsertSchema(
  postgresSalesChannelProduct,
  {
    productId: () => RegionSalesChannelTrimmedStringSchema,
    salesChannelId: () => SalesChannelSerializedIdSchema,
  }
);

export type RegionPostgresRow = typeof RegionPostgresRowSchema.Type;
export type RegionPostgresInsert = typeof RegionPostgresInsertSchema.Type;
export type RegionPostgresUpdate = typeof RegionPostgresUpdateSchema.Type;
export type RegionCountryPostgresRow =
  typeof RegionCountryPostgresRowSchema.Type;
export type RegionCountryPostgresInsert =
  typeof RegionCountryPostgresInsertSchema.Type;
export type SalesChannelPostgresRow = typeof SalesChannelPostgresRowSchema.Type;
export type SalesChannelPostgresInsert =
  typeof SalesChannelPostgresInsertSchema.Type;
export type SalesChannelPostgresUpdate =
  typeof SalesChannelPostgresUpdateSchema.Type;
export type SalesChannelProductPostgresRow =
  typeof SalesChannelProductPostgresRowSchema.Type;
export type SalesChannelProductPostgresInsert =
  typeof SalesChannelProductPostgresInsertSchema.Type;

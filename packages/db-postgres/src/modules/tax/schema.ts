import {
  TaxCategorySerializedIdSchema,
  TaxCountryCodeSchema,
  TaxMetadataSchema,
  TaxPercentageSchema,
  TaxProviderConfigSerializedIdSchema,
  TaxProviderSettingsSchema,
  TaxRateSerializedIdSchema,
  TaxRegionSerializedIdSchema,
  TaxTrimmedStringSchema,
} from "@ecommerce/tax";
import {
  createInsertSchema,
  createSelectSchema,
} from "drizzle-orm/effect-schema";
import {
  index,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { Schema } from "effect";

export const postgresTaxCategoryTableName = "tax_category" as const;
export const postgresTaxProviderConfigTableName =
  "tax_provider_config" as const;
export const postgresTaxRegionTableName = "tax_region" as const;
export const postgresTaxRateTableName = "tax_rate" as const;

export const postgresTaxCategory = pgTable(
  postgresTaxCategoryTableName,
  {
    code: text("code").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    description: text("description"),
    id: text("id").primaryKey(),
    metadataJson: jsonb("metadata_json")
      .$type<typeof TaxMetadataSchema.Type>()
      .notNull(),
    name: text("name").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("tax_category_code_idx").on(table.code)]
);

export const postgresTaxProviderConfig = pgTable(
  postgresTaxProviderConfigTableName,
  {
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    id: text("id").primaryKey(),
    isActive: text("is_active").notNull(),
    metadataJson: jsonb("metadata_json")
      .$type<typeof TaxMetadataSchema.Type>()
      .notNull(),
    providerKey: text("provider_key").notNull(),
    settingsJson: jsonb("settings_json")
      .$type<typeof TaxProviderSettingsSchema.Type>()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("tax_provider_config_key_idx").on(table.providerKey)]
);

export const postgresTaxRegion = pgTable(
  postgresTaxRegionTableName,
  {
    code: text("code").notNull(),
    countryCode: text("country_code").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    id: text("id").primaryKey(),
    metadataJson: jsonb("metadata_json")
      .$type<typeof TaxMetadataSchema.Type>()
      .notNull(),
    name: text("name").notNull(),
    providerConfigId: text("provider_config_id").references(
      () => postgresTaxProviderConfig.id,
      { onDelete: "set null" }
    ),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("tax_region_code_idx").on(table.code)]
);

export const postgresTaxRate = pgTable(
  postgresTaxRateTableName,
  {
    categoryId: text("category_id").references(() => postgresTaxCategory.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    id: text("id").primaryKey(),
    metadataJson: jsonb("metadata_json")
      .$type<typeof TaxMetadataSchema.Type>()
      .notNull(),
    name: text("name").notNull(),
    percentage: real("percentage").notNull(),
    regionId: text("region_id")
      .notNull()
      .references(() => postgresTaxRegion.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("tax_rate_region_idx").on(table.regionId),
    index("tax_rate_category_idx").on(table.categoryId),
  ]
);

export const TaxCategoryPostgresRowSchema = createSelectSchema(
  postgresTaxCategory,
  {
    code: () => TaxTrimmedStringSchema,
    id: () => TaxCategorySerializedIdSchema,
    metadataJson: () => TaxMetadataSchema,
    name: () => TaxTrimmedStringSchema,
  }
);
export const TaxCategoryPostgresInsertSchema = createInsertSchema(
  postgresTaxCategory,
  {
    code: () => TaxTrimmedStringSchema,
    id: () => TaxCategorySerializedIdSchema,
    metadataJson: () => TaxMetadataSchema,
    name: () => TaxTrimmedStringSchema,
  }
);

export const TaxProviderConfigPostgresRowSchema = createSelectSchema(
  postgresTaxProviderConfig,
  {
    id: () => TaxProviderConfigSerializedIdSchema,
    isActive: () => Schema.Literals(["true", "false"]),
    metadataJson: () => TaxMetadataSchema,
    providerKey: () => TaxTrimmedStringSchema,
    settingsJson: () => TaxProviderSettingsSchema,
  }
);
export const TaxProviderConfigPostgresInsertSchema = createInsertSchema(
  postgresTaxProviderConfig,
  {
    id: () => TaxProviderConfigSerializedIdSchema,
    isActive: () => Schema.Literals(["true", "false"]),
    metadataJson: () => TaxMetadataSchema,
    providerKey: () => TaxTrimmedStringSchema,
    settingsJson: () => TaxProviderSettingsSchema,
  }
);

export const TaxRegionPostgresRowSchema = createSelectSchema(
  postgresTaxRegion,
  {
    code: () => TaxTrimmedStringSchema,
    countryCode: () => TaxCountryCodeSchema,
    id: () => TaxRegionSerializedIdSchema,
    metadataJson: () => TaxMetadataSchema,
    name: () => TaxTrimmedStringSchema,
    providerConfigId: () => Schema.NullOr(TaxProviderConfigSerializedIdSchema),
  }
);
export const TaxRegionPostgresInsertSchema = createInsertSchema(
  postgresTaxRegion,
  {
    code: () => TaxTrimmedStringSchema,
    countryCode: () => TaxCountryCodeSchema,
    id: () => TaxRegionSerializedIdSchema,
    metadataJson: () => TaxMetadataSchema,
    name: () => TaxTrimmedStringSchema,
    providerConfigId: () => Schema.NullOr(TaxProviderConfigSerializedIdSchema),
  }
);

export const TaxRatePostgresRowSchema = createSelectSchema(postgresTaxRate, {
  categoryId: () => Schema.NullOr(TaxCategorySerializedIdSchema),
  id: () => TaxRateSerializedIdSchema,
  metadataJson: () => TaxMetadataSchema,
  name: () => TaxTrimmedStringSchema,
  percentage: () => TaxPercentageSchema,
  regionId: () => TaxRegionSerializedIdSchema,
});
export const TaxRatePostgresInsertSchema = createInsertSchema(postgresTaxRate, {
  categoryId: () => Schema.NullOr(TaxCategorySerializedIdSchema),
  id: () => TaxRateSerializedIdSchema,
  metadataJson: () => TaxMetadataSchema,
  name: () => TaxTrimmedStringSchema,
  percentage: () => TaxPercentageSchema,
  regionId: () => TaxRegionSerializedIdSchema,
});

export type TaxCategoryPostgresRow = typeof TaxCategoryPostgresRowSchema.Type;
export type TaxCategoryPostgresInsert =
  typeof TaxCategoryPostgresInsertSchema.Type;
export type TaxProviderConfigPostgresRow =
  typeof TaxProviderConfigPostgresRowSchema.Type;
export type TaxProviderConfigPostgresInsert =
  typeof TaxProviderConfigPostgresInsertSchema.Type;
export type TaxRegionPostgresRow = typeof TaxRegionPostgresRowSchema.Type;
export type TaxRegionPostgresInsert = typeof TaxRegionPostgresInsertSchema.Type;
export type TaxRatePostgresRow = typeof TaxRatePostgresRowSchema.Type;
export type TaxRatePostgresInsert = typeof TaxRatePostgresInsertSchema.Type;

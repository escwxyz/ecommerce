import {
  ProductCatalogSchema,
  ProductMetadataSchema,
  ProductSerializedIdSchema,
  ProductStatusSchema,
  ProductTrimmedStringSchema,
} from "@ecommerce/product";
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-orm/effect-schema";
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** PostgreSQL table name for product catalog records. */
export const postgresProductTableName = "product" as const;

/**
 * PostgreSQL Drizzle table owned by the product vertical slice.
 *
 * Product catalog structure remains validated by Effect Schema in
 * `@ecommerce/product`; this adapter persists the current catalog snapshot as
 * JSONB so future product substructure changes do not leak Drizzle shapes into
 * the runtime-neutral module.
 */
export const postgresProduct = pgTable(
  postgresProductTableName,
  {
    catalogJson: jsonb("catalog_json")
      .$type<typeof ProductCatalogSchema.Type>()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    handle: text("handle").notNull(),
    id: text("id").primaryKey(),
    metadataJson: jsonb("metadata_json")
      .$type<typeof ProductMetadataSchema.Type>()
      .notNull(),
    status: text("status").notNull(),
    title: text("title").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("product_handle_idx").on(table.handle),
    index("product_created_at_idx").on(table.createdAt),
    index("product_status_idx").on(table.status),
  ]
);

/** Effect Schema for selected PostgreSQL product rows. */
export const ProductPostgresRowSchema = createSelectSchema(postgresProduct, {
  catalogJson: () => ProductCatalogSchema,
  handle: () => ProductTrimmedStringSchema,
  id: () => ProductSerializedIdSchema,
  metadataJson: () => ProductMetadataSchema,
  status: () => ProductStatusSchema,
  title: () => ProductTrimmedStringSchema,
});

/** Effect Schema for PostgreSQL product inserts. */
export const ProductPostgresInsertSchema = createInsertSchema(postgresProduct, {
  catalogJson: () => ProductCatalogSchema,
  handle: () => ProductTrimmedStringSchema,
  id: () => ProductSerializedIdSchema,
  metadataJson: () => ProductMetadataSchema,
  status: () => ProductStatusSchema,
  title: () => ProductTrimmedStringSchema,
});

/** Effect Schema for PostgreSQL product updates. */
export const ProductPostgresUpdateSchema = createUpdateSchema(postgresProduct, {
  catalogJson: () => ProductCatalogSchema,
  handle: () => ProductTrimmedStringSchema,
  id: () => ProductSerializedIdSchema,
  metadataJson: () => ProductMetadataSchema,
  status: () => ProductStatusSchema,
  title: () => ProductTrimmedStringSchema,
});

export type ProductPostgresRow = typeof ProductPostgresRowSchema.Type;
export type ProductPostgresInsert = typeof ProductPostgresInsertSchema.Type;
export type ProductPostgresUpdate = typeof ProductPostgresUpdateSchema.Type;

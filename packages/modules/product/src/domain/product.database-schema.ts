import type {
  ColumnType,
  Insertable,
  Kysely,
  Migration,
  Selectable,
} from "kysely";

export const productTableName = "product" as const;
export const productVariantTableName = "product_variant" as const;
export const productOptionTableName = "product_option" as const;
export const productOptionValueTableName = "product_option_value" as const;
export const productVariantOptionTableName = "product_variant_option" as const;
export const productCollectionTableName = "product_collection" as const;
export const productCollectionProductTableName =
  "product_collection_product" as const;
export const productCategoryTableName = "product_category" as const;
export const productCategoryProductTableName =
  "product_category_product" as const;
export const productMediaTableName = "product_media" as const;
export const productTagTableName = "product_tag" as const;
export const productTagsTableName = "product_tags" as const;
export const productTypeTableName = "product_type" as const;
export const productTypeProductTableName = "product_type_product" as const;
export const productHandleIndexName = "product_handle_idx" as const;
export const productVariantProductIndexName =
  "product_variant_product_id_idx" as const;
export const productOptionProductTitleIndexName =
  "product_option_product_id_title_idx" as const;
export const productOptionValueOptionIndexName =
  "product_option_value_option_id_value_idx" as const;
export const productCollectionHandleIndexName =
  "product_collection_handle_idx" as const;
export const productCategoryHandleIndexName =
  "product_category_handle_idx" as const;
export const productTagValueIndexName = "product_tag_value_idx" as const;
export const productTypeValueIndexName = "product_type_value_idx" as const;

type TimestampMsColumn = ColumnType<number, number, number>;
type NullableTimestampMsColumn = ColumnType<
  number | null,
  number | null,
  number | null
>;

/**
 * Kysely table type for product primary storage.
 *
 * The product module owns the normalized catalog tables. Concrete adapters
 * reuse these table builders through shared database assembly instead of
 * redefining product, variant, option, collection, category, media, tag, and
 * type storage for each runtime.
 */
export interface ProductTable {
  catalog_metadata: string;
  catalog_published_at: NullableTimestampMsColumn;
  catalog_searchable_text: string;
  created_at: TimestampMsColumn;
  handle: string;
  id: string;
  status: string;
  title: string;
  updated_at: TimestampMsColumn;
}

export interface ProductVariantTable {
  id: string;
  metadata: string;
  option_value_ids: string;
  product_id: string;
  searchable_text: string | null;
  sku: string | null;
  status: string;
  title: string;
}

export interface ProductOptionTable {
  id: string;
  metadata: string;
  product_id: string;
  title: string;
}

export interface ProductOptionValueTable {
  id: string;
  label: string;
  metadata: string;
  option_id: string;
  value: string;
}

export interface ProductVariantOptionTable {
  option_value_id: string;
  variant_id: string;
}

export interface ProductCollectionTable {
  handle: string;
  id: string;
  title: string;
}

export interface ProductCollectionProductTable {
  product_collection_id: string;
  product_id: string;
}

export interface ProductCategoryTable {
  handle: string;
  id: string;
  parent_id: string | null;
  title: string;
}

export interface ProductCategoryProductTable {
  product_category_id: string;
  product_id: string;
}

export interface ProductMediaTable {
  alt_text: string | null;
  id: string;
  metadata: string;
  product_id: string;
  type: string;
  url: string;
}

export interface ProductTagTable {
  id: string;
  value: string;
}

export interface ProductTagsTable {
  product_id: string;
  product_tag_id: string;
}

export interface ProductTypeTable {
  id: string;
  value: string;
}

export interface ProductTypeProductTable {
  product_id: string;
  product_type_id: string;
}

export interface ProductDatabase {
  product: ProductTable;
  product_category: ProductCategoryTable;
  product_category_product: ProductCategoryProductTable;
  product_collection: ProductCollectionTable;
  product_collection_product: ProductCollectionProductTable;
  product_media: ProductMediaTable;
  product_option: ProductOptionTable;
  product_option_value: ProductOptionValueTable;
  product_tag: ProductTagTable;
  product_tags: ProductTagsTable;
  product_type: ProductTypeTable;
  product_type_product: ProductTypeProductTable;
  product_variant: ProductVariantTable;
  product_variant_option: ProductVariantOptionTable;
}

export const productSchema = {
  product: productTableName,
  productCategory: productCategoryTableName,
  productCategoryProduct: productCategoryProductTableName,
  productCollection: productCollectionTableName,
  productCollectionProduct: productCollectionProductTableName,
  productMedia: productMediaTableName,
  productOption: productOptionTableName,
  productOptionValue: productOptionValueTableName,
  productTag: productTagTableName,
  productTags: productTagsTableName,
  productType: productTypeTableName,
  productTypeProduct: productTypeProductTableName,
  productVariant: productVariantTableName,
  productVariantOption: productVariantOptionTableName,
} as const;

export type ProductRow = Selectable<ProductTable>;
export type ProductVariantRow = Selectable<ProductVariantTable>;
export type ProductOptionRow = Selectable<ProductOptionTable>;
export type ProductOptionValueRow = Selectable<ProductOptionValueTable>;
export type ProductCollectionRow = Selectable<ProductCollectionTable>;
export type ProductCategoryRow = Selectable<ProductCategoryTable>;
export type ProductMediaRow = Selectable<ProductMediaTable>;
export type ProductTagRow = Selectable<ProductTagTable>;
export type ProductInsert = Insertable<ProductTable>;
export type ProductDatabaseSchema = ProductDatabase;
export type ProductSchemaKey = keyof ProductDatabase;

const dropProductCatalogTables = async (db: Kysely<unknown>): Promise<void> => {
  await db.schema.dropTable(productTypeProductTableName).ifExists().execute();
  await db.schema.dropTable(productTagsTableName).ifExists().execute();
  await db.schema
    .dropTable(productCategoryProductTableName)
    .ifExists()
    .execute();
  await db.schema
    .dropTable(productCollectionProductTableName)
    .ifExists()
    .execute();
  await db.schema.dropTable(productVariantOptionTableName).ifExists().execute();
  await db.schema.dropTable(productMediaTableName).ifExists().execute();
  await db.schema.dropTable(productOptionValueTableName).ifExists().execute();
  await db.schema.dropTable(productOptionTableName).ifExists().execute();
  await db.schema.dropTable(productVariantTableName).ifExists().execute();
  await db.schema.dropTable(productTypeTableName).ifExists().execute();
  await db.schema.dropTable(productTagTableName).ifExists().execute();
  await db.schema.dropTable(productCategoryTableName).ifExists().execute();
  await db.schema.dropTable(productCollectionTableName).ifExists().execute();
};

const createProductCatalogTables = async (
  db: Kysely<unknown>
): Promise<void> => {
  await db.schema
    .createTable(productVariantTableName)
    .ifNotExists()
    .addColumn("id", "text", (column) => column.primaryKey())
    .addColumn("product_id", "text", (column) =>
      column.notNull().references(`${productTableName}.id`).onDelete("cascade")
    )
    .addColumn("title", "text", (column) => column.notNull())
    .addColumn("sku", "text")
    .addColumn("status", "text", (column) => column.notNull())
    .addColumn("option_value_ids", "text", (column) => column.notNull())
    .addColumn("searchable_text", "text")
    .addColumn("metadata", "text", (column) => column.notNull())
    .execute();

  await db.schema
    .createIndex(productVariantProductIndexName)
    .ifNotExists()
    .on(productVariantTableName)
    .column("product_id")
    .execute();

  await db.schema
    .createTable(productOptionTableName)
    .ifNotExists()
    .addColumn("id", "text", (column) => column.primaryKey())
    .addColumn("product_id", "text", (column) =>
      column.notNull().references(`${productTableName}.id`).onDelete("cascade")
    )
    .addColumn("title", "text", (column) => column.notNull())
    .addColumn("metadata", "text", (column) => column.notNull())
    .execute();

  await db.schema
    .createIndex(productOptionProductTitleIndexName)
    .ifNotExists()
    .unique()
    .on(productOptionTableName)
    .columns(["product_id", "title"])
    .execute();

  await db.schema
    .createTable(productOptionValueTableName)
    .ifNotExists()
    .addColumn("id", "text", (column) => column.primaryKey())
    .addColumn("option_id", "text", (column) =>
      column
        .notNull()
        .references(`${productOptionTableName}.id`)
        .onDelete("cascade")
    )
    .addColumn("label", "text", (column) => column.notNull())
    .addColumn("value", "text", (column) => column.notNull())
    .addColumn("metadata", "text", (column) => column.notNull())
    .execute();

  await db.schema
    .createIndex(productOptionValueOptionIndexName)
    .ifNotExists()
    .unique()
    .on(productOptionValueTableName)
    .columns(["option_id", "value"])
    .execute();

  await db.schema
    .createTable(productVariantOptionTableName)
    .ifNotExists()
    .addColumn("variant_id", "text", (column) =>
      column
        .notNull()
        .references(`${productVariantTableName}.id`)
        .onDelete("cascade")
    )
    .addColumn("option_value_id", "text", (column) =>
      column
        .notNull()
        .references(`${productOptionValueTableName}.id`)
        .onDelete("cascade")
    )
    .addPrimaryKeyConstraint("product_variant_option_pk", [
      "variant_id",
      "option_value_id",
    ])
    .execute();

  await db.schema
    .createTable(productCollectionTableName)
    .ifNotExists()
    .addColumn("id", "text", (column) => column.primaryKey())
    .addColumn("handle", "text", (column) => column.notNull())
    .addColumn("title", "text", (column) => column.notNull())
    .execute();

  await db.schema
    .createIndex(productCollectionHandleIndexName)
    .ifNotExists()
    .unique()
    .on(productCollectionTableName)
    .column("handle")
    .execute();

  await db.schema
    .createTable(productCollectionProductTableName)
    .ifNotExists()
    .addColumn("product_id", "text", (column) =>
      column.notNull().references(`${productTableName}.id`).onDelete("cascade")
    )
    .addColumn("product_collection_id", "text", (column) =>
      column
        .notNull()
        .references(`${productCollectionTableName}.id`)
        .onDelete("cascade")
    )
    .addPrimaryKeyConstraint("product_collection_product_pk", [
      "product_id",
      "product_collection_id",
    ])
    .execute();

  await db.schema
    .createTable(productCategoryTableName)
    .ifNotExists()
    .addColumn("id", "text", (column) => column.primaryKey())
    .addColumn("handle", "text", (column) => column.notNull())
    .addColumn("title", "text", (column) => column.notNull())
    .addColumn("parent_id", "text")
    .execute();

  await db.schema
    .createIndex(productCategoryHandleIndexName)
    .ifNotExists()
    .unique()
    .on(productCategoryTableName)
    .column("handle")
    .execute();

  await db.schema
    .createTable(productCategoryProductTableName)
    .ifNotExists()
    .addColumn("product_id", "text", (column) =>
      column.notNull().references(`${productTableName}.id`).onDelete("cascade")
    )
    .addColumn("product_category_id", "text", (column) =>
      column
        .notNull()
        .references(`${productCategoryTableName}.id`)
        .onDelete("cascade")
    )
    .addPrimaryKeyConstraint("product_category_product_pk", [
      "product_id",
      "product_category_id",
    ])
    .execute();

  await db.schema
    .createTable(productMediaTableName)
    .ifNotExists()
    .addColumn("id", "text", (column) => column.primaryKey())
    .addColumn("product_id", "text", (column) =>
      column.notNull().references(`${productTableName}.id`).onDelete("cascade")
    )
    .addColumn("url", "text", (column) => column.notNull())
    .addColumn("type", "text", (column) => column.notNull())
    .addColumn("alt_text", "text")
    .addColumn("metadata", "text", (column) => column.notNull())
    .execute();

  await db.schema
    .createTable(productTagTableName)
    .ifNotExists()
    .addColumn("id", "text", (column) => column.primaryKey())
    .addColumn("value", "text", (column) => column.notNull())
    .execute();

  await db.schema
    .createIndex(productTagValueIndexName)
    .ifNotExists()
    .unique()
    .on(productTagTableName)
    .column("value")
    .execute();

  await db.schema
    .createTable(productTagsTableName)
    .ifNotExists()
    .addColumn("product_id", "text", (column) =>
      column.notNull().references(`${productTableName}.id`).onDelete("cascade")
    )
    .addColumn("product_tag_id", "text", (column) =>
      column
        .notNull()
        .references(`${productTagTableName}.id`)
        .onDelete("cascade")
    )
    .addPrimaryKeyConstraint("product_tags_pk", [
      "product_id",
      "product_tag_id",
    ])
    .execute();

  await db.schema
    .createTable(productTypeTableName)
    .ifNotExists()
    .addColumn("id", "text", (column) => column.primaryKey())
    .addColumn("value", "text", (column) => column.notNull())
    .execute();

  await db.schema
    .createIndex(productTypeValueIndexName)
    .ifNotExists()
    .unique()
    .on(productTypeTableName)
    .column("value")
    .execute();

  await db.schema
    .createTable(productTypeProductTableName)
    .ifNotExists()
    .addColumn("product_id", "text", (column) =>
      column.notNull().references(`${productTableName}.id`).onDelete("cascade")
    )
    .addColumn("product_type_id", "text", (column) =>
      column
        .notNull()
        .references(`${productTypeTableName}.id`)
        .onDelete("cascade")
    )
    .addPrimaryKeyConstraint("product_type_product_pk", [
      "product_id",
      "product_type_id",
    ])
    .execute();
};

export const productMigration: Migration = {
  down: async (db: Kysely<unknown>) => {
    await db.schema.dropTable(productTableName).ifExists().execute();
  },
  up: async (db: Kysely<unknown>) => {
    await db.schema
      .createTable(productTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("handle", "text", (column) => column.notNull())
      .addColumn("title", "text", (column) => column.notNull())
      .addColumn("status", "text", (column) => column.notNull())
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex(productHandleIndexName)
      .ifNotExists()
      .unique()
      .on(productTableName)
      .column("handle")
      .execute();
  },
};

export const productCatalogMigration: Migration = {
  down: async (db: Kysely<unknown>) => {
    await dropProductCatalogTables(db);
    await db.schema
      .alterTable(productTableName)
      .dropColumn("catalog_published_at")
      .execute();
    await db.schema
      .alterTable(productTableName)
      .dropColumn("catalog_searchable_text")
      .execute();
    await db.schema
      .alterTable(productTableName)
      .dropColumn("catalog_metadata")
      .execute();
  },
  up: async (db: Kysely<unknown>) => {
    await db.schema
      .alterTable(productTableName)
      .addColumn("catalog_metadata", "text", (column) =>
        column.notNull().defaultTo("{}")
      )
      .execute();
    await db.schema
      .alterTable(productTableName)
      .addColumn("catalog_searchable_text", "text", (column) =>
        column.notNull().defaultTo("")
      )
      .execute();
    await db.schema
      .alterTable(productTableName)
      .addColumn("catalog_published_at", "integer")
      .execute();

    await createProductCatalogTables(db);
  },
};

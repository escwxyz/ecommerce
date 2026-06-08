import type { AnyColumn, Insertable, Kysely } from "kysely";

import type {
  ProductCategoryRow,
  ProductCollectionRow,
  ProductDatabase,
  ProductMediaRow,
  ProductOptionRow,
  ProductOptionValueRow,
  ProductRecord,
  ProductRepository,
  ProductRow,
  ProductTagRow,
  ProductVariantRow,
} from "../../domain";
import {
  ProductCatalogSchema,
  ProductStatusSchema,
  createProductId,
} from "../../domain";

export type ProductD1Database = Kysely<ProductDatabase>;

export interface CreateD1ProductRepositoryOptions {
  readonly db: ProductD1Database;
}

const PRODUCT_HANDLE_UNIQUE_CONSTRAINT =
  "UNIQUE constraint failed: product.handle";

const isDuplicateProductHandleError = (error: unknown): boolean =>
  error instanceof Error &&
  error.message.includes(PRODUCT_HANDLE_UNIQUE_CONSTRAINT);

const parseJsonColumn = <Value>(value: string): Value => JSON.parse(value);
const toJsonColumn = (value: unknown): string => JSON.stringify(value);

const insertValues = async <Table extends keyof ProductDatabase>(
  db: ProductD1Database,
  table: Table,
  values: readonly Insertable<ProductDatabase[Table]>[]
): Promise<void> => {
  if (values.length === 0) {
    return;
  }

  await db.insertInto(table).values(values).execute();
};

const insertValuesIgnoringConflicts = async <
  Table extends keyof ProductDatabase,
>(
  db: ProductD1Database,
  table: Table,
  values: readonly Insertable<ProductDatabase[Table]>[],
  conflictColumn: AnyColumn<ProductDatabase, Table>
): Promise<void> => {
  if (values.length === 0) {
    return;
  }

  await db
    .insertInto(table)
    .values(values)
    .onConflict((conflict) => conflict.column(conflictColumn).doNothing())
    .execute();
};

const selectProductCatalog = async (
  db: ProductD1Database,
  productId: string,
  productRow: ProductRow
) => {
  const [
    optionRows,
    optionValueRows,
    variantRows,
    collectionRows,
    categoryRows,
    mediaRows,
    tagRows,
    variantOptionRows,
  ] = await Promise.all([
    db
      .selectFrom("product_option")
      .selectAll()
      .where("product_id", "=", productId)
      .execute(),
    db
      .selectFrom("product_option_value")
      .innerJoin(
        "product_option",
        "product_option.id",
        "product_option_value.option_id"
      )
      .select([
        "product_option_value.id",
        "product_option_value.label",
        "product_option_value.metadata",
        "product_option_value.option_id",
        "product_option_value.value",
      ])
      .where("product_option.product_id", "=", productId)
      .execute(),
    db
      .selectFrom("product_variant")
      .selectAll()
      .where("product_id", "=", productId)
      .execute(),
    db
      .selectFrom("product_collection")
      .innerJoin(
        "product_collection_product",
        "product_collection.id",
        "product_collection_product.product_collection_id"
      )
      .select([
        "product_collection.handle",
        "product_collection.id",
        "product_collection.title",
      ])
      .where("product_collection_product.product_id", "=", productId)
      .execute(),
    db
      .selectFrom("product_category")
      .innerJoin(
        "product_category_product",
        "product_category.id",
        "product_category_product.product_category_id"
      )
      .select([
        "product_category.handle",
        "product_category.id",
        "product_category.parent_id",
        "product_category.title",
      ])
      .where("product_category_product.product_id", "=", productId)
      .execute(),
    db
      .selectFrom("product_media")
      .selectAll()
      .where("product_id", "=", productId)
      .execute(),
    db
      .selectFrom("product_tag")
      .innerJoin(
        "product_tags",
        "product_tag.id",
        "product_tags.product_tag_id"
      )
      .select(["product_tag.id", "product_tag.value"])
      .where("product_tags.product_id", "=", productId)
      .execute(),
    db
      .selectFrom("product_variant_option")
      .innerJoin(
        "product_variant",
        "product_variant.id",
        "product_variant_option.variant_id"
      )
      .select([
        "product_variant_option.option_value_id",
        "product_variant_option.variant_id",
      ])
      .where("product_variant.product_id", "=", productId)
      .execute(),
  ]);

  const valuesByOptionId = new Map<string, ProductOptionValueRow[]>();
  for (const row of optionValueRows) {
    valuesByOptionId.set(row.option_id, [
      ...(valuesByOptionId.get(row.option_id) ?? []),
      row,
    ]);
  }

  const optionValueIdsByVariantId = new Map<string, string[]>();
  for (const row of variantOptionRows) {
    optionValueIdsByVariantId.set(row.variant_id, [
      ...(optionValueIdsByVariantId.get(row.variant_id) ?? []),
      row.option_value_id,
    ]);
  }

  return ProductCatalogSchema.parse({
    categories: categoryRows.map((row: ProductCategoryRow) => ({
      handle: row.handle,
      id: row.id,
      ...(row.parent_id ? { parentId: row.parent_id } : {}),
      title: row.title,
    })),
    collections: collectionRows.map((row: ProductCollectionRow) => ({
      handle: row.handle,
      id: row.id,
      title: row.title,
    })),
    media: mediaRows.map((row: ProductMediaRow) => ({
      ...(row.alt_text ? { altText: row.alt_text } : {}),
      id: row.id,
      metadata: parseJsonColumn(row.metadata),
      type: row.type,
      url: row.url,
    })),
    metadata: parseJsonColumn(productRow.catalog_metadata),
    options: optionRows.map((row: ProductOptionRow) => ({
      id: row.id,
      metadata: parseJsonColumn(row.metadata),
      title: row.title,
      values: (valuesByOptionId.get(row.id) ?? []).map(
        (valueRow: ProductOptionValueRow) => ({
          id: valueRow.id,
          label: valueRow.label,
          metadata: parseJsonColumn(valueRow.metadata),
          value: valueRow.value,
        })
      ),
    })),
    publishedAt:
      productRow.catalog_published_at === null
        ? null
        : new Date(productRow.catalog_published_at),
    searchableText: productRow.catalog_searchable_text,
    tags: tagRows.map((row: ProductTagRow) => row.value),
    variants: variantRows.map((row: ProductVariantRow) => ({
      id: row.id,
      metadata: parseJsonColumn(row.metadata),
      optionValueIds:
        optionValueIdsByVariantId.get(row.id) ??
        parseJsonColumn(row.option_value_ids),
      ...(row.searchable_text ? { searchableText: row.searchable_text } : {}),
      ...(row.sku ? { sku: row.sku } : {}),
      status: row.status,
      title: row.title,
    })),
  });
};

const toProductRecord = async (
  db: ProductD1Database,
  row: ProductRow
): Promise<ProductRecord> => ({
  catalog: await selectProductCatalog(db, row.id, row),
  createdAt: new Date(row.created_at),
  handle: row.handle,
  id: createProductId(row.id),
  status: ProductStatusSchema.parse(row.status),
  title: row.title,
  updatedAt: new Date(row.updated_at),
});

const deleteProductCatalogRows = async (
  db: ProductD1Database,
  productId: string
): Promise<void> => {
  const optionRows = await db
    .selectFrom("product_option")
    .select("id")
    .where("product_id", "=", productId)
    .execute();
  const variantRows = await db
    .selectFrom("product_variant")
    .select("id")
    .where("product_id", "=", productId)
    .execute();
  const optionIds = optionRows.map((row) => row.id);
  const variantIds = variantRows.map((row) => row.id);

  if (variantIds.length > 0) {
    await db
      .deleteFrom("product_variant_option")
      .where("variant_id", "in", variantIds)
      .execute();
  }

  if (optionIds.length > 0) {
    await db
      .deleteFrom("product_option_value")
      .where("option_id", "in", optionIds)
      .execute();
  }

  await Promise.all([
    db
      .deleteFrom("product_option")
      .where("product_id", "=", productId)
      .execute(),
    db
      .deleteFrom("product_variant")
      .where("product_id", "=", productId)
      .execute(),
    db
      .deleteFrom("product_media")
      .where("product_id", "=", productId)
      .execute(),
    db
      .deleteFrom("product_collection_product")
      .where("product_id", "=", productId)
      .execute(),
    db
      .deleteFrom("product_category_product")
      .where("product_id", "=", productId)
      .execute(),
    db.deleteFrom("product_tags").where("product_id", "=", productId).execute(),
    db
      .deleteFrom("product_type_product")
      .where("product_id", "=", productId)
      .execute(),
  ]);
};

const writeProductCatalogRows = async (
  db: ProductD1Database,
  record: ProductRecord
): Promise<void> => {
  const productId = record.id;
  const { catalog } = record;

  await insertValues(
    db,
    "product_option",
    catalog.options.map((option) => ({
      id: option.id,
      metadata: toJsonColumn(option.metadata ?? {}),
      product_id: productId,
      title: option.title,
    }))
  );
  await insertValues(
    db,
    "product_option_value",
    catalog.options.flatMap((option) =>
      option.values.map((value) => ({
        id: value.id,
        label: value.label,
        metadata: toJsonColumn(value.metadata ?? {}),
        option_id: option.id,
        value: value.value,
      }))
    )
  );
  await insertValues(
    db,
    "product_variant",
    catalog.variants.map((variant) => ({
      id: variant.id,
      metadata: toJsonColumn(variant.metadata ?? {}),
      option_value_ids: toJsonColumn(variant.optionValueIds),
      product_id: productId,
      searchable_text: variant.searchableText ?? null,
      sku: variant.sku ?? null,
      status: variant.status,
      title: variant.title,
    }))
  );
  await insertValues(
    db,
    "product_variant_option",
    catalog.variants.flatMap((variant) =>
      variant.optionValueIds.map((optionValueId) => ({
        option_value_id: optionValueId,
        variant_id: variant.id,
      }))
    )
  );
  await insertValuesIgnoringConflicts(
    db,
    "product_collection",
    catalog.collections.map((collection) => ({
      handle: collection.handle,
      id: collection.id,
      title: collection.title,
    })),
    "id"
  );
  await insertValues(
    db,
    "product_collection_product",
    catalog.collections.map((collection) => ({
      product_collection_id: collection.id,
      product_id: productId,
    }))
  );
  await insertValuesIgnoringConflicts(
    db,
    "product_category",
    catalog.categories.map((category) => ({
      handle: category.handle,
      id: category.id,
      parent_id: category.parentId ?? null,
      title: category.title,
    })),
    "id"
  );
  await insertValues(
    db,
    "product_category_product",
    catalog.categories.map((category) => ({
      product_category_id: category.id,
      product_id: productId,
    }))
  );
  await insertValues(
    db,
    "product_media",
    catalog.media.map((media) => ({
      alt_text: media.altText ?? null,
      id: media.id,
      metadata: toJsonColumn(media.metadata ?? {}),
      product_id: productId,
      type: media.type,
      url: media.url,
    }))
  );
  await insertValuesIgnoringConflicts(
    db,
    "product_tag",
    catalog.tags.map((tag) => ({
      id: `ptag_${tag}`,
      value: tag,
    })),
    "id"
  );
  await insertValues(
    db,
    "product_tags",
    catalog.tags.map((tag) => ({
      product_id: productId,
      product_tag_id: `ptag_${tag}`,
    }))
  );
};

const toProductColumns = (record: ProductRecord) => ({
  catalog_metadata: toJsonColumn(record.catalog.metadata),
  catalog_published_at: record.catalog.publishedAt?.getTime() ?? null,
  catalog_searchable_text: record.catalog.searchableText,
  handle: record.handle,
  status: record.status,
  title: record.title,
  updated_at: record.updatedAt.getTime(),
});

const findProductRecordOrThrow = async (
  db: ProductD1Database,
  productId: string
): Promise<ProductRecord> => {
  const row = await db
    .selectFrom("product")
    .selectAll()
    .where("id", "=", productId)
    .limit(1)
    .executeTakeFirst();

  if (!row) {
    throw new Error(`Product "${productId}" was not found.`);
  }

  return toProductRecord(db, row);
};

export const createD1ProductRepository = ({
  db,
}: CreateD1ProductRepositoryOptions): ProductRepository => ({
  addProductCategory: async (productId, category) => {
    await db
      .insertInto("product_category")
      .values({
        handle: category.handle,
        id: category.id,
        parent_id: category.parentId ?? null,
        title: category.title,
      })
      .onConflict((conflict) => conflict.column("id").doNothing())
      .execute();
    await db
      .insertInto("product_category_product")
      .values({
        product_category_id: category.id,
        product_id: productId,
      })
      .onConflict((conflict) => conflict.doNothing())
      .execute();
    return findProductRecordOrThrow(db, productId);
  },
  addProductCollection: async (productId, collection) => {
    await db
      .insertInto("product_collection")
      .values({
        handle: collection.handle,
        id: collection.id,
        title: collection.title,
      })
      .onConflict((conflict) => conflict.column("id").doNothing())
      .execute();
    await db
      .insertInto("product_collection_product")
      .values({
        product_collection_id: collection.id,
        product_id: productId,
      })
      .onConflict((conflict) => conflict.doNothing())
      .execute();
    return findProductRecordOrThrow(db, productId);
  },
  addProductMedia: async (productId, media) => {
    await db
      .insertInto("product_media")
      .values({
        alt_text: media.altText ?? null,
        id: media.id,
        metadata: toJsonColumn(media.metadata ?? {}),
        product_id: productId,
        type: media.type,
        url: media.url,
      })
      .execute();
    return findProductRecordOrThrow(db, productId);
  },
  addProductOption: async (productId, option) => {
    await db
      .insertInto("product_option")
      .values({
        id: option.id,
        metadata: toJsonColumn(option.metadata ?? {}),
        product_id: productId,
        title: option.title,
      })
      .execute();
    await insertValues(
      db,
      "product_option_value",
      option.values.map((value) => ({
        id: value.id,
        label: value.label,
        metadata: toJsonColumn(value.metadata ?? {}),
        option_id: option.id,
        value: value.value,
      }))
    );
    return findProductRecordOrThrow(db, productId);
  },
  addProductOptionValue: async ({ optionId, productId, value }) => {
    await db
      .insertInto("product_option_value")
      .values({
        id: value.id,
        label: value.label,
        metadata: toJsonColumn(value.metadata ?? {}),
        option_id: optionId,
        value: value.value,
      })
      .execute();
    return findProductRecordOrThrow(db, productId);
  },
  addProductTag: async (productId, tag) => {
    await db
      .insertInto("product_tag")
      .values({
        id: `ptag_${tag}`,
        value: tag,
      })
      .onConflict((conflict) => conflict.column("id").doNothing())
      .execute();
    await db
      .insertInto("product_tags")
      .values({
        product_id: productId,
        product_tag_id: `ptag_${tag}`,
      })
      .onConflict((conflict) => conflict.doNothing())
      .execute();
    return findProductRecordOrThrow(db, productId);
  },
  addProductVariant: async (productId, variant) => {
    await db
      .insertInto("product_variant")
      .values({
        id: variant.id,
        metadata: toJsonColumn(variant.metadata ?? {}),
        option_value_ids: toJsonColumn(variant.optionValueIds),
        product_id: productId,
        searchable_text: variant.searchableText ?? null,
        sku: variant.sku ?? null,
        status: variant.status,
        title: variant.title,
      })
      .execute();
    await insertValues(
      db,
      "product_variant_option",
      variant.optionValueIds.map((optionValueId) => ({
        option_value_id: optionValueId,
        variant_id: variant.id,
      }))
    );
    return findProductRecordOrThrow(db, productId);
  },
  findProductByHandle: async (handle) => {
    const row = await db
      .selectFrom("product")
      .selectAll()
      .where("handle", "=", handle)
      .limit(1)
      .executeTakeFirst();

    return row ? toProductRecord(db, row) : null;
  },
  findProductById: async (id) => {
    const row = await db
      .selectFrom("product")
      .selectAll()
      .where("id", "=", id)
      .limit(1)
      .executeTakeFirst();

    return row ? toProductRecord(db, row) : null;
  },
  listProducts: async () => {
    const rows = await db
      .selectFrom("product")
      .selectAll()
      .orderBy("created_at", "desc")
      .execute();

    const records: ProductRecord[] = [];
    for (const row of rows) {
      records.push(await toProductRecord(db, row));
    }

    return records;
  },
  saveProduct: async (record) => {
    try {
      await db
        .insertInto("product")
        .values({
          ...toProductColumns(record),
          created_at: record.createdAt.getTime(),
          id: record.id,
        })
        .execute();
      await writeProductCatalogRows(db, record);
    } catch (error) {
      if (isDuplicateProductHandleError(error)) {
        throw new Error(`Product handle "${record.handle}" already exists.`, {
          cause: error,
        });
      }

      throw error;
    }

    return record;
  },
  setProductCatalogMetadata: async ({
    metadata,
    productId,
    publishedAt,
    searchableText,
  }) => {
    const update = {
      catalog_metadata: toJsonColumn(metadata),
      ...(publishedAt === undefined
        ? {}
        : { catalog_published_at: publishedAt?.getTime() ?? null }),
      ...(searchableText === undefined
        ? {}
        : { catalog_searchable_text: searchableText }),
    };

    await db
      .updateTable("product")
      .set(update)
      .where("id", "=", productId)
      .execute();
    return findProductRecordOrThrow(db, productId);
  },
  updateProduct: async (record) => {
    await db
      .updateTable("product")
      .set(toProductColumns(record))
      .where("id", "=", record.id)
      .execute();
    await deleteProductCatalogRows(db, record.id);
    await writeProductCatalogRows(db, record);

    return record;
  },
});

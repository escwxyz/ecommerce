import {
  RepositoryDecodeFailure,
  RepositoryUnavailable,
} from "@ecommerce/core";
import {
  ProductNotFound,
  ProductRecordSchema,
  ProductRepositoryService,
  createProductIdEffect,
} from "@ecommerce/product";
import type {
  ProductCatalog,
  ProductExpectedError,
  ProductId,
  ProductRecord,
  ProductRepository,
} from "@ecommerce/product";
import { desc, eq } from "drizzle-orm";
import { Effect, Layer, Option, Schema } from "effect";
import type { Effect as EffectValue } from "effect/Effect";
import type { SqlError } from "effect/unstable/sql/SqlError";

import {
  CurrentPostgresTransactionService,
  PostgresDrizzleService,
} from "../../postgres-drizzle";
import type {
  PostgresDrizzleDatabase,
  PostgresDrizzleService as PostgresDrizzleServiceShape,
  PostgresDrizzleTransaction,
} from "../../postgres-drizzle";
import {
  ProductPostgresInsertSchema,
  ProductPostgresRowSchema,
  postgresProduct,
} from "./schema";
import type { ProductPostgresInsert, ProductPostgresRow } from "./schema";

type ProductPostgresExecutor =
  | PostgresDrizzleDatabase
  | PostgresDrizzleTransaction;

const productRepositoryName = "ProductRepository";
const productEntityName = "product";

const toRepositoryUnavailable =
  (operation: "delete" | "read" | "write") => (): RepositoryUnavailable =>
    new RepositoryUnavailable({
      adapter: "effect-postgres",
      operation,
      repository: productRepositoryName,
    });

const toRepositoryDecodeFailure = (
  operation: "read" | "write"
): RepositoryDecodeFailure =>
  new RepositoryDecodeFailure({
    entity: productEntityName,
    operation,
    repository: productRepositoryName,
  });

const getProductExecutor = (
  service: PostgresDrizzleServiceShape
): EffectValue<ProductPostgresExecutor> =>
  Effect.map(
    Effect.serviceOption(CurrentPostgresTransactionService),
    Option.getOrElse(() => service.database)
  );

/** Converts a product domain record into a PostgreSQL insert row. */
export const toProductPostgresInsert = (
  product: ProductRecord
): EffectValue<ProductPostgresInsert, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(ProductPostgresInsertSchema)({
    catalogJson: product.catalog,
    createdAt: product.createdAt,
    handle: product.handle,
    id: product.id,
    metadataJson: product.catalog.metadata,
    status: product.status,
    title: product.title,
    updatedAt: product.updatedAt,
  }).pipe(Effect.mapError(() => toRepositoryDecodeFailure("write")));

/** Converts a decoded PostgreSQL row into the product domain record. */
export const toProductRecord = (
  row: ProductPostgresRow
): EffectValue<ProductRecord, ProductExpectedError> =>
  Effect.gen(function* toProductRecordEffect() {
    const id = yield* createProductIdEffect(row.id);

    return yield* Schema.decodeUnknownEffect(ProductRecordSchema)({
      catalog: row.catalogJson,
      createdAt: row.createdAt,
      handle: row.handle,
      id,
      status: row.status,
      title: row.title,
      updatedAt: row.updatedAt,
    }).pipe(Effect.mapError(() => toRepositoryDecodeFailure("read")));
  });

const decodeProductRow = (
  row: unknown
): EffectValue<ProductRecord, ProductExpectedError> =>
  Schema.decodeUnknownEffect(ProductPostgresRowSchema)(row).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("read")),
    Effect.flatMap(toProductRecord)
  );

const findProductByColumn = ({
  column,
  service,
  value,
}: {
  readonly column: typeof postgresProduct.handle | typeof postgresProduct.id;
  readonly service: PostgresDrizzleServiceShape;
  readonly value: string;
}): EffectValue<ProductRecord | null, ProductExpectedError> =>
  Effect.gen(function* findProductByColumnEffect() {
    const executor = yield* getProductExecutor(service);
    const rows = yield* executor
      .select()
      .from(postgresProduct)
      .where(eq(column, value))
      .limit(1)
      .pipe(Effect.mapError(toRepositoryUnavailable("read")));
    const [row] = rows;

    return row ? yield* decodeProductRow(row) : null;
  });

const requirePersistedProduct = ({
  productId,
  service,
}: {
  readonly productId: ProductId;
  readonly service: PostgresDrizzleServiceShape;
}): EffectValue<ProductRecord, ProductExpectedError> =>
  findProductByColumn({
    column: postgresProduct.id,
    service,
    value: productId,
  }).pipe(
    Effect.flatMap((product) =>
      product
        ? Effect.succeed(product)
        : Effect.fail(new ProductNotFound({ productId }))
    )
  );

const updateCatalog = ({
  mutate,
  productId,
  service,
}: {
  readonly mutate: (catalog: ProductCatalog) => ProductCatalog;
  readonly productId: ProductId;
  readonly service: PostgresDrizzleServiceShape;
}): EffectValue<ProductRecord, ProductExpectedError> =>
  Effect.gen(function* updateCatalogEffect() {
    const product = yield* requirePersistedProduct({ productId, service });
    return yield* createPostgresProductRepository(service).updateProduct({
      ...product,
      catalog: mutate(product.catalog),
    });
  });

/** Creates the PostgreSQL-backed product repository contract implementation. */
export const createPostgresProductRepository = (
  service: PostgresDrizzleServiceShape
): ProductRepository =>
  ProductRepositoryService.of({
    addProductCategory: (productId, category) =>
      updateCatalog({
        mutate: (catalog) => ({
          ...catalog,
          categories: [...catalog.categories, category],
        }),
        productId,
        service,
      }),
    addProductCollection: (productId, collection) =>
      updateCatalog({
        mutate: (catalog) => ({
          ...catalog,
          collections: [...catalog.collections, collection],
        }),
        productId,
        service,
      }),
    addProductMedia: (productId, media) =>
      updateCatalog({
        mutate: (catalog) => ({ ...catalog, media: [...catalog.media, media] }),
        productId,
        service,
      }),
    addProductOption: (productId, option) =>
      updateCatalog({
        mutate: (catalog) => ({
          ...catalog,
          options: [...catalog.options, option],
        }),
        productId,
        service,
      }),
    addProductOptionValue: ({ optionId, productId, value }) =>
      updateCatalog({
        mutate: (catalog) => ({
          ...catalog,
          options: catalog.options.map((option) =>
            option.id === optionId
              ? { ...option, values: [...option.values, value] }
              : option
          ),
        }),
        productId,
        service,
      }),
    addProductTag: (productId, tag) =>
      updateCatalog({
        mutate: (catalog) => ({ ...catalog, tags: [...catalog.tags, tag] }),
        productId,
        service,
      }),
    addProductVariant: (productId, variant) =>
      updateCatalog({
        mutate: (catalog) => ({
          ...catalog,
          variants: [...catalog.variants, variant],
        }),
        productId,
        service,
      }),
    findProductByHandle: (handle) =>
      findProductByColumn({
        column: postgresProduct.handle,
        service,
        value: handle,
      }),
    findProductById: (id) =>
      findProductByColumn({
        column: postgresProduct.id,
        service,
        value: id,
      }),
    listProducts: Effect.gen(function* listProductsEffect() {
      const executor = yield* getProductExecutor(service);
      const rows = yield* executor
        .select()
        .from(postgresProduct)
        .orderBy(desc(postgresProduct.createdAt))
        .pipe(Effect.mapError(toRepositoryUnavailable("read")));

      return yield* Effect.all(rows.map((row) => decodeProductRow(row)));
    }),
    saveProduct: (product) =>
      Effect.gen(function* saveProductEffect() {
        const executor = yield* getProductExecutor(service);
        const insert = yield* toProductPostgresInsert(product);
        yield* executor
          .insert(postgresProduct)
          .values(insert)
          .pipe(
            Effect.asVoid,
            Effect.mapError(toRepositoryUnavailable("write"))
          );

        return product;
      }),
    setProductCatalogMetadata: ({
      metadata,
      productId,
      publishedAt,
      searchableText,
    }) =>
      updateCatalog({
        mutate: (catalog) => ({
          ...catalog,
          metadata,
          publishedAt:
            publishedAt === undefined ? catalog.publishedAt : publishedAt,
          searchableText: searchableText ?? catalog.searchableText,
        }),
        productId,
        service,
      }),
    updateProduct: (product) =>
      Effect.gen(function* updateProductEffect() {
        const executor = yield* getProductExecutor(service);
        const insert = yield* toProductPostgresInsert(product);
        yield* executor
          .update(postgresProduct)
          .set({
            catalogJson: insert.catalogJson,
            handle: insert.handle,
            metadataJson: insert.metadataJson,
            status: insert.status,
            title: insert.title,
            updatedAt: insert.updatedAt,
          })
          .where(eq(postgresProduct.id, product.id))
          .pipe(
            Effect.asVoid,
            Effect.mapError(toRepositoryUnavailable("write"))
          );

        return product;
      }),
  });

export const createPostgresProductRepositoryLayer = () =>
  Layer.effect(
    ProductRepositoryService,
    PostgresDrizzleService.use((service) =>
      Effect.succeed(createPostgresProductRepository(service))
    )
  );

/** Production PostgreSQL product repository Layer. */
export const PostgresProductRepositoryLayer =
  createPostgresProductRepositoryLayer();

/** Runs a product repository Effect inside the current PostgreSQL transaction. */
export const withPostgresProductTransaction = <A, E, R>(
  effect: EffectValue<A, E, R>
): EffectValue<A, E | SqlError, R | PostgresDrizzleService> =>
  PostgresDrizzleService.use((service) =>
    service.withTransaction(() => effect)
  );

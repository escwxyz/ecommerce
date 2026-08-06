import { Effect, Layer } from "effect";

import type {
  ProductExpectedError,
  ProductCatalog,
  ProductId,
  ProductRecord,
  ProductRepository,
} from "../domain";
import { ProductNotFound, ProductRepositoryService } from "../domain";

export interface ResettableProductRepository extends ProductRepository {
  clear(): void;
}

const sortProducts = (records: Iterable<ProductRecord>): ProductRecord[] => {
  const sortedProducts: ProductRecord[] = [];

  for (const record of records) {
    const recordTimestamp = record.createdAt.getTime();
    let insertAt = 0;

    while (insertAt < sortedProducts.length) {
      const currentProduct = sortedProducts[insertAt];

      if (!currentProduct) {
        break;
      }

      if (currentProduct.createdAt.getTime() < recordTimestamp) {
        break;
      }

      insertAt += 1;
    }

    sortedProducts.splice(insertAt, 0, record);
  }

  return sortedProducts;
};

export class InMemoryProductRepository implements ResettableProductRepository {
  readonly #records = new Map<string, ProductRecord>();

  clear(): void {
    this.#records.clear();
  }

  #mutateProductCatalog(
    productId: ProductId,
    mutate: (catalog: ProductCatalog) => ProductCatalog
  ): Effect.Effect<ProductRecord, ProductExpectedError> {
    const product = this.#records.get(productId);

    if (!product) {
      return Effect.fail(new ProductNotFound({ productId }));
    }

    const updated = {
      ...product,
      catalog: mutate(product.catalog),
    };

    this.#records.set(productId, updated);
    return Effect.succeed(updated);
  }

  addProductCategory(
    productId: ProductId,
    category: ProductCatalog["categories"][number]
  ) {
    return this.#mutateProductCatalog(productId, (catalog) => ({
      ...catalog,
      categories: [...catalog.categories, category],
    }));
  }

  addProductCollection(
    productId: ProductId,
    collection: ProductCatalog["collections"][number]
  ) {
    return this.#mutateProductCatalog(productId, (catalog) => ({
      ...catalog,
      collections: [...catalog.collections, collection],
    }));
  }

  addProductMedia(
    productId: ProductId,
    media: ProductCatalog["media"][number]
  ) {
    return this.#mutateProductCatalog(productId, (catalog) => ({
      ...catalog,
      media: [...catalog.media, media],
    }));
  }

  addProductOption(
    productId: ProductId,
    option: ProductCatalog["options"][number]
  ) {
    return this.#mutateProductCatalog(productId, (catalog) => ({
      ...catalog,
      options: [...catalog.options, option],
    }));
  }

  addProductOptionValue({
    optionId,
    productId,
    value,
  }: {
    readonly optionId: string;
    readonly productId: ProductId;
    readonly value: ProductCatalog["options"][number]["values"][number];
  }) {
    return this.#mutateProductCatalog(productId, (catalog) => ({
      ...catalog,
      options: catalog.options.map((option) =>
        option.id === optionId
          ? { ...option, values: [...option.values, value] }
          : option
      ),
    }));
  }

  addProductTag(productId: ProductId, tag: string) {
    return this.#mutateProductCatalog(productId, (catalog) => ({
      ...catalog,
      tags: [...catalog.tags, tag],
    }));
  }

  addProductVariant(
    productId: ProductId,
    variant: ProductCatalog["variants"][number]
  ) {
    return this.#mutateProductCatalog(productId, (catalog) => ({
      ...catalog,
      variants: [...catalog.variants, variant],
    }));
  }

  findProductByHandle(handle: string) {
    for (const record of this.#records.values()) {
      if (record.handle === handle) {
        return Effect.succeed(record);
      }
    }

    return Effect.succeed(null);
  }

  findProductById(id: ProductId) {
    return Effect.succeed(this.#records.get(id) ?? null);
  }

  readonly listProducts = Effect.sync(() =>
    sortProducts(this.#records.values())
  );

  saveProduct(product: ProductRecord) {
    return Effect.sync(() => {
      this.#records.set(product.id, product);
      return product;
    });
  }

  setProductCatalogMetadata({
    metadata,
    productId,
    publishedAt,
    searchableText,
  }: {
    readonly metadata: ProductCatalog["metadata"];
    readonly productId: ProductId;
    readonly publishedAt?: Date | null;
    readonly searchableText?: string;
  }) {
    return this.#mutateProductCatalog(productId, (catalog) => ({
      ...catalog,
      metadata,
      publishedAt:
        publishedAt === undefined ? catalog.publishedAt : publishedAt,
      searchableText: searchableText ?? catalog.searchableText,
    }));
  }

  updateProduct(product: ProductRecord) {
    return Effect.sync(() => {
      this.#records.set(product.id, product);
      return product;
    });
  }
}

export const createInMemoryProductRepository = (): ProductRepository =>
  new InMemoryProductRepository();

export const createResettableInMemoryProductRepository =
  (): ResettableProductRepository => new InMemoryProductRepository();

export const createInMemoryProductRepositoryLayer = () =>
  Layer.effect(
    ProductRepositoryService,
    Effect.sync(() => new InMemoryProductRepository() as ProductRepository)
  );

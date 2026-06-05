import type { ProductRecord, ProductRepository } from "../domain";

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

  findProductByHandle(handle: string): Promise<ProductRecord | null> {
    for (const record of this.#records.values()) {
      if (record.handle === handle) {
        return Promise.resolve(record);
      }
    }

    return Promise.resolve(null);
  }

  findProductById(id: string): Promise<ProductRecord | null> {
    return Promise.resolve(this.#records.get(id) ?? null);
  }

  listProducts(): Promise<readonly ProductRecord[]> {
    return Promise.resolve(sortProducts(this.#records.values()));
  }

  saveProduct(product: ProductRecord): Promise<ProductRecord> {
    this.#records.set(product.id, product);
    return Promise.resolve(product);
  }
}

export const defaultProductRepository = new InMemoryProductRepository();

export const createInMemoryProductRepository = (): ProductRepository =>
  new InMemoryProductRepository();

export const createResettableInMemoryProductRepository =
  (): ResettableProductRepository => new InMemoryProductRepository();

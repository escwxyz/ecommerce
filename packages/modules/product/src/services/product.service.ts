import type {
  ClockServiceShape,
  IdGeneratorServiceShape,
} from "@ecommerce/core";
import { slugify } from "@ecommerce/utils";
import { Context, Layer } from "effect";
import { nanoid } from "nanoid";

import type {
  CreateProductInput,
  ProductId,
  ProductRecord,
  ProductRepository,
  ProductStatus,
} from "../domain";
import { PRODUCT_ID_PREFIX, createProductId } from "../domain";
import { defaultProductRepository } from "../repositories";

export interface ProductServiceShape {
  createProductDraft(input: CreateProductInput): Promise<ProductRecord>;
  getProductById(id: ProductId): Promise<ProductRecord | null>;
  listProducts(): Promise<readonly ProductRecord[]>;
}

export const ProductService = Context.Service<ProductServiceShape>(
  "@ecommerce/product/ProductService"
);

export interface CreateProductServiceOptions {
  readonly clock?: ClockServiceShape;
  readonly idGenerator?: IdGeneratorServiceShape;
  readonly repository?: ProductRepository;
}

const createDefaultClock = (): ClockServiceShape => ({
  now: () => new Date(),
});

const createDefaultIdGenerator = (): IdGeneratorServiceShape => ({
  nextId: () => `${PRODUCT_ID_PREFIX}${nanoid()}`,
});

const normalizeHandle = (handle: string): string => slugify(handle);

const normalizeStatus = (status: ProductStatus | undefined): ProductStatus =>
  status ?? "draft";

export const createProductService = ({
  clock = createDefaultClock(),
  idGenerator = createDefaultIdGenerator(),
  repository = defaultProductRepository,
}: CreateProductServiceOptions = {}): ProductServiceShape => ({
  createProductDraft: async (input) => {
    const handle = normalizeHandle(input.handle);
    const title = input.title.trim();

    if (!handle) {
      throw new Error("Product handle is required.");
    }

    if (!title) {
      throw new Error("Product title is required.");
    }

    const existing = await repository.findProductByHandle(handle);

    if (existing) {
      throw new Error(`Product handle "${handle}" already exists.`);
    }

    const now = clock.now();
    const product: ProductRecord = {
      createdAt: now,
      handle,
      id: createProductId(idGenerator.nextId()),
      status: normalizeStatus(input.status),
      title,
      updatedAt: now,
    };

    return repository.saveProduct(product);
  },
  getProductById: (id) => repository.findProductById(id),
  listProducts: () => repository.listProducts(),
});

export const createProductServiceLayer = (service: ProductServiceShape) =>
  Layer.succeed(ProductService, service);

export const defaultProductService = createProductService({
  repository: defaultProductRepository,
});

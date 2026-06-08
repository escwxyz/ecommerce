import type {
  ClockServiceShape,
  IdGeneratorServiceShape,
} from "@ecommerce/core";
import { slugify } from "@ecommerce/utils";
import { Context, Layer } from "effect";
import { nanoid } from "nanoid";

import type {
  CreateProductInput,
  ProductCategoryReference,
  ProductCollectionReference,
  ProductMediaReference,
  ProductOption,
  ProductOptionValue,
  ProductCatalog,
  ProductId,
  ProductRecord,
  ProductRepository,
  ProductStatus,
  ProductVariant,
  ProductVariantValidationResult,
  UpdateProductCatalogInput,
} from "../domain";
import { PRODUCT_ID_PREFIX, createProductId } from "../domain";
import { defaultProductRepository } from "../repositories";

export interface ProductServiceShape {
  addProductCategory(input: {
    readonly category: ProductCategoryReference;
    readonly productId: ProductId;
  }): Promise<ProductRecord>;
  addProductCollection(input: {
    readonly collection: ProductCollectionReference;
    readonly productId: ProductId;
  }): Promise<ProductRecord>;
  addProductMedia(input: {
    readonly media: ProductMediaReference;
    readonly productId: ProductId;
  }): Promise<ProductRecord>;
  addProductOption(input: {
    readonly option: ProductOption;
    readonly productId: ProductId;
  }): Promise<ProductRecord>;
  addProductOptionValue(input: {
    readonly optionId: string;
    readonly productId: ProductId;
    readonly value: ProductOptionValue;
  }): Promise<ProductRecord>;
  addProductTag(input: {
    readonly productId: ProductId;
    readonly tag: string;
  }): Promise<ProductRecord>;
  addProductVariant(input: {
    readonly productId: ProductId;
    readonly variant: ProductVariant;
  }): Promise<ProductRecord>;
  createProductDraft(input: CreateProductInput): Promise<ProductRecord>;
  getProductById(id: ProductId): Promise<ProductRecord | null>;
  listProducts(): Promise<readonly ProductRecord[]>;
  setProductCatalogMetadata(input: {
    readonly metadata: ProductCatalog["metadata"];
    readonly productId: ProductId;
    readonly publishedAt?: Date | null;
    readonly searchableText?: string;
  }): Promise<ProductRecord>;
  updateProductCatalog(
    input: UpdateProductCatalogInput
  ): Promise<ProductRecord>;
  validateProductVariant(input: {
    readonly productId: ProductId;
    readonly variantId: string;
  }): Promise<ProductVariantValidationResult>;
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

export const createEmptyProductCatalog = (): ProductCatalog => ({
  categories: [],
  collections: [],
  media: [],
  metadata: {},
  options: [],
  publishedAt: null,
  searchableText: "",
  tags: [],
  variants: [],
});

const dedupeTrimmedValues = (values: readonly string[]): string[] => {
  const deduped = new Set<string>();

  for (const value of values) {
    const trimmed = value.trim();

    if (trimmed) {
      deduped.add(trimmed);
    }
  }

  return [...deduped];
};

const mergeProductCatalog = (
  current: ProductCatalog,
  next: UpdateProductCatalogInput["catalog"]
): ProductCatalog => ({
  ...current,
  ...next,
  categories: next.categories ?? current.categories,
  collections: next.collections ?? current.collections,
  media: next.media ?? current.media,
  metadata: next.metadata ?? current.metadata,
  options: next.options ?? current.options,
  publishedAt:
    "publishedAt" in next ? (next.publishedAt ?? null) : current.publishedAt,
  searchableText: next.searchableText?.trim() ?? current.searchableText,
  tags: next.tags ? dedupeTrimmedValues(next.tags) : current.tags,
  variants: next.variants ?? current.variants,
});

const assertUniqueIds = (
  entityName: string,
  values: readonly { readonly id: string }[]
): void => {
  const seen = new Set<string>();

  for (const value of values) {
    if (seen.has(value.id)) {
      throw new Error(`Duplicate ${entityName} id "${value.id}".`);
    }

    seen.add(value.id);
  }
};

const validateCatalogStructure = (catalog: ProductCatalog): void => {
  assertUniqueIds("product option", catalog.options);
  assertUniqueIds("product variant", catalog.variants);
  assertUniqueIds("product collection", catalog.collections);
  assertUniqueIds("product category", catalog.categories);
  assertUniqueIds("product media", catalog.media);

  const optionValueIds = new Set<string>();

  for (const option of catalog.options) {
    assertUniqueIds("product option value", option.values);

    for (const value of option.values) {
      optionValueIds.add(value.id);
    }
  }

  for (const variant of catalog.variants) {
    for (const optionValueId of variant.optionValueIds) {
      if (!optionValueIds.has(optionValueId)) {
        throw new Error(
          `Product variant "${variant.id}" references unknown option value "${optionValueId}".`
        );
      }
    }
  }
};

const requireProduct = async (
  repository: ProductRepository,
  productId: ProductId
): Promise<ProductRecord> => {
  const product = await repository.findProductById(productId);

  if (!product) {
    throw new Error(`Product "${productId}" was not found.`);
  }

  return product;
};

const validateCandidateCatalog = (
  product: ProductRecord,
  catalog: ProductCatalog
): void => validateCatalogStructure({ ...product.catalog, ...catalog });

export const createProductService = ({
  clock = createDefaultClock(),
  idGenerator = createDefaultIdGenerator(),
  repository = defaultProductRepository,
}: CreateProductServiceOptions = {}): ProductServiceShape => ({
  addProductCategory: async ({ category, productId }) => {
    const product = await requireProduct(repository, productId);
    validateCandidateCatalog(product, {
      ...product.catalog,
      categories: [...product.catalog.categories, category],
    });
    return repository.addProductCategory(productId, category);
  },
  addProductCollection: async ({ collection, productId }) => {
    const product = await requireProduct(repository, productId);
    validateCandidateCatalog(product, {
      ...product.catalog,
      collections: [...product.catalog.collections, collection],
    });
    return repository.addProductCollection(productId, collection);
  },
  addProductMedia: async ({ media, productId }) => {
    const product = await requireProduct(repository, productId);
    validateCandidateCatalog(product, {
      ...product.catalog,
      media: [...product.catalog.media, media],
    });
    return repository.addProductMedia(productId, media);
  },
  addProductOption: async ({ option, productId }) => {
    const product = await requireProduct(repository, productId);
    validateCandidateCatalog(product, {
      ...product.catalog,
      options: [...product.catalog.options, option],
    });
    return repository.addProductOption(productId, option);
  },
  addProductOptionValue: async ({ optionId, productId, value }) => {
    const product = await requireProduct(repository, productId);
    const catalog = {
      ...product.catalog,
      options: product.catalog.options.map((option) =>
        option.id === optionId
          ? { ...option, values: [...option.values, value] }
          : option
      ),
    };
    validateCandidateCatalog(product, catalog);
    return repository.addProductOptionValue({ optionId, productId, value });
  },
  addProductTag: async ({ productId, tag }) => {
    const product = await requireProduct(repository, productId);
    const normalizedTags = dedupeTrimmedValues([...product.catalog.tags, tag]);
    validateCandidateCatalog(product, {
      ...product.catalog,
      tags: normalizedTags,
    });

    if (product.catalog.tags.includes(tag.trim())) {
      return product;
    }

    return repository.addProductTag(productId, tag.trim());
  },
  addProductVariant: async ({ productId, variant }) => {
    const product = await requireProduct(repository, productId);
    validateCandidateCatalog(product, {
      ...product.catalog,
      variants: [...product.catalog.variants, variant],
    });
    return repository.addProductVariant(productId, variant);
  },
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
      catalog: createEmptyProductCatalog(),
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
  setProductCatalogMetadata: async (input) => {
    await requireProduct(repository, input.productId);
    return repository.setProductCatalogMetadata({
      ...input,
      searchableText: input.searchableText?.trim(),
    });
  },
  updateProductCatalog: async (input) => {
    const product = await requireProduct(repository, createProductId(input.id));
    const catalog = mergeProductCatalog(product.catalog, input.catalog);
    validateCatalogStructure(catalog);

    return repository.updateProduct({
      ...product,
      catalog,
      updatedAt: clock.now(),
    });
  },
  validateProductVariant: async ({ productId, variantId }) => {
    const product = await repository.findProductById(productId);

    if (!product) {
      return {
        productId,
        productStatus: "archived",
        valid: false,
        variantId,
        variantStatus: null,
      };
    }

    const variant =
      product.catalog.variants.find(
        (candidate) => candidate.id === variantId
      ) ?? null;

    return {
      productId,
      productStatus: product.status,
      valid: product.status === "active" && variant?.status === "active",
      variantId,
      variantStatus: variant?.status ?? null,
    };
  },
});

export const createProductServiceLayer = (service: ProductServiceShape) =>
  Layer.succeed(ProductService, service);

export const defaultProductService = createProductService({
  repository: defaultProductRepository,
});

import type {
  ClockServiceShape,
  IdGeneratorServiceShape,
} from "@ecommerce/core";
import { ClockService, IdGeneratorService } from "@ecommerce/core";
import { slugify } from "@ecommerce/utils";
import { Context, Effect, Layer } from "effect";
import type { Effect as EffectValue } from "effect/Effect";
import { nanoid } from "nanoid";

import type {
  CreateProductInput,
  ProductCategoryReference,
  ProductCollectionReference,
  ProductExpectedError,
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
import {
  PRODUCT_ID_PREFIX,
  ProductCatalogValidationFailure,
  ProductHandleConflict,
  ProductNotFound,
  ProductRepositoryService,
  createProductIdEffect,
} from "../domain";

export type ProductServiceFailure = ProductExpectedError;

export interface ProductServiceShape {
  readonly addProductCategory: (input: {
    readonly category: ProductCategoryReference;
    readonly productId: ProductId;
  }) => EffectValue<ProductRecord, ProductServiceFailure>;
  readonly addProductCollection: (input: {
    readonly collection: ProductCollectionReference;
    readonly productId: ProductId;
  }) => EffectValue<ProductRecord, ProductServiceFailure>;
  readonly addProductMedia: (input: {
    readonly media: ProductMediaReference;
    readonly productId: ProductId;
  }) => EffectValue<ProductRecord, ProductServiceFailure>;
  readonly addProductOption: (input: {
    readonly option: ProductOption;
    readonly productId: ProductId;
  }) => EffectValue<ProductRecord, ProductServiceFailure>;
  readonly addProductOptionValue: (input: {
    readonly optionId: string;
    readonly productId: ProductId;
    readonly value: ProductOptionValue;
  }) => EffectValue<ProductRecord, ProductServiceFailure>;
  readonly addProductTag: (input: {
    readonly productId: ProductId;
    readonly tag: string;
  }) => EffectValue<ProductRecord, ProductServiceFailure>;
  readonly addProductVariant: (input: {
    readonly productId: ProductId;
    readonly variant: ProductVariant;
  }) => EffectValue<ProductRecord, ProductServiceFailure>;
  readonly createProductDraft: (
    input: CreateProductInput
  ) => EffectValue<ProductRecord, ProductServiceFailure>;
  readonly getProductById: (
    id: ProductId
  ) => EffectValue<ProductRecord | null, ProductServiceFailure>;
  readonly listProducts: EffectValue<
    readonly ProductRecord[],
    ProductServiceFailure
  >;
  readonly setProductCatalogMetadata: (input: {
    readonly metadata: ProductCatalog["metadata"];
    readonly productId: ProductId;
    readonly publishedAt?: Date | null;
    readonly searchableText?: string;
  }) => EffectValue<ProductRecord, ProductServiceFailure>;
  readonly updateProductCatalog: (
    input: UpdateProductCatalogInput
  ) => EffectValue<ProductRecord, ProductServiceFailure>;
  readonly validateProductVariant: (input: {
    readonly productId: ProductId;
    readonly variantId: string;
  }) => EffectValue<ProductVariantValidationResult, ProductServiceFailure>;
}

export const ProductService = Context.Service<ProductServiceShape>(
  "@ecommerce/product/ProductService"
);

export interface CreateProductServiceOptions {
  readonly clock?: ClockServiceShape;
  readonly idGenerator?: IdGeneratorServiceShape;
  readonly repository: ProductRepository;
}

const createDefaultClock = (): ClockServiceShape => ({
  now: () => new Date(),
});

const createDefaultIdGenerator = (): IdGeneratorServiceShape => ({
  nextId: () => nanoid(),
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

const validateUniqueIds = (
  entityName: string,
  values: readonly { readonly id: string }[]
): EffectValue<void, ProductCatalogValidationFailure> =>
  Effect.gen(function* validateUniqueIdsEffect() {
    const seen = new Set<string>();

    for (const value of values) {
      if (seen.has(value.id)) {
        return yield* new ProductCatalogValidationFailure({
          message: `Duplicate ${entityName} id "${value.id}".`,
        });
      }

      seen.add(value.id);
    }
  });

const validateCatalogStructure = (
  catalog: ProductCatalog
): EffectValue<void, ProductCatalogValidationFailure> =>
  Effect.gen(function* validateCatalogStructureEffect() {
    yield* validateUniqueIds("product option", catalog.options);
    yield* validateUniqueIds("product variant", catalog.variants);
    yield* validateUniqueIds("product collection", catalog.collections);
    yield* validateUniqueIds("product category", catalog.categories);
    yield* validateUniqueIds("product media", catalog.media);

    const optionValueIds = new Set<string>();

    for (const option of catalog.options) {
      yield* validateUniqueIds("product option value", option.values);

      for (const value of option.values) {
        optionValueIds.add(value.id);
      }
    }

    for (const variant of catalog.variants) {
      for (const optionValueId of variant.optionValueIds) {
        if (!optionValueIds.has(optionValueId)) {
          return yield* new ProductCatalogValidationFailure({
            message: `Product variant "${variant.id}" references unknown option value "${optionValueId}".`,
          });
        }
      }
    }
  });

const requireProduct = (
  repository: ProductRepository,
  productId: ProductId
): EffectValue<ProductRecord, ProductServiceFailure> =>
  repository
    .findProductById(productId)
    .pipe(
      Effect.flatMap((product) =>
        product
          ? Effect.succeed(product)
          : Effect.fail(new ProductNotFound({ productId }))
      )
    );

const validateCandidateCatalog = (
  product: ProductRecord,
  catalog: ProductCatalog
): EffectValue<void, ProductCatalogValidationFailure> =>
  validateCatalogStructure({ ...product.catalog, ...catalog });

const createPrefixedId = (
  idGenerator: IdGeneratorServiceShape,
  prefix: string
): string => {
  const nextId = idGenerator.nextId();
  return nextId.startsWith(prefix) ? nextId : `${prefix}${nextId}`;
};

export const createProductService = ({
  clock = createDefaultClock(),
  idGenerator = createDefaultIdGenerator(),
  repository,
}: CreateProductServiceOptions): ProductServiceShape => ({
  addProductCategory: ({ category, productId }) =>
    Effect.gen(function* addProductCategoryEffect() {
      const product = yield* requireProduct(repository, productId);
      yield* validateCandidateCatalog(product, {
        ...product.catalog,
        categories: [...product.catalog.categories, category],
      });
      return yield* repository.addProductCategory(productId, category);
    }),
  addProductCollection: ({ collection, productId }) =>
    Effect.gen(function* addProductCollectionEffect() {
      const product = yield* requireProduct(repository, productId);
      yield* validateCandidateCatalog(product, {
        ...product.catalog,
        collections: [...product.catalog.collections, collection],
      });
      return yield* repository.addProductCollection(productId, collection);
    }),
  addProductMedia: ({ media, productId }) =>
    Effect.gen(function* addProductMediaEffect() {
      const product = yield* requireProduct(repository, productId);
      yield* validateCandidateCatalog(product, {
        ...product.catalog,
        media: [...product.catalog.media, media],
      });
      return yield* repository.addProductMedia(productId, media);
    }),
  addProductOption: ({ option, productId }) =>
    Effect.gen(function* addProductOptionEffect() {
      const product = yield* requireProduct(repository, productId);
      yield* validateCandidateCatalog(product, {
        ...product.catalog,
        options: [...product.catalog.options, option],
      });
      return yield* repository.addProductOption(productId, option);
    }),
  addProductOptionValue: ({ optionId, productId, value }) =>
    Effect.gen(function* addProductOptionValueEffect() {
      const product = yield* requireProduct(repository, productId);
      const catalog = {
        ...product.catalog,
        options: product.catalog.options.map((option) =>
          option.id === optionId
            ? { ...option, values: [...option.values, value] }
            : option
        ),
      };
      yield* validateCandidateCatalog(product, catalog);
      return yield* repository.addProductOptionValue({
        optionId,
        productId,
        value,
      });
    }),
  addProductTag: ({ productId, tag }) =>
    Effect.gen(function* addProductTagEffect() {
      const product = yield* requireProduct(repository, productId);
      const normalizedTag = tag.trim();
      const normalizedTags = dedupeTrimmedValues([
        ...product.catalog.tags,
        normalizedTag,
      ]);
      yield* validateCandidateCatalog(product, {
        ...product.catalog,
        tags: normalizedTags,
      });

      if (product.catalog.tags.includes(normalizedTag)) {
        return product;
      }

      return yield* repository.addProductTag(productId, normalizedTag);
    }),
  addProductVariant: ({ productId, variant }) =>
    Effect.gen(function* addProductVariantEffect() {
      const product = yield* requireProduct(repository, productId);
      yield* validateCandidateCatalog(product, {
        ...product.catalog,
        variants: [...product.catalog.variants, variant],
      });
      return yield* repository.addProductVariant(productId, variant);
    }),
  createProductDraft: (input) =>
    Effect.gen(function* createProductDraftEffect() {
      const handle = normalizeHandle(input.handle);
      const title = input.title.trim();

      if (!handle) {
        return yield* new ProductCatalogValidationFailure({
          message: "Product handle is required.",
        });
      }

      if (!title) {
        return yield* new ProductCatalogValidationFailure({
          message: "Product title is required.",
        });
      }

      const existing = yield* repository.findProductByHandle(handle);
      if (existing) {
        return yield* new ProductHandleConflict({ handle });
      }

      const now = clock.now();
      const productId = yield* createProductIdEffect(
        createPrefixedId(idGenerator, PRODUCT_ID_PREFIX)
      );
      const product: ProductRecord = {
        catalog: createEmptyProductCatalog(),
        createdAt: now,
        handle,
        id: productId,
        status: normalizeStatus(input.status),
        title,
        updatedAt: now,
      };

      return yield* repository.saveProduct(product);
    }),
  getProductById: (id) => repository.findProductById(id),
  listProducts: repository.listProducts,
  setProductCatalogMetadata: (input) =>
    Effect.gen(function* setProductCatalogMetadataEffect() {
      yield* requireProduct(repository, input.productId);
      return yield* repository.setProductCatalogMetadata({
        ...input,
        searchableText: input.searchableText?.trim(),
      });
    }),
  updateProductCatalog: (input) =>
    Effect.gen(function* updateProductCatalogEffect() {
      const product = yield* requireProduct(repository, input.id);
      const catalog = mergeProductCatalog(product.catalog, input.catalog);
      yield* validateCatalogStructure(catalog);
      return yield* repository.updateProduct({
        ...product,
        catalog,
        updatedAt: clock.now(),
      });
    }),
  validateProductVariant: ({ productId, variantId }) =>
    Effect.gen(function* validateProductVariantEffect() {
      const product = yield* repository.findProductById(productId);
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
    }),
});

export const createProductRepositoryLayer = (repository: ProductRepository) =>
  Layer.succeed(ProductRepositoryService, repository);

export const createProductServiceFromDependenciesLayer = () =>
  Layer.effect(
    ProductService,
    Effect.gen(function* productServiceLayerEffect() {
      const repository = yield* ProductRepositoryService;
      const clock = yield* ClockService;
      const idGenerator = yield* IdGeneratorService;

      return createProductService({
        clock,
        idGenerator,
        repository,
      });
    })
  );

export const createProductServiceLayer = (service: ProductServiceShape) =>
  Layer.succeed(ProductService, service);

import { Context } from "effect";
import type { Effect as EffectValue } from "effect/Effect";

import type { ProductExpectedError } from "./product.errors";
import type {
  CreateProductInputSchema,
  ProductApiListSchema,
  ProductApiRecordSchema,
  ProductCatalogApiSchema,
  ProductCatalogSchema,
  ProductCategoryReferenceSchema,
  ProductCollectionReferenceSchema,
  ProductIdentifierSchema,
  ProductIdSchema,
  ProductMediaReferenceSchema,
  ProductOptionSchema,
  ProductOptionValueSchema,
  ProductRecordSchema,
  ProductStatusSchema,
  ProductVariantSchema,
  ProductVariantStatusSchema,
  ProductVariantValidationInputSchema,
  ProductVariantValidationResultSchema,
  UpdateProductCatalogInputSchema,
} from "./product.schema";

export type ProductStatus = typeof ProductStatusSchema.Type;
export type ProductVariantStatus = typeof ProductVariantStatusSchema.Type;
export type ProductId = typeof ProductIdSchema.Type;
export type CreateProductInput = typeof CreateProductInputSchema.Type;
export type UpdateProductCatalogInput =
  typeof UpdateProductCatalogInputSchema.Type;
export type ProductIdentifierInput = typeof ProductIdentifierSchema.Type;
export type ProductVariantValidationInput =
  typeof ProductVariantValidationInputSchema.Type;
export type ProductVariantValidationResult =
  typeof ProductVariantValidationResultSchema.Type;
export type ProductCatalog = typeof ProductCatalogSchema.Type;
export type ProductCatalogApi = typeof ProductCatalogApiSchema.Type;
export type ProductOption = typeof ProductOptionSchema.Type;
export type ProductOptionValue = typeof ProductOptionValueSchema.Type;
export type ProductVariant = typeof ProductVariantSchema.Type;
export type ProductCollectionReference =
  typeof ProductCollectionReferenceSchema.Type;
export type ProductCategoryReference =
  typeof ProductCategoryReferenceSchema.Type;
export type ProductMediaReference = typeof ProductMediaReferenceSchema.Type;
export type ProductRecord = typeof ProductRecordSchema.Type;
export type ProductApiRecord = typeof ProductApiRecordSchema.Type;
export type ProductApiList = typeof ProductApiListSchema.Type;

export interface ProductRepository {
  readonly addProductCategory: (
    productId: ProductId,
    category: ProductCategoryReference
  ) => EffectValue<ProductRecord, ProductExpectedError>;
  readonly addProductCollection: (
    productId: ProductId,
    collection: ProductCollectionReference
  ) => EffectValue<ProductRecord, ProductExpectedError>;
  readonly addProductMedia: (
    productId: ProductId,
    media: ProductMediaReference
  ) => EffectValue<ProductRecord, ProductExpectedError>;
  readonly addProductOption: (
    productId: ProductId,
    option: ProductOption
  ) => EffectValue<ProductRecord, ProductExpectedError>;
  readonly addProductOptionValue: (input: {
    readonly optionId: string;
    readonly productId: ProductId;
    readonly value: ProductOptionValue;
  }) => EffectValue<ProductRecord, ProductExpectedError>;
  readonly addProductTag: (
    productId: ProductId,
    tag: string
  ) => EffectValue<ProductRecord, ProductExpectedError>;
  readonly addProductVariant: (
    productId: ProductId,
    variant: ProductVariant
  ) => EffectValue<ProductRecord, ProductExpectedError>;
  readonly findProductByHandle: (
    handle: string
  ) => EffectValue<ProductRecord | null, ProductExpectedError>;
  readonly findProductById: (
    id: ProductId
  ) => EffectValue<ProductRecord | null, ProductExpectedError>;
  readonly listProducts: EffectValue<
    readonly ProductRecord[],
    ProductExpectedError
  >;
  readonly saveProduct: (
    product: ProductRecord
  ) => EffectValue<ProductRecord, ProductExpectedError>;
  readonly setProductCatalogMetadata: (input: {
    readonly metadata: ProductCatalog["metadata"];
    readonly productId: ProductId;
    readonly publishedAt?: Date | null;
    readonly searchableText?: string;
  }) => EffectValue<ProductRecord, ProductExpectedError>;
  readonly updateProduct: (
    product: ProductRecord
  ) => EffectValue<ProductRecord, ProductExpectedError>;
}

/** Effect-native product repository contract consumed by product services. */
export const ProductRepositoryService = Context.Service<ProductRepository>(
  "@ecommerce/product/ProductRepositoryService"
);

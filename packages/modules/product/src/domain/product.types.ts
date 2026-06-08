import type { Brand } from "@ecommerce/core/brand";
import type { z } from "zod";

import type {
  CreateProductInputSchema,
  ProductCategoryReferenceSchema,
  ProductCollectionReferenceSchema,
  ProductMediaReferenceSchema,
  ProductOptionSchema,
  ProductOptionValueSchema,
  ProductCatalogApiSchema,
  ProductCatalogSchema,
  ProductApiRecordSchema,
  ProductIdentifierSchema,
  ProductVariantSchema,
  ProductVariantStatusSchema,
  ProductVariantValidationInputSchema,
  ProductVariantValidationResultSchema,
  ProductRecordSchema,
  ProductStatusSchema,
  UpdateProductCatalogInputSchema,
} from "./product.schema";

export type ProductStatus = z.infer<typeof ProductStatusSchema>;
export type ProductVariantStatus = z.infer<typeof ProductVariantStatusSchema>;
export type ProductId = Brand<string, "product">;
export type CreateProductInput = z.infer<typeof CreateProductInputSchema>;
export type UpdateProductCatalogInput = z.infer<
  typeof UpdateProductCatalogInputSchema
>;
export type ProductIdentifierInput = z.infer<typeof ProductIdentifierSchema>;
export type ProductVariantValidationInput = z.infer<
  typeof ProductVariantValidationInputSchema
>;
export type ProductVariantValidationResult = z.infer<
  typeof ProductVariantValidationResultSchema
>;
export type ProductCatalog = z.infer<typeof ProductCatalogSchema>;
export type ProductCatalogApi = z.infer<typeof ProductCatalogApiSchema>;
export type ProductOption = z.infer<typeof ProductOptionSchema>;
export type ProductOptionValue = z.infer<typeof ProductOptionValueSchema>;
export type ProductVariant = z.infer<typeof ProductVariantSchema>;
export type ProductCollectionReference = z.infer<
  typeof ProductCollectionReferenceSchema
>;
export type ProductCategoryReference = z.infer<
  typeof ProductCategoryReferenceSchema
>;
export type ProductMediaReference = z.infer<typeof ProductMediaReferenceSchema>;
export type ProductRecord = Omit<z.infer<typeof ProductRecordSchema>, "id"> & {
  readonly id: ProductId;
};
export type ProductApiRecord = z.infer<typeof ProductApiRecordSchema>;

export interface ProductRepository {
  addProductCategory(
    productId: ProductId,
    category: ProductCategoryReference
  ): Promise<ProductRecord>;
  addProductCollection(
    productId: ProductId,
    collection: ProductCollectionReference
  ): Promise<ProductRecord>;
  addProductMedia(
    productId: ProductId,
    media: ProductMediaReference
  ): Promise<ProductRecord>;
  addProductOption(
    productId: ProductId,
    option: ProductOption
  ): Promise<ProductRecord>;
  addProductOptionValue(input: {
    readonly optionId: string;
    readonly productId: ProductId;
    readonly value: ProductOptionValue;
  }): Promise<ProductRecord>;
  addProductTag(productId: ProductId, tag: string): Promise<ProductRecord>;
  addProductVariant(
    productId: ProductId,
    variant: ProductVariant
  ): Promise<ProductRecord>;
  findProductByHandle(handle: string): Promise<ProductRecord | null>;
  findProductById(id: ProductId): Promise<ProductRecord | null>;
  listProducts(): Promise<readonly ProductRecord[]>;
  saveProduct(product: ProductRecord): Promise<ProductRecord>;
  setProductCatalogMetadata(input: {
    readonly metadata: ProductCatalog["metadata"];
    readonly productId: ProductId;
    readonly publishedAt?: Date | null;
    readonly searchableText?: string;
  }): Promise<ProductRecord>;
  updateProduct(product: ProductRecord): Promise<ProductRecord>;
}

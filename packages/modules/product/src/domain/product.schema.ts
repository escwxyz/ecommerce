import { z } from "zod";

export const ProductStatusSchema = z.enum(["draft", "active", "archived"]);
export const ProductVariantStatusSchema = z.enum([
  "draft",
  "active",
  "archived",
]);

export const ProductMetadataSchema = z.record(z.string(), z.string());

export const ProductOptionValueSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  metadata: ProductMetadataSchema.optional(),
  value: z.string().min(1),
});

export const ProductOptionSchema = z.object({
  id: z.string().min(1),
  metadata: ProductMetadataSchema.optional(),
  title: z.string().min(1),
  values: z.array(ProductOptionValueSchema),
});

export const ProductVariantSchema = z.object({
  id: z.string().min(1),
  metadata: ProductMetadataSchema.optional(),
  optionValueIds: z.array(z.string().min(1)),
  searchableText: z.string().optional(),
  sku: z.string().min(1).optional(),
  status: ProductVariantStatusSchema,
  title: z.string().min(1),
});

export const ProductCollectionReferenceSchema = z.object({
  handle: z.string().min(1),
  id: z.string().min(1),
  title: z.string().min(1),
});

export const ProductCategoryReferenceSchema = z.object({
  handle: z.string().min(1),
  id: z.string().min(1),
  parentId: z.string().min(1).optional(),
  title: z.string().min(1),
});

export const ProductMediaReferenceSchema = z.object({
  altText: z.string().optional(),
  id: z.string().min(1),
  metadata: ProductMetadataSchema.optional(),
  type: z.enum(["image", "video", "file"]),
  url: z.string().min(1),
});

export const ProductCatalogSchema = z.object({
  categories: z.array(ProductCategoryReferenceSchema),
  collections: z.array(ProductCollectionReferenceSchema),
  media: z.array(ProductMediaReferenceSchema),
  metadata: ProductMetadataSchema,
  options: z.array(ProductOptionSchema),
  publishedAt: z.date().nullable(),
  searchableText: z.string(),
  tags: z.array(z.string().min(1)),
  variants: z.array(ProductVariantSchema),
});

export const ProductCatalogApiSchema = ProductCatalogSchema.extend({
  publishedAt: z.string().min(1).nullable(),
});

export const CreateProductInputSchema = z.object({
  handle: z.string().min(1),
  status: ProductStatusSchema.optional(),
  title: z.string().min(1),
});

export const UpdateProductCatalogInputSchema = z
  .object({
    catalog: ProductCatalogSchema.partial(),
    id: z.string().min(1).startsWith("prod_"),
  })
  .strict();

export const ProductIdentifierSchema = z.object({
  id: z.string().min(1).startsWith("prod_"),
});

export const ProductVariantValidationInputSchema = z.object({
  productId: z.string().min(1).startsWith("prod_"),
  variantId: z.string().min(1),
});

export const ProductRecordSchema = z.object({
  catalog: ProductCatalogSchema,
  createdAt: z.date(),
  handle: z.string(),
  id: z.string().min(1).startsWith("prod_"),
  status: ProductStatusSchema,
  title: z.string(),
  updatedAt: z.date(),
});

export const ProductApiRecordSchema = z.object({
  catalog: ProductCatalogApiSchema,
  createdAt: z.string().min(1),
  handle: z.string(),
  id: z.string().min(1).startsWith("prod_"),
  status: ProductStatusSchema,
  title: z.string(),
  updatedAt: z.string().min(1),
});

export const ProductVariantValidationResultSchema = z.object({
  productId: z.string().min(1).startsWith("prod_"),
  productStatus: ProductStatusSchema,
  valid: z.boolean(),
  variantId: z.string().min(1),
  variantStatus: ProductVariantStatusSchema.nullable(),
});

export const ProductApiListSchema = z.array(ProductApiRecordSchema);

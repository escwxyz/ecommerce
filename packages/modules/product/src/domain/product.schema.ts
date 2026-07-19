import { Schema } from "effect";

const isCanonicalIsoDateTime = (value: string): boolean => {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
};

/** Stable commerce product identifier owned by the product module. */
export const ProductIdSchema = Schema.NonEmptyString.pipe(
  Schema.check(Schema.isStartsWith("prod_")),
  Schema.brand("ProductId")
);

/** Serialized product identifier used by API and storage boundaries. */
export const ProductSerializedIdSchema = Schema.NonEmptyString.pipe(
  Schema.check(Schema.isStartsWith("prod_"))
);

export const ProductTrimmedStringSchema = Schema.Trimmed.pipe(
  Schema.check(Schema.isMinLength(1))
);

/** Canonical UTC ISO datetime string emitted by product API serializers. */
export const ProductIsoDateTimeStringSchema = ProductTrimmedStringSchema.pipe(
  Schema.check(Schema.makeFilter(isCanonicalIsoDateTime))
);

export const ProductStatusSchema = Schema.Literals([
  "draft",
  "active",
  "archived",
]);
export const ProductVariantStatusSchema = Schema.Literals([
  "draft",
  "active",
  "archived",
]);

export const ProductMetadataSchema = Schema.Record(
  Schema.String,
  Schema.String
);

export const ProductOptionValueSchema = Schema.Struct({
  id: ProductTrimmedStringSchema,
  label: ProductTrimmedStringSchema,
  metadata: Schema.optional(ProductMetadataSchema),
  value: ProductTrimmedStringSchema,
});

export const ProductOptionSchema = Schema.Struct({
  id: ProductTrimmedStringSchema,
  metadata: Schema.optional(ProductMetadataSchema),
  title: ProductTrimmedStringSchema,
  values: Schema.Array(ProductOptionValueSchema),
});

export const ProductVariantSchema = Schema.Struct({
  id: ProductTrimmedStringSchema,
  metadata: Schema.optional(ProductMetadataSchema),
  optionValueIds: Schema.Array(ProductTrimmedStringSchema),
  searchableText: Schema.optional(Schema.String),
  sku: Schema.optional(ProductTrimmedStringSchema),
  status: ProductVariantStatusSchema,
  title: ProductTrimmedStringSchema,
});

export const ProductCollectionReferenceSchema = Schema.Struct({
  handle: ProductTrimmedStringSchema,
  id: ProductTrimmedStringSchema,
  title: ProductTrimmedStringSchema,
});

export const ProductCategoryReferenceSchema = Schema.Struct({
  handle: ProductTrimmedStringSchema,
  id: ProductTrimmedStringSchema,
  parentId: Schema.optional(ProductTrimmedStringSchema),
  title: ProductTrimmedStringSchema,
});

export const ProductMediaReferenceSchema = Schema.Struct({
  altText: Schema.optional(Schema.String),
  id: ProductTrimmedStringSchema,
  metadata: Schema.optional(ProductMetadataSchema),
  type: Schema.Literals(["image", "video", "file"]),
  url: ProductTrimmedStringSchema,
});

export const ProductCatalogSchema = Schema.Struct({
  categories: Schema.Array(ProductCategoryReferenceSchema),
  collections: Schema.Array(ProductCollectionReferenceSchema),
  media: Schema.Array(ProductMediaReferenceSchema),
  metadata: ProductMetadataSchema,
  options: Schema.Array(ProductOptionSchema),
  publishedAt: Schema.NullOr(Schema.Date),
  searchableText: Schema.String,
  tags: Schema.Array(ProductTrimmedStringSchema),
  variants: Schema.Array(ProductVariantSchema),
});

export const ProductCatalogApiSchema = Schema.Struct({
  categories: Schema.Array(ProductCategoryReferenceSchema),
  collections: Schema.Array(ProductCollectionReferenceSchema),
  media: Schema.Array(ProductMediaReferenceSchema),
  metadata: ProductMetadataSchema,
  options: Schema.Array(ProductOptionSchema),
  publishedAt: Schema.NullOr(ProductIsoDateTimeStringSchema),
  searchableText: Schema.String,
  tags: Schema.Array(ProductTrimmedStringSchema),
  variants: Schema.Array(ProductVariantSchema),
});

export const CreateProductInputSchema = Schema.Struct({
  handle: ProductTrimmedStringSchema,
  status: Schema.optional(ProductStatusSchema),
  title: ProductTrimmedStringSchema,
});

export const UpdateProductCatalogInputSchema = Schema.Struct({
  catalog: Schema.Struct({
    categories: Schema.optional(Schema.Array(ProductCategoryReferenceSchema)),
    collections: Schema.optional(
      Schema.Array(ProductCollectionReferenceSchema)
    ),
    media: Schema.optional(Schema.Array(ProductMediaReferenceSchema)),
    metadata: Schema.optional(ProductMetadataSchema),
    options: Schema.optional(Schema.Array(ProductOptionSchema)),
    publishedAt: Schema.optional(Schema.NullOr(Schema.Date)),
    searchableText: Schema.optional(Schema.String),
    tags: Schema.optional(Schema.Array(ProductTrimmedStringSchema)),
    variants: Schema.optional(Schema.Array(ProductVariantSchema)),
  }),
  id: ProductIdSchema,
});

export const ProductIdentifierSchema = Schema.Struct({
  id: ProductIdSchema,
});

export const ProductVariantValidationInputSchema = Schema.Struct({
  productId: ProductIdSchema,
  variantId: ProductTrimmedStringSchema,
});

export const ProductRecordSchema = Schema.Struct({
  catalog: ProductCatalogSchema,
  createdAt: Schema.Date,
  handle: ProductTrimmedStringSchema,
  id: ProductIdSchema,
  status: ProductStatusSchema,
  title: ProductTrimmedStringSchema,
  updatedAt: Schema.Date,
});

export const ProductApiRecordSchema = Schema.Struct({
  catalog: ProductCatalogApiSchema,
  createdAt: ProductIsoDateTimeStringSchema,
  handle: ProductTrimmedStringSchema,
  id: ProductSerializedIdSchema,
  status: ProductStatusSchema,
  title: ProductTrimmedStringSchema,
  updatedAt: ProductIsoDateTimeStringSchema,
});

export const ProductVariantValidationResultSchema = Schema.Struct({
  productId: ProductSerializedIdSchema,
  productStatus: ProductStatusSchema,
  valid: Schema.Boolean,
  variantId: ProductTrimmedStringSchema,
  variantStatus: Schema.NullOr(ProductVariantStatusSchema),
});

export const ProductApiListSchema = Schema.Array(ProductApiRecordSchema);

import type { RepositoryFailure } from "@ecommerce/core";
/* eslint-disable max-classes-per-file -- product expected failures form one schema-backed domain vocabulary */
import { Schema } from "effect";

import { ProductIdSchema, ProductTrimmedStringSchema } from "./product.schema";

export class ProductInvalidIdentifier extends Schema.TaggedErrorClass<ProductInvalidIdentifier>()(
  "ProductInvalidIdentifier",
  {
    expectedPrefix: ProductTrimmedStringSchema,
    value: Schema.String,
  }
) {}

export class ProductNotFound extends Schema.TaggedErrorClass<ProductNotFound>()(
  "ProductNotFound",
  {
    productId: ProductIdSchema,
  }
) {}

export class ProductHandleConflict extends Schema.TaggedErrorClass<ProductHandleConflict>()(
  "ProductHandleConflict",
  {
    handle: ProductTrimmedStringSchema,
  }
) {}

export class ProductCatalogValidationFailure extends Schema.TaggedErrorClass<ProductCatalogValidationFailure>()(
  "ProductCatalogValidationFailure",
  {
    message: ProductTrimmedStringSchema,
  }
) {}

export type ProductExpectedError =
  | ProductCatalogValidationFailure
  | ProductHandleConflict
  | ProductInvalidIdentifier
  | ProductNotFound
  | RepositoryFailure;

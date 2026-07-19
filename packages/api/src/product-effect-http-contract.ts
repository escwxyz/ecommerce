import {
  RepositoryConflict,
  RepositoryDecodeFailure,
  RepositoryUnavailable,
} from "@ecommerce/core";
import {
  CreateProductInputSchema,
  ProductApiListSchema,
  ProductApiRecordSchema,
  ProductCatalogValidationFailure,
  ProductHandleConflict,
  ProductIdentifierSchema,
  ProductInvalidIdentifier,
  ProductNotFound,
  ProductVariantValidationInputSchema,
  ProductVariantValidationResultSchema,
  UpdateProductCatalogInputSchema,
} from "@ecommerce/product";
import { Schema } from "effect";
import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from "effect/unstable/httpapi";

import {
  EffectHttpAuthMiddleware,
  EffectHttpExecutionMiddleware,
  EffectHttpForbidden,
  EffectHttpRequestContextMiddleware,
} from "./effect-http-middleware";
import { createApiSuccessSchema } from "./http-api-schemas";

const productDomainErrors = [
  ProductCatalogValidationFailure.pipe(HttpApiSchema.status(400)),
  ProductHandleConflict.pipe(HttpApiSchema.status(409)),
  ProductInvalidIdentifier.pipe(HttpApiSchema.status(400)),
  ProductNotFound.pipe(HttpApiSchema.status(404)),
] as const;

const productPersistenceErrors = [
  RepositoryConflict.pipe(HttpApiSchema.status(409)),
  RepositoryDecodeFailure.pipe(HttpApiSchema.status(503)),
  RepositoryUnavailable.pipe(HttpApiSchema.status(503)),
] as const;

export const productReadErrors = [
  EffectHttpForbidden,
  ...productDomainErrors,
  ...productPersistenceErrors,
] as const;

export const productWriteErrors = [
  EffectHttpForbidden,
  ...productDomainErrors,
  ...productPersistenceErrors,
] as const;

export const ProductApiRecordSuccessSchema = createApiSuccessSchema(
  ProductApiRecordSchema
);
export const ProductApiNullableRecordSuccessSchema = createApiSuccessSchema(
  Schema.NullOr(ProductApiRecordSchema)
);
export const ProductApiListSuccessSchema =
  createApiSuccessSchema(ProductApiListSchema);
export const ProductVariantValidationSuccessSchema = createApiSuccessSchema(
  ProductVariantValidationResultSchema
);

const productAdminGroupIdentifier = "productAdmin";

/** Product admin Effect HTTP contract for catalog-management operations. */
export const productAdminHttpApiGroup = HttpApiGroup.make(
  productAdminGroupIdentifier
)
  .add(
    HttpApiEndpoint.post("productCreate", "/admin/products", {
      error: productWriteErrors,
      payload: CreateProductInputSchema,
      success: ProductApiRecordSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.post("productGet", "/admin/products/get", {
      error: productReadErrors,
      payload: ProductIdentifierSchema,
      success: ProductApiNullableRecordSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.get("productList", "/admin/products", {
      error: productReadErrors,
      success: ProductApiListSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.patch("productCatalogUpdate", "/admin/products/catalog", {
      error: productWriteErrors,
      payload: UpdateProductCatalogInputSchema,
      success: ProductApiRecordSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.post(
      "productVariantValidate",
      "/admin/products/variants/validate",
      {
        error: productReadErrors,
        payload: ProductVariantValidationInputSchema,
        success: ProductVariantValidationSuccessSchema,
      }
    )
  )
  .middleware(EffectHttpExecutionMiddleware)
  .middleware(EffectHttpAuthMiddleware)
  .middleware(EffectHttpRequestContextMiddleware);

import {
  EffectHttpAuthMiddleware,
  EffectHttpExecutionMiddleware,
  EffectHttpForbidden,
  EffectHttpRequestContextMiddleware,
} from "@ecommerce/api/effect-http-middleware";
import { createApiSuccessSchema } from "@ecommerce/api/http-api-schemas";
import {
  RepositoryConflict,
  RepositoryDecodeFailure,
  RepositoryUnavailable,
} from "@ecommerce/core";
import { Schema } from "effect";
import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from "effect/unstable/httpapi";

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
} from "../domain";

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

/** Declared HTTP error schemas for this module contract surface. */
export const productReadErrors = [
  EffectHttpForbidden,
  ...productDomainErrors,
  ...productPersistenceErrors,
] as const;

/** Declared HTTP error schemas for this module contract surface. */
export const productWriteErrors = [
  EffectHttpForbidden,
  ...productDomainErrors,
  ...productPersistenceErrors,
] as const;

/** Success envelope schema exported for contract-only API consumers. */
export const ProductApiRecordSuccessSchema = createApiSuccessSchema(
  ProductApiRecordSchema
);
/** Success envelope schema exported for contract-only API consumers. */
export const ProductApiNullableRecordSuccessSchema = createApiSuccessSchema(
  Schema.NullOr(ProductApiRecordSchema)
);
/** Success envelope schema exported for contract-only API consumers. */
export const ProductApiListSuccessSchema =
  createApiSuccessSchema(ProductApiListSchema);
/** Success envelope schema exported for contract-only API consumers. */
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

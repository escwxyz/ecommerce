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
  TransactionalMutationFailure,
} from "@ecommerce/core";
import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from "effect/unstable/httpapi";

import {
  StoreCurrencyListEmpty,
  StoreDefaultCurrencyUnsupported,
  StoreInvalidIdentifier,
} from "../domain/store.errors";
import {
  StoreApiRecordSchema,
  StoreDefaultsApiRecordSchema,
  UpdateStoreSettingsInputSchema,
} from "../domain/store.schema";

const storeDomainValidationErrors = [
  StoreCurrencyListEmpty.pipe(HttpApiSchema.status(400)),
  StoreDefaultCurrencyUnsupported.pipe(HttpApiSchema.status(400)),
  StoreInvalidIdentifier.pipe(HttpApiSchema.status(400)),
] as const;

const storePersistenceErrors = [
  RepositoryConflict.pipe(HttpApiSchema.status(409)),
  RepositoryDecodeFailure.pipe(HttpApiSchema.status(503)),
  RepositoryUnavailable.pipe(HttpApiSchema.status(503)),
  TransactionalMutationFailure.pipe(HttpApiSchema.status(503)),
] as const;

/** Declared HTTP error schemas for this module contract surface. */
export const storeWriteErrors = [
  EffectHttpForbidden,
  ...storeDomainValidationErrors,
  ...storePersistenceErrors,
] as const;

/** Declared HTTP error schemas for this module contract surface. */
export const storeReadErrors = [
  EffectHttpForbidden,
  ...storeDomainValidationErrors,
  ...storePersistenceErrors,
] as const;

/** Success envelope schema exported for contract-only API consumers. */
export const StoreApiRecordSuccessSchema =
  createApiSuccessSchema(StoreApiRecordSchema);
/** Success envelope schema exported for contract-only API consumers. */
export const StoreDefaultsApiRecordSuccessSchema = createApiSuccessSchema(
  StoreDefaultsApiRecordSchema
);

const storeAdminGroupIdentifier = "storeAdmin";
const storeStorefrontGroupIdentifier = "storefrontStore";

/**
 * Store admin Effect HTTP contract. Handler implementation stays in
 * `api.ts` so browser SDK consumers can import storefront
 * contracts without pulling StoreService or repository Layers.
 */
export const storeAdminHttpApiGroup = HttpApiGroup.make(
  storeAdminGroupIdentifier
)
  .add(
    HttpApiEndpoint.get("storeDefaultsGet", "/admin/store/defaults", {
      error: storeReadErrors,
      success: StoreDefaultsApiRecordSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.get("storeSettingsGet", "/admin/store", {
      error: storeReadErrors,
      success: StoreApiRecordSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.patch("storeSettingsUpdate", "/admin/store", {
      error: storeWriteErrors,
      payload: UpdateStoreSettingsInputSchema,
      success: StoreApiRecordSuccessSchema,
    })
  )
  .middleware(EffectHttpExecutionMiddleware)
  .middleware(EffectHttpAuthMiddleware)
  .middleware(EffectHttpRequestContextMiddleware);

/**
 * Store storefront Effect HTTP contract consumed by the SDK's public HTTP and
 * Cloudflare Service Binding transports.
 */
export const storeStorefrontHttpApiGroup = HttpApiGroup.make(
  storeStorefrontGroupIdentifier
)
  .add(
    HttpApiEndpoint.get("storeDefaultsGet", "/store/defaults", {
      error: storeReadErrors,
      success: StoreDefaultsApiRecordSuccessSchema,
    })
  )
  .middleware(EffectHttpExecutionMiddleware)
  .middleware(EffectHttpRequestContextMiddleware);

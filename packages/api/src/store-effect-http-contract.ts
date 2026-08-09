import {
  RepositoryConflict,
  RepositoryDecodeFailure,
  RepositoryUnavailable,
  TransactionalMutationFailure,
} from "@ecommerce/core";
import {
  StoreCurrencyListEmpty,
  StoreDefaultCurrencyUnsupported,
  StoreInvalidIdentifier,
} from "@ecommerce/store/domain/store.errors";
import {
  StoreApiRecordSchema,
  StoreDefaultsApiRecordSchema,
  UpdateStoreSettingsInputSchema,
} from "@ecommerce/store/domain/store.schema";
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

export const storeWriteErrors = [
  EffectHttpForbidden,
  ...storeDomainValidationErrors,
  ...storePersistenceErrors,
] as const;

export const storeReadErrors = [
  EffectHttpForbidden,
  ...storeDomainValidationErrors,
  ...storePersistenceErrors,
] as const;

export const StoreApiRecordSuccessSchema =
  createApiSuccessSchema(StoreApiRecordSchema);
export const StoreDefaultsApiRecordSuccessSchema = createApiSuccessSchema(
  StoreDefaultsApiRecordSchema
);

const storeAdminGroupIdentifier = "storeAdmin";
const storeStorefrontGroupIdentifier = "storefrontStore";

/**
 * Store admin Effect HTTP contract. Handler implementation stays in
 * `store-effect-http-api.ts` so browser SDK consumers can import storefront
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

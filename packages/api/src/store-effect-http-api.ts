import {
  RepositoryConflict,
  RepositoryDecodeFailure,
  RepositoryUnavailable,
} from "@ecommerce/core";
import {
  StoreCurrencyListEmpty,
  StoreDefaultCurrencyUnsupported,
  StoreDefaultsApiRecordSchema,
  StoreEventPublishFailure,
  StoreInvalidIdentifier,
  StoreService,
  StoreApiRecordSchema,
  UpdateStoreSettingsInputSchema,
  serializeStoreId,
  storePermissions,
} from "@ecommerce/store";
import type { StoreDefaults, StoreSettings } from "@ecommerce/store";
import { Effect } from "effect";
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from "effect/unstable/httpapi";

import {
  defineAdminHttpApiGroupContribution,
  defineEffectHttpApiModuleContribution,
  defineStorefrontHttpApiGroupContribution,
} from "./effect-http-api";
import {
  CurrentEffectHttpRequestContext,
  EffectHttpAuthMiddleware,
  EffectHttpExecutionMiddleware,
  EffectHttpForbidden,
  EffectHttpRequestContextMiddleware,
  withEffectHttpPermission,
} from "./effect-http-middleware";
import type { EffectHttpRequestIdentity } from "./effect-http-middleware";
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
] as const;

const storeWriteErrors = [
  EffectHttpForbidden,
  StoreEventPublishFailure.pipe(HttpApiSchema.status(503)),
  ...storeDomainValidationErrors,
  ...storePersistenceErrors,
] as const;

const storeReadErrors = [
  EffectHttpForbidden,
  StoreEventPublishFailure.pipe(HttpApiSchema.status(503)),
  ...storeDomainValidationErrors,
  ...storePersistenceErrors,
] as const;

const StoreApiRecordSuccessSchema =
  createApiSuccessSchema(StoreApiRecordSchema);
const StoreDefaultsApiRecordSuccessSchema = createApiSuccessSchema(
  StoreDefaultsApiRecordSchema
);

const serializeStoreSettings = (
  settings: StoreSettings
): typeof StoreApiRecordSchema.Type => ({
  createdAt: settings.createdAt.toISOString(),
  defaultCurrencyCode: settings.defaultCurrencyCode,
  defaultLocale: settings.defaultLocale,
  defaultRegionId: settings.defaultRegionId,
  defaultSalesChannelId: settings.defaultSalesChannelId,
  id: serializeStoreId(settings.id),
  metadata: settings.metadata,
  name: settings.name,
  supportedCurrencyCodes: [...settings.supportedCurrencyCodes],
  timezone: settings.timezone,
  updatedAt: settings.updatedAt.toISOString(),
});

const serializeStoreDefaults = (
  defaults: StoreDefaults
): typeof StoreDefaultsApiRecordSchema.Type => ({
  defaultCurrencyCode: defaults.defaultCurrencyCode,
  defaultLocale: defaults.defaultLocale,
  defaultRegionId: defaults.defaultRegionId,
  defaultSalesChannelId: defaults.defaultSalesChannelId,
  supportedCurrencyCodes: [...defaults.supportedCurrencyCodes],
  timezone: defaults.timezone,
});

const withSuccessEnvelope = <TData>(
  data: TData,
  request: EffectHttpRequestIdentity
) =>
  ({
    data,
    meta: { request },
    success: true,
  }) as const;

const withCurrentRequest = <TData, TError, TRequirements>(
  effect: Effect.Effect<TData, TError, TRequirements>
) =>
  Effect.gen(function* createStoreApiSuccessEnvelope() {
    const context = yield* CurrentEffectHttpRequestContext;
    const data = yield* effect;
    return withSuccessEnvelope(data, context.identity);
  });

const storeAdminGroupIdentifier = "storeAdmin";
const storeStorefrontGroupIdentifier = "storefrontStore";

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

const storeAdminHttpApi = HttpApi.make("StoreAdminApi").add(
  storeAdminHttpApiGroup
);
const storeStorefrontHttpApi = HttpApi.make("StoreStorefrontApi").add(
  storeStorefrontHttpApiGroup
);

export const storeAdminHttpApiHandlers = HttpApiBuilder.group(
  storeAdminHttpApi,
  storeAdminGroupIdentifier,
  (handlers) =>
    handlers
      .handle("storeDefaultsGet", () =>
        withEffectHttpPermission(
          withCurrentRequest(
            StoreService.use((service) =>
              service.getStoreDefaults.pipe(Effect.map(serializeStoreDefaults))
            )
          ),
          storePermissions.read
        )
      )
      .handle("storeSettingsGet", () =>
        withEffectHttpPermission(
          withCurrentRequest(
            StoreService.use((service) =>
              service.getStoreSettings.pipe(Effect.map(serializeStoreSettings))
            )
          ),
          storePermissions.read
        )
      )
      .handle("storeSettingsUpdate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            StoreService.use((service) =>
              service
                .updateStoreSettings(payload)
                .pipe(Effect.map(serializeStoreSettings))
            )
          ),
          storePermissions.write
        )
      )
);

export const storeStorefrontHttpApiHandlers = HttpApiBuilder.group(
  storeStorefrontHttpApi,
  storeStorefrontGroupIdentifier,
  (handlers) =>
    handlers.handle("storeDefaultsGet", () =>
      withCurrentRequest(
        StoreService.use((service) =>
          service.getStoreDefaults.pipe(Effect.map(serializeStoreDefaults))
        )
      )
    )
);

export const storeEffectHttpApiContribution =
  defineEffectHttpApiModuleContribution({
    groups: [
      defineAdminHttpApiGroupContribution({
        group: storeAdminHttpApiGroup,
        handlers: storeAdminHttpApiHandlers,
        key: "module:store.admin",
        owner: "module",
      }),
      defineStorefrontHttpApiGroupContribution({
        group: storeStorefrontHttpApiGroup,
        handlers: storeStorefrontHttpApiHandlers,
        key: "module:store.storefront",
        owner: "module",
      }),
    ],
    moduleName: "store",
  });

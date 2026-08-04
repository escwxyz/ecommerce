import {
  StoreService,
  serializeStoreId,
  storePermissions,
} from "@ecommerce/store";
import type {
  StoreApiRecordSchema,
  StoreDefaults,
  StoreDefaultsApiRecordSchema,
  StoreSettings,
} from "@ecommerce/store";
import { Effect } from "effect";
import { HttpApi, HttpApiBuilder } from "effect/unstable/httpapi";

import {
  defineAdminHttpApiGroupContribution,
  defineEffectHttpApiModuleContribution,
  defineStorefrontHttpApiGroupContribution,
} from "./effect-http-api";
import {
  CurrentEffectHttpRequestContext,
  withEffectHttpPermission,
} from "./effect-http-middleware";
import type { EffectHttpRequestIdentity } from "./effect-http-middleware";
import {
  storeAdminHttpApiGroup,
  storeStorefrontHttpApiGroup,
} from "./store-effect-http-contract";

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

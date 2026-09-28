import {
  CurrentEffectHttpRequestContext,
  withEffectHttpPermission,
} from "@ecommerce/api/effect-http-middleware";
import type { EffectHttpRequestIdentity } from "@ecommerce/api/effect-http-middleware";
import { defineCommerceModuleApiGroupContribution } from "@ecommerce/core";
import { Effect } from "effect";
import { HttpApi, HttpApiBuilder } from "effect/unstable/httpapi";

import { serializeStoreId } from "../domain";
import type {
  StoreApiRecordSchema,
  StoreDefaults,
  StoreDefaultsApiRecordSchema,
  StoreSettings,
} from "../domain";
import { storePermissions } from "../permissions";
import { StoreService } from "../services";
import {
  storeAdminHttpApiGroup,
  storeStorefrontHttpApiGroup,
} from "./contract";

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

/** Public Effect HTTP handlers supplied by this module contribution. */
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

/** Public Effect HTTP handlers supplied by this module contribution. */
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

/** Executable HTTP contribution registered by the owning module definition. */
export const storeEffectHttpApiContribution = {
  groups: [
    defineCommerceModuleApiGroupContribution({
      group: storeAdminHttpApiGroup,
      handlers: storeAdminHttpApiHandlers,
      key: "module:store.admin",
      surface: "admin",
    }),
    defineCommerceModuleApiGroupContribution({
      group: storeStorefrontHttpApiGroup,
      handlers: storeStorefrontHttpApiHandlers,
      key: "module:store.storefront",
      surface: "storefront",
    }),
  ],
  moduleName: "store",
} as const;

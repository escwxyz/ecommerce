import { defineCommerceModule } from "@ecommerce/core";

import { storeAdminSurfaces } from "../admin";
import { storePermissionList } from "../permissions";
import { storeApiFragment } from "../router";
import { STORE_SETTINGS_UPDATED_EVENT, StoreService } from "../services";

export const storeExtensionPoints = {
  defaultsConsumers: "store.defaults.consumers",
  settingsValidators: "store.settings.validators",
} as const;

export const storeModule = defineCommerceModule({
  contributions: {
    adminSurfaces: storeAdminSurfaces,
    apiFragments: [storeApiFragment],
    eventTypes: [STORE_SETTINGS_UPDATED_EVENT],
    permissions: storePermissionList,
  },
  dependencies: [],
  key: "store",
  providedServices: [{ key: "store-service", service: StoreService }],
});

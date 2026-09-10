import {
  defineCommerceModule,
  defineCommerceModuleServiceContribution,
} from "@ecommerce/core";

import { storeAdminSurfaces } from "../admin";
import { storePermissionList } from "../permissions";
import {
  STORE_SETTINGS_UPDATED_EVENT,
  StoreService,
  createStoreServiceFromDependenciesLayer,
} from "../services";

export const storeExtensionPoints = {
  defaultsConsumers: "store.defaults.consumers",
  settingsValidators: "store.settings.validators",
} as const;

export const storeModule = defineCommerceModule({
  contributions: {
    adminSurfaces: storeAdminSurfaces,
    eventTypes: [STORE_SETTINGS_UPDATED_EVENT],
    permissions: storePermissionList,
    services: [
      defineCommerceModuleServiceContribution({
        key: "store:service",
        layer: createStoreServiceFromDependenciesLayer(),
        service: StoreService,
      }),
    ],
  },
  dependencies: [],
  key: "store",
});

import {
  defineCommerceModule,
  defineCommerceModuleServiceContribution,
} from "@ecommerce/core";
import { Effect } from "effect";

import { inventoryAdminSurfaces } from "../admin";
import { inventoryPermissionList } from "../permissions";
import {
  INVENTORY_ADJUSTED_EVENT,
  INVENTORY_RESERVED_EVENT,
  InventoryService,
  createInventoryServiceFromDependenciesLayer,
} from "../services";

export const inventoryExtensionPoints = {
  availabilityScopes: "inventory.availability-scopes",
  reservationConsumers: "inventory.reservation-consumers",
  stockAdjustmentPolicies: "inventory.stock-adjustment-policies",
} as const;

export const inventoryModule = defineCommerceModule({
  contributions: {
    adminSurfaces: inventoryAdminSurfaces,
    eventTypes: [INVENTORY_RESERVED_EVENT, INVENTORY_ADJUSTED_EVENT],
    permissions: inventoryPermissionList,
    services: [
      defineCommerceModuleServiceContribution({
        key: "inventory:service",
        layer: createInventoryServiceFromDependenciesLayer(),
        service: InventoryService,
      }),
    ],
    workflowSteps: [
      {
        name: "inventory.reserve",
        run: () =>
          Effect.succeed({
            output: {
              contract: "inventory.reserveInventory",
            },
          }),
      },
      {
        name: "inventory.adjust",
        run: () =>
          Effect.succeed({
            output: {
              contract: "inventory.adjustInventory",
            },
          }),
      },
    ],
  },
  dependencies: [],
  key: "inventory",
});

import { defineCommerceModule } from "@ecommerce/core";
import { Effect } from "effect";

import { inventoryAdminSurfaces } from "../admin";
import { inventoryPermissionList } from "../permissions";
import { inventoryApiFragment } from "../router";
import {
  INVENTORY_ADJUSTED_EVENT,
  INVENTORY_RESERVED_EVENT,
  InventoryService,
} from "../services";

export const inventoryExtensionPoints = {
  availabilityScopes: "inventory.availability-scopes",
  reservationConsumers: "inventory.reservation-consumers",
  stockAdjustmentPolicies: "inventory.stock-adjustment-policies",
} as const;

export const inventoryModule = defineCommerceModule({
  contributions: {
    adminSurfaces: inventoryAdminSurfaces,
    apiFragments: [inventoryApiFragment],
    eventTypes: [INVENTORY_RESERVED_EVENT, INVENTORY_ADJUSTED_EVENT],
    permissions: inventoryPermissionList,
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
  providedServices: [{ key: "inventory-service", service: InventoryService }],
  schema: {
    tables: [
      "inventory_item",
      "inventory_stock_location",
      "inventory_level",
      "inventory_reservation",
      "inventory_adjustment_event",
    ],
  },
});

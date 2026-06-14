import { brand } from "@ecommerce/core/brand";

import type {
  InventoryAdjustmentEventId,
  InventoryItemId,
  InventoryLevelId,
  InventoryReservationId,
  StockLocationId,
} from "./inventory.types";

export const INVENTORY_ITEM_ID_PREFIX = "iitem_" as const;
export const STOCK_LOCATION_ID_PREFIX = "sloc_" as const;
export const INVENTORY_LEVEL_ID_PREFIX = "ilvl_" as const;
export const INVENTORY_RESERVATION_ID_PREFIX = "ires_" as const;
export const INVENTORY_ADJUSTMENT_EVENT_ID_PREFIX = "iadj_" as const;

const assertPrefixedId = (
  value: string,
  prefix: string,
  label: string
): void => {
  if (!value.startsWith(prefix)) {
    throw new Error(`${label} must start with "${prefix}".`);
  }
};

export const createInventoryItemId = (value: string): InventoryItemId => {
  assertPrefixedId(value, INVENTORY_ITEM_ID_PREFIX, "Inventory item ID");
  return brand<"inventory-item", string>(value);
};

export const createStockLocationId = (value: string): StockLocationId => {
  assertPrefixedId(value, STOCK_LOCATION_ID_PREFIX, "Stock location ID");
  return brand<"stock-location", string>(value);
};

export const createInventoryLevelId = (value: string): InventoryLevelId => {
  assertPrefixedId(value, INVENTORY_LEVEL_ID_PREFIX, "Inventory level ID");
  return brand<"inventory-level", string>(value);
};

export const createInventoryReservationId = (
  value: string
): InventoryReservationId => {
  assertPrefixedId(
    value,
    INVENTORY_RESERVATION_ID_PREFIX,
    "Inventory reservation ID"
  );
  return brand<"inventory-reservation", string>(value);
};

export const createInventoryAdjustmentEventId = (
  value: string
): InventoryAdjustmentEventId => {
  assertPrefixedId(
    value,
    INVENTORY_ADJUSTMENT_EVENT_ID_PREFIX,
    "Inventory adjustment event ID"
  );
  return brand<"inventory-adjustment-event", string>(value);
};

export const serializeInventoryItemId = (id: InventoryItemId): string => id;
export const serializeStockLocationId = (id: StockLocationId): string => id;
export const serializeInventoryLevelId = (id: InventoryLevelId): string => id;
export const serializeInventoryReservationId = (
  id: InventoryReservationId
): string => id;
export const serializeInventoryAdjustmentEventId = (
  id: InventoryAdjustmentEventId
): string => id;

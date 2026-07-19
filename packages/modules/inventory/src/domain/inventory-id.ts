import { Effect, Schema } from "effect";
import type { Effect as EffectValue } from "effect/Effect";

import { InventoryInvalidIdentifier } from "./inventory.errors";
import {
  InventoryAdjustmentEventIdSchema,
  InventoryItemIdSchema,
  InventoryLevelIdSchema,
  InventoryReservationIdSchema,
  StockLocationIdSchema,
} from "./inventory.schema";
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

const toInvalidIdentifier = (
  expectedPrefix: string,
  value: string
): InventoryInvalidIdentifier =>
  new InventoryInvalidIdentifier({ expectedPrefix, value });

export const createInventoryItemId = (value: string): InventoryItemId =>
  value as InventoryItemId;
export const createInventoryItemIdEffect = (
  value: string
): EffectValue<InventoryItemId, InventoryInvalidIdentifier> =>
  Schema.decodeUnknownEffect(InventoryItemIdSchema)(value).pipe(
    Effect.mapError(() => toInvalidIdentifier(INVENTORY_ITEM_ID_PREFIX, value))
  );
export const serializeInventoryItemId = (id: InventoryItemId): string => id;

export const createStockLocationId = (value: string): StockLocationId =>
  value as StockLocationId;
export const createStockLocationIdEffect = (
  value: string
): EffectValue<StockLocationId, InventoryInvalidIdentifier> =>
  Schema.decodeUnknownEffect(StockLocationIdSchema)(value).pipe(
    Effect.mapError(() => toInvalidIdentifier(STOCK_LOCATION_ID_PREFIX, value))
  );
export const serializeStockLocationId = (id: StockLocationId): string => id;

export const createInventoryLevelId = (value: string): InventoryLevelId =>
  value as InventoryLevelId;
export const createInventoryLevelIdEffect = (
  value: string
): EffectValue<InventoryLevelId, InventoryInvalidIdentifier> =>
  Schema.decodeUnknownEffect(InventoryLevelIdSchema)(value).pipe(
    Effect.mapError(() => toInvalidIdentifier(INVENTORY_LEVEL_ID_PREFIX, value))
  );
export const serializeInventoryLevelId = (id: InventoryLevelId): string => id;

export const createInventoryReservationId = (
  value: string
): InventoryReservationId => value as InventoryReservationId;
export const createInventoryReservationIdEffect = (
  value: string
): EffectValue<InventoryReservationId, InventoryInvalidIdentifier> =>
  Schema.decodeUnknownEffect(InventoryReservationIdSchema)(value).pipe(
    Effect.mapError(() =>
      toInvalidIdentifier(INVENTORY_RESERVATION_ID_PREFIX, value)
    )
  );
export const serializeInventoryReservationId = (
  id: InventoryReservationId
): string => id;

export const createInventoryAdjustmentEventId = (
  value: string
): InventoryAdjustmentEventId => value as InventoryAdjustmentEventId;
export const createInventoryAdjustmentEventIdEffect = (
  value: string
): EffectValue<InventoryAdjustmentEventId, InventoryInvalidIdentifier> =>
  Schema.decodeUnknownEffect(InventoryAdjustmentEventIdSchema)(value).pipe(
    Effect.mapError(() =>
      toInvalidIdentifier(INVENTORY_ADJUSTMENT_EVENT_ID_PREFIX, value)
    )
  );
export const serializeInventoryAdjustmentEventId = (
  id: InventoryAdjustmentEventId
): string => id;

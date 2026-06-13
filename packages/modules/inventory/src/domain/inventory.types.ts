import type { Brand } from "@ecommerce/core/brand";
import type { z } from "zod";

import type {
  AdjustInventoryInputSchema,
  CreateInventoryItemInputSchema,
  CreateStockLocationInputSchema,
  InventoryAdjustmentEventApiRecordSchema,
  InventoryAdjustmentEventRecordSchema,
  InventoryAdjustmentReasonSchema,
  InventoryAvailabilityApiSchema,
  InventoryAvailabilityInputSchema,
  InventoryAvailabilitySchema,
  InventoryItemApiRecordSchema,
  InventoryItemRecordSchema,
  InventoryLevelApiRecordSchema,
  InventoryLevelRecordSchema,
  InventoryReservationApiRecordSchema,
  InventoryReservationRecordSchema,
  InventoryReservationStatusSchema,
  ReservationResultApiSchema,
  ReservationResultSchema,
  ReserveInventoryInputSchema,
  SetInventoryLevelInputSchema,
  StockLocationApiRecordSchema,
  StockLocationRecordSchema,
} from "./inventory.schema";

export type InventoryItemId = Brand<string, "inventory-item">;
export type StockLocationId = Brand<string, "stock-location">;
export type InventoryLevelId = Brand<string, "inventory-level">;
export type InventoryReservationId = Brand<string, "inventory-reservation">;
export type InventoryAdjustmentEventId = Brand<
  string,
  "inventory-adjustment-event"
>;

export type CreateInventoryItemInput = z.infer<
  typeof CreateInventoryItemInputSchema
>;
export type InventoryItemRecord = Omit<
  z.infer<typeof InventoryItemRecordSchema>,
  "id"
> & { readonly id: InventoryItemId };
export type InventoryItemApiRecord = z.infer<
  typeof InventoryItemApiRecordSchema
>;
export type CreateStockLocationInput = z.infer<
  typeof CreateStockLocationInputSchema
>;
export type StockLocationRecord = Omit<
  z.infer<typeof StockLocationRecordSchema>,
  "id"
> & { readonly id: StockLocationId };
export type StockLocationApiRecord = z.infer<
  typeof StockLocationApiRecordSchema
>;
export type SetInventoryLevelInput = z.infer<
  typeof SetInventoryLevelInputSchema
>;
export type InventoryLevelRecord = Omit<
  z.infer<typeof InventoryLevelRecordSchema>,
  "id" | "inventoryItemId" | "stockLocationId"
> & {
  readonly id: InventoryLevelId;
  readonly inventoryItemId: InventoryItemId;
  readonly stockLocationId: StockLocationId;
};
export type InventoryLevelApiRecord = z.infer<
  typeof InventoryLevelApiRecordSchema
>;
export type InventoryReservationStatus = z.infer<
  typeof InventoryReservationStatusSchema
>;
export type ReserveInventoryInput = z.infer<typeof ReserveInventoryInputSchema>;
export type InventoryReservationRecord = Omit<
  z.infer<typeof InventoryReservationRecordSchema>,
  "id" | "inventoryItemId" | "stockLocationId"
> & {
  readonly id: InventoryReservationId;
  readonly inventoryItemId: InventoryItemId;
  readonly stockLocationId: StockLocationId;
};
export type InventoryReservationApiRecord = z.infer<
  typeof InventoryReservationApiRecordSchema
>;
export type InventoryAvailabilityInput = z.infer<
  typeof InventoryAvailabilityInputSchema
>;
export type InventoryAvailability = Omit<
  z.infer<typeof InventoryAvailabilitySchema>,
  "inventoryItemId" | "scopedBy"
> & {
  readonly inventoryItemId: InventoryItemId;
  readonly scopedBy: {
    readonly salesChannelId?: string;
    readonly stockLocationId?: StockLocationId;
  };
};
export type InventoryAvailabilityApiRecord = z.infer<
  typeof InventoryAvailabilityApiSchema
>;
export type InventoryAdjustmentReason = z.infer<
  typeof InventoryAdjustmentReasonSchema
>;
export type AdjustInventoryInput = z.infer<typeof AdjustInventoryInputSchema>;
export type InventoryAdjustmentEventRecord = Omit<
  z.infer<typeof InventoryAdjustmentEventRecordSchema>,
  "id" | "inventoryItemId" | "stockLocationId"
> & {
  readonly id: InventoryAdjustmentEventId;
  readonly inventoryItemId: InventoryItemId;
  readonly stockLocationId: StockLocationId;
};
export type InventoryAdjustmentEventApiRecord = z.infer<
  typeof InventoryAdjustmentEventApiRecordSchema
>;
export type ReservationResult = Omit<
  z.infer<typeof ReservationResultSchema>,
  "availability" | "reservation"
> & {
  readonly availability: InventoryAvailability;
  readonly reservation: InventoryReservationRecord;
};
export type ReservationResultApiRecord = z.infer<
  typeof ReservationResultApiSchema
>;

export type InventoryReservationSaveResult =
  | {
      readonly reservation: InventoryReservationRecord;
      readonly status: "duplicate" | "reserved";
    }
  | {
      readonly status: "insufficient-stock";
    };

export interface InventoryRepository {
  findAdjustmentEvents(
    inventoryItemId: InventoryItemId
  ): Promise<readonly InventoryAdjustmentEventRecord[]>;
  findInventoryItemById(
    id: InventoryItemId
  ): Promise<InventoryItemRecord | null>;
  findLevel(
    inventoryItemId: InventoryItemId,
    stockLocationId: StockLocationId
  ): Promise<InventoryLevelRecord | null>;
  findReservationByIdempotencyKey(
    idempotencyKey: string
  ): Promise<InventoryReservationRecord | null>;
  findReservationsForLevel(
    inventoryItemId: InventoryItemId,
    stockLocationId: StockLocationId
  ): Promise<readonly InventoryReservationRecord[]>;
  findStockLocationById(
    id: StockLocationId
  ): Promise<StockLocationRecord | null>;
  listStockLocationsForSalesChannel(
    salesChannelId: string
  ): Promise<readonly StockLocationRecord[]>;
  saveAdjustmentEvent(
    event: InventoryAdjustmentEventRecord
  ): Promise<InventoryAdjustmentEventRecord>;
  saveInventoryItem(item: InventoryItemRecord): Promise<InventoryItemRecord>;
  saveLevel(level: InventoryLevelRecord): Promise<InventoryLevelRecord>;
  saveReservationIfAvailable(
    reservation: InventoryReservationRecord
  ): Promise<InventoryReservationSaveResult>;
  saveReservation(
    reservation: InventoryReservationRecord
  ): Promise<InventoryReservationRecord>;
  saveStockLocation(
    location: StockLocationRecord
  ): Promise<StockLocationRecord>;
}

import { Context } from "effect";
import type { Effect as EffectValue } from "effect/Effect";

import type { InventoryExpectedError } from "./inventory.errors";
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
  InventoryItemIdSchema,
  InventoryItemRecordSchema,
  InventoryLevelApiRecordSchema,
  InventoryLevelIdSchema,
  InventoryLevelRecordSchema,
  InventoryReservationApiRecordSchema,
  InventoryReservationIdSchema,
  InventoryReservationRecordSchema,
  InventoryReservationStatusSchema,
  ReservationResultApiSchema,
  ReservationResultSchema,
  ReserveInventoryInputSchema,
  SetInventoryLevelInputSchema,
  StockLocationApiRecordSchema,
  StockLocationIdSchema,
  StockLocationRecordSchema,
} from "./inventory.schema";

export type InventoryItemId = typeof InventoryItemIdSchema.Type;
export type StockLocationId = typeof StockLocationIdSchema.Type;
export type InventoryLevelId = typeof InventoryLevelIdSchema.Type;
export type InventoryReservationId = typeof InventoryReservationIdSchema.Type;
export type InventoryAdjustmentEventId =
  (typeof InventoryAdjustmentEventRecordSchema.Type)["id"];

export type CreateInventoryItemInput =
  typeof CreateInventoryItemInputSchema.Type;
export type InventoryItemRecord = typeof InventoryItemRecordSchema.Type;
export type InventoryItemApiRecord = typeof InventoryItemApiRecordSchema.Type;
export type CreateStockLocationInput =
  typeof CreateStockLocationInputSchema.Type;
export type StockLocationRecord = typeof StockLocationRecordSchema.Type;
export type StockLocationApiRecord = typeof StockLocationApiRecordSchema.Type;
export type SetInventoryLevelInput = typeof SetInventoryLevelInputSchema.Type;
export type InventoryLevelRecord = typeof InventoryLevelRecordSchema.Type;
export type InventoryLevelApiRecord = typeof InventoryLevelApiRecordSchema.Type;
export type InventoryReservationStatus =
  typeof InventoryReservationStatusSchema.Type;
export type ReserveInventoryInput = typeof ReserveInventoryInputSchema.Type;
export type InventoryReservationRecord =
  typeof InventoryReservationRecordSchema.Type;
export type InventoryReservationApiRecord =
  typeof InventoryReservationApiRecordSchema.Type;
export type InventoryAvailabilityInput =
  typeof InventoryAvailabilityInputSchema.Type;
export type InventoryAvailability = typeof InventoryAvailabilitySchema.Type;
export type InventoryAvailabilityApiRecord =
  typeof InventoryAvailabilityApiSchema.Type;
export type InventoryAdjustmentReason =
  typeof InventoryAdjustmentReasonSchema.Type;
export type AdjustInventoryInput = typeof AdjustInventoryInputSchema.Type;
export type InventoryAdjustmentEventRecord =
  typeof InventoryAdjustmentEventRecordSchema.Type;
export type InventoryAdjustmentEventApiRecord =
  typeof InventoryAdjustmentEventApiRecordSchema.Type;
export type ReservationResult = typeof ReservationResultSchema.Type;
export type ReservationResultApiRecord = typeof ReservationResultApiSchema.Type;

export type InventoryReservationSaveResult =
  | {
      readonly reservation: InventoryReservationRecord;
      readonly status: "duplicate" | "reserved";
    }
  | {
      readonly status: "insufficient-stock";
    };

export interface InventoryRepository {
  readonly findAdjustmentEvents: (
    inventoryItemId: InventoryItemId
  ) => EffectValue<
    readonly InventoryAdjustmentEventRecord[],
    InventoryExpectedError
  >;
  readonly findAdjustmentEventByIdempotencyKey: (
    idempotencyKey: string
  ) => EffectValue<
    InventoryAdjustmentEventRecord | null,
    InventoryExpectedError
  >;
  readonly findInventoryItemById: (
    id: InventoryItemId
  ) => EffectValue<InventoryItemRecord | null, InventoryExpectedError>;
  readonly findLevel: (
    inventoryItemId: InventoryItemId,
    stockLocationId: StockLocationId
  ) => EffectValue<InventoryLevelRecord | null, InventoryExpectedError>;
  readonly findReservationByIdempotencyKey: (
    idempotencyKey: string
  ) => EffectValue<InventoryReservationRecord | null, InventoryExpectedError>;
  readonly findReservationsForLevel: (
    inventoryItemId: InventoryItemId,
    stockLocationId: StockLocationId
  ) => EffectValue<
    readonly InventoryReservationRecord[],
    InventoryExpectedError
  >;
  readonly findStockLocationById: (
    id: StockLocationId
  ) => EffectValue<StockLocationRecord | null, InventoryExpectedError>;
  readonly listStockLocationsForSalesChannel: (
    salesChannelId: string
  ) => EffectValue<readonly StockLocationRecord[], InventoryExpectedError>;
  readonly saveAdjustmentEvent: (
    event: InventoryAdjustmentEventRecord
  ) => EffectValue<InventoryAdjustmentEventRecord, InventoryExpectedError>;
  readonly saveInventoryItem: (
    item: InventoryItemRecord
  ) => EffectValue<InventoryItemRecord, InventoryExpectedError>;
  readonly saveLevel: (
    level: InventoryLevelRecord
  ) => EffectValue<InventoryLevelRecord, InventoryExpectedError>;
  readonly saveReservationIfAvailable: (
    reservation: InventoryReservationRecord
  ) => EffectValue<InventoryReservationSaveResult, InventoryExpectedError>;
  readonly saveReservation: (
    reservation: InventoryReservationRecord
  ) => EffectValue<InventoryReservationRecord, InventoryExpectedError>;
  readonly saveStockLocation: (
    location: StockLocationRecord
  ) => EffectValue<StockLocationRecord, InventoryExpectedError>;
}

/** Effect-native inventory repository contract consumed by inventory services. */
export const InventoryRepositoryService = Context.Service<InventoryRepository>(
  "@ecommerce/inventory/InventoryRepositoryService"
);

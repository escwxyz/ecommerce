import { Effect, Layer } from "effect";
import type { Effect as EffectValue } from "effect/Effect";

import type {
  InventoryAdjustmentEventRecord,
  InventoryExpectedError,
  InventoryItemId,
  InventoryItemRecord,
  InventoryLevelRecord,
  InventoryRepository,
  InventoryReservationRecord,
  InventoryReservationSaveResult,
  StockLocationId,
  StockLocationRecord,
} from "../domain";
import { InventoryRepositoryService, InventoryValidationFailure } from "../domain";

export interface ResettableInventoryRepository extends InventoryRepository {
  readonly clear: EffectValue<void, never>;
}

const sortByCreatedAtDescending = <
  TRecord extends { readonly createdAt: Date },
>(
  records: Iterable<TRecord>
): TRecord[] => {
  const sortedRecords: TRecord[] = [];

  for (const record of records) {
    const recordTimestamp = record.createdAt.getTime();
    let insertAt = 0;

    while (insertAt < sortedRecords.length) {
      const currentRecord = sortedRecords[insertAt];

      if (
        !currentRecord ||
        currentRecord.createdAt.getTime() < recordTimestamp
      ) {
        break;
      }

      insertAt += 1;
    }

    sortedRecords.splice(insertAt, 0, record);
  }

  return sortedRecords;
};

const toLevelKey = (
  inventoryItemId: InventoryItemId,
  stockLocationId: StockLocationId
): string => `${inventoryItemId}:${stockLocationId}`;

export class InMemoryInventoryRepository
  implements ResettableInventoryRepository
{
  readonly #adjustmentEvents = new Map<
    string,
    InventoryAdjustmentEventRecord
  >();
  readonly #adjustmentEventIdempotency = new Map<
    string,
    InventoryAdjustmentEventRecord
  >();
  readonly #items = new Map<string, InventoryItemRecord>();
  readonly #levels = new Map<string, InventoryLevelRecord>();
  readonly #reservations = new Map<string, InventoryReservationRecord>();
  readonly #reservationIdempotency = new Map<
    string,
    InventoryReservationRecord
  >();
  readonly #stockLocations = new Map<string, StockLocationRecord>();

  readonly clear = Effect.sync(() => {
    this.#adjustmentEvents.clear();
    this.#adjustmentEventIdempotency.clear();
    this.#items.clear();
    this.#levels.clear();
    this.#reservations.clear();
    this.#reservationIdempotency.clear();
    this.#stockLocations.clear();
  });

  readonly findAdjustmentEvents = (
    inventoryItemId: InventoryItemId
  ): EffectValue<
    readonly InventoryAdjustmentEventRecord[],
    InventoryExpectedError
  > =>
    Effect.sync(() => {
      const events: InventoryAdjustmentEventRecord[] = [];

      for (const event of this.#adjustmentEvents.values()) {
        if (event.inventoryItemId === inventoryItemId) {
          events.push(event);
        }
      }

      return sortByCreatedAtDescending(events);
    });

  readonly findAdjustmentEventByIdempotencyKey = (
    idempotencyKey: string
  ): EffectValue<
    InventoryAdjustmentEventRecord | null,
    InventoryExpectedError
  > =>
    Effect.sync(
      () => this.#adjustmentEventIdempotency.get(idempotencyKey) ?? null
    );

  readonly findInventoryItemById = (
    id: InventoryItemId
  ): EffectValue<InventoryItemRecord | null, InventoryExpectedError> =>
    Effect.sync(() => this.#items.get(id) ?? null);

  readonly findLevel = (
    inventoryItemId: InventoryItemId,
    stockLocationId: StockLocationId
  ): EffectValue<InventoryLevelRecord | null, InventoryExpectedError> =>
    Effect.sync(
      () => this.#levels.get(toLevelKey(inventoryItemId, stockLocationId)) ?? null
    );

  readonly findReservationByIdempotencyKey = (
    idempotencyKey: string
  ): EffectValue<
    InventoryReservationRecord | null,
    InventoryExpectedError
  > =>
    Effect.sync(() => this.#reservationIdempotency.get(idempotencyKey) ?? null);

  readonly findReservationsForLevel = (
    inventoryItemId: InventoryItemId,
    stockLocationId: StockLocationId
  ): EffectValue<
    readonly InventoryReservationRecord[],
    InventoryExpectedError
  > =>
    Effect.sync(() => {
      const reservations: InventoryReservationRecord[] = [];

      for (const reservation of this.#reservations.values()) {
        if (
          reservation.inventoryItemId === inventoryItemId &&
          reservation.stockLocationId === stockLocationId &&
          reservation.status === "active"
        ) {
          reservations.push(reservation);
        }
      }

      return sortByCreatedAtDescending(reservations);
    });

  readonly findStockLocationById = (
    id: StockLocationId
  ): EffectValue<StockLocationRecord | null, InventoryExpectedError> =>
    Effect.sync(() => this.#stockLocations.get(id) ?? null);

  readonly listStockLocationsForSalesChannel = (
    salesChannelId: string
  ): EffectValue<readonly StockLocationRecord[], InventoryExpectedError> =>
    Effect.sync(() => {
      const locations: StockLocationRecord[] = [];

      for (const location of this.#stockLocations.values()) {
        if (location.salesChannelIds.includes(salesChannelId)) {
          locations.push(location);
        }
      }

      return sortByCreatedAtDescending(locations);
    });

  readonly saveAdjustmentEvent = (
    event: InventoryAdjustmentEventRecord
  ): EffectValue<InventoryAdjustmentEventRecord, InventoryExpectedError> =>
    Effect.sync(() => {
      this.#adjustmentEvents.set(event.id, event);
      this.#adjustmentEventIdempotency.set(event.idempotencyKey, event);
      return event;
    });

  readonly saveInventoryItem = (
    item: InventoryItemRecord
  ): EffectValue<InventoryItemRecord, InventoryExpectedError> =>
    Effect.sync(() => {
      this.#items.set(item.id, item);
      return item;
    });

  readonly saveLevel = (
    level: InventoryLevelRecord
  ): EffectValue<InventoryLevelRecord, InventoryExpectedError> =>
    Effect.sync(() => {
      this.#levels.set(
        toLevelKey(level.inventoryItemId, level.stockLocationId),
        level
      );
      return level;
    });

  readonly saveReservationIfAvailable = (
    reservation: InventoryReservationRecord
  ): EffectValue<InventoryReservationSaveResult, InventoryExpectedError> =>
    Effect.sync(() => {
      const duplicate = this.#reservationIdempotency.get(
        reservation.idempotencyKey
      );

      if (duplicate) {
        return {
          reservation: duplicate,
          status: "duplicate" as const,
        };
      }

      const levelKey = toLevelKey(
        reservation.inventoryItemId,
        reservation.stockLocationId
      );
      const level = this.#levels.get(levelKey);

      if (!level) {
        return { status: "insufficient-stock" as const };
      }

      const availableQuantity = level.stockedQuantity - level.reservedQuantity;

      if (availableQuantity < reservation.quantity) {
        return { status: "insufficient-stock" as const };
      }

      this.#levels.set(levelKey, {
        ...level,
        reservedQuantity: level.reservedQuantity + reservation.quantity,
        updatedAt: reservation.updatedAt,
      });
      this.#reservations.set(reservation.id, reservation);
      this.#reservationIdempotency.set(
        reservation.idempotencyKey,
        reservation
      );

      return {
        reservation,
        status: "reserved" as const,
      };
    });

  readonly saveReservation = (
    reservation: InventoryReservationRecord
  ): EffectValue<InventoryReservationRecord, InventoryExpectedError> =>
    this.saveReservationIfAvailable(reservation).pipe(
      Effect.flatMap((result) =>
        result.status === "reserved"
          ? Effect.succeed(result.reservation)
          : new InventoryValidationFailure({
              message: "Inventory reservation could not be saved.",
            })
      )
    );

  readonly saveStockLocation = (
    location: StockLocationRecord
  ): EffectValue<StockLocationRecord, InventoryExpectedError> =>
    Effect.sync(() => {
      this.#stockLocations.set(location.id, location);
      return location;
    });
}

export const defaultInventoryRepository = new InMemoryInventoryRepository();

export const createInMemoryInventoryRepository = (): InventoryRepository =>
  new InMemoryInventoryRepository();

export const createResettableInMemoryInventoryRepository =
  (): ResettableInventoryRepository => new InMemoryInventoryRepository();

export const createInMemoryInventoryRepositoryLayer = () =>
  Layer.succeed(
    InventoryRepositoryService,
    createInMemoryInventoryRepository()
  );

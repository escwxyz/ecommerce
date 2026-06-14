import type {
  InventoryAdjustmentEventRecord,
  InventoryItemId,
  InventoryItemRecord,
  InventoryLevelRecord,
  InventoryRepository,
  InventoryReservationRecord,
  InventoryReservationSaveResult,
  StockLocationId,
  StockLocationRecord,
} from "../domain";

export interface ResettableInventoryRepository extends InventoryRepository {
  clear(): void;
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

export class InMemoryInventoryRepository implements ResettableInventoryRepository {
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

  clear(): void {
    this.#adjustmentEvents.clear();
    this.#adjustmentEventIdempotency.clear();
    this.#items.clear();
    this.#levels.clear();
    this.#reservations.clear();
    this.#reservationIdempotency.clear();
    this.#stockLocations.clear();
  }

  findAdjustmentEvents(
    inventoryItemId: InventoryItemId
  ): Promise<readonly InventoryAdjustmentEventRecord[]> {
    const events: InventoryAdjustmentEventRecord[] = [];

    for (const event of this.#adjustmentEvents.values()) {
      if (event.inventoryItemId === inventoryItemId) {
        events.push(event);
      }
    }

    return Promise.resolve(sortByCreatedAtDescending(events));
  }

  findAdjustmentEventByIdempotencyKey(
    idempotencyKey: string
  ): Promise<InventoryAdjustmentEventRecord | null> {
    return Promise.resolve(
      this.#adjustmentEventIdempotency.get(idempotencyKey) ?? null
    );
  }

  findInventoryItemById(
    id: InventoryItemId
  ): Promise<InventoryItemRecord | null> {
    return Promise.resolve(this.#items.get(id) ?? null);
  }

  findLevel(
    inventoryItemId: InventoryItemId,
    stockLocationId: StockLocationId
  ): Promise<InventoryLevelRecord | null> {
    return Promise.resolve(
      this.#levels.get(toLevelKey(inventoryItemId, stockLocationId)) ?? null
    );
  }

  findReservationByIdempotencyKey(
    idempotencyKey: string
  ): Promise<InventoryReservationRecord | null> {
    return Promise.resolve(
      this.#reservationIdempotency.get(idempotencyKey) ?? null
    );
  }

  findReservationsForLevel(
    inventoryItemId: InventoryItemId,
    stockLocationId: StockLocationId
  ): Promise<readonly InventoryReservationRecord[]> {
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

    return Promise.resolve(sortByCreatedAtDescending(reservations));
  }

  findStockLocationById(
    id: StockLocationId
  ): Promise<StockLocationRecord | null> {
    return Promise.resolve(this.#stockLocations.get(id) ?? null);
  }

  listStockLocationsForSalesChannel(
    salesChannelId: string
  ): Promise<readonly StockLocationRecord[]> {
    const locations: StockLocationRecord[] = [];

    for (const location of this.#stockLocations.values()) {
      if (location.salesChannelIds.includes(salesChannelId)) {
        locations.push(location);
      }
    }

    return Promise.resolve(sortByCreatedAtDescending(locations));
  }

  saveAdjustmentEvent(
    event: InventoryAdjustmentEventRecord
  ): Promise<InventoryAdjustmentEventRecord> {
    this.#adjustmentEvents.set(event.id, event);
    this.#adjustmentEventIdempotency.set(event.idempotencyKey, event);
    return Promise.resolve(event);
  }

  saveInventoryItem(item: InventoryItemRecord): Promise<InventoryItemRecord> {
    this.#items.set(item.id, item);
    return Promise.resolve(item);
  }

  saveLevel(level: InventoryLevelRecord): Promise<InventoryLevelRecord> {
    this.#levels.set(
      toLevelKey(level.inventoryItemId, level.stockLocationId),
      level
    );
    return Promise.resolve(level);
  }

  saveReservationIfAvailable(
    reservation: InventoryReservationRecord
  ): Promise<InventoryReservationSaveResult> {
    const duplicate = this.#reservationIdempotency.get(
      reservation.idempotencyKey
    );

    if (duplicate) {
      return Promise.resolve({
        reservation: duplicate,
        status: "duplicate",
      });
    }

    const levelKey = toLevelKey(
      reservation.inventoryItemId,
      reservation.stockLocationId
    );
    const level = this.#levels.get(levelKey);

    if (!level) {
      return Promise.resolve({ status: "insufficient-stock" });
    }

    const availableQuantity = level.stockedQuantity - level.reservedQuantity;

    if (availableQuantity < reservation.quantity) {
      return Promise.resolve({ status: "insufficient-stock" });
    }

    this.#levels.set(levelKey, {
      ...level,
      reservedQuantity: level.reservedQuantity + reservation.quantity,
      updatedAt: reservation.updatedAt,
    });
    this.#reservations.set(reservation.id, reservation);
    this.#reservationIdempotency.set(reservation.idempotencyKey, reservation);

    return Promise.resolve({
      reservation,
      status: "reserved",
    });
  }

  saveReservation(
    reservation: InventoryReservationRecord
  ): Promise<InventoryReservationRecord> {
    return this.saveReservationIfAvailable(reservation).then((result) => {
      if (result.status !== "reserved") {
        throw new Error("Inventory reservation could not be saved.");
      }

      return result.reservation;
    });
  }

  saveStockLocation(
    location: StockLocationRecord
  ): Promise<StockLocationRecord> {
    this.#stockLocations.set(location.id, location);
    return Promise.resolve(location);
  }
}

export const defaultInventoryRepository = new InMemoryInventoryRepository();

export const createInMemoryInventoryRepository = (): InventoryRepository =>
  new InMemoryInventoryRepository();

export const createResettableInMemoryInventoryRepository =
  (): ResettableInventoryRepository => new InMemoryInventoryRepository();

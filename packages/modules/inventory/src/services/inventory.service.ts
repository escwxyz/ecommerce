import type {
  ClockServiceShape,
  EventPublisherServiceShape,
  IdGeneratorServiceShape,
} from "@ecommerce/core";
import { createEventEnvelope } from "@ecommerce/core/events";
import type { StatefulCoordinator } from "@ecommerce/core/stateful";
import { defineStatefulCoordinationRequest } from "@ecommerce/core/stateful";
import { Context, Layer } from "effect";
import { nanoid } from "nanoid";

import { createInMemoryInventoryCoordinator } from "../coordination";
import type {
  AdjustInventoryInput,
  CreateInventoryItemInput,
  CreateStockLocationInput,
  InventoryAdjustmentEventRecord,
  InventoryAvailability,
  InventoryAvailabilityInput,
  InventoryItemRecord,
  InventoryLevelRecord,
  InventoryRepository,
  InventoryReservationRecord,
  ReservationResult,
  ReserveInventoryInput,
  SetInventoryLevelInput,
  StockLocationRecord,
} from "../domain";
import {
  INVENTORY_ADJUSTMENT_EVENT_ID_PREFIX,
  INVENTORY_ITEM_ID_PREFIX,
  INVENTORY_LEVEL_ID_PREFIX,
  INVENTORY_RESERVATION_ID_PREFIX,
  STOCK_LOCATION_ID_PREFIX,
  createInventoryAdjustmentEventId,
  createInventoryItemId,
  createInventoryLevelId,
  createInventoryReservationId,
  createStockLocationId,
} from "../domain";
import { defaultInventoryRepository } from "../repositories";

export const INVENTORY_RESERVED_EVENT = "inventory.reserved" as const;
export const INVENTORY_ADJUSTED_EVENT = "inventory.adjusted" as const;

export interface InventoryReservedEventPayload {
  readonly inventoryItemId: string;
  readonly quantity: number;
  readonly reservationId: string;
  readonly stockLocationId: string;
}

export interface InventoryAdjustedEventPayload {
  readonly adjustment: number;
  readonly inventoryItemId: string;
  readonly stockLocationId: string;
  readonly updatedStockedQuantity: number;
}

export interface InventoryServiceShape {
  adjustInventory(
    input: AdjustInventoryInput
  ): Promise<InventoryAdjustmentEventRecord>;
  checkAvailability(
    input: InventoryAvailabilityInput
  ): Promise<InventoryAvailability>;
  createInventoryItem(
    input: CreateInventoryItemInput
  ): Promise<InventoryItemRecord>;
  createStockLocation(
    input: CreateStockLocationInput
  ): Promise<StockLocationRecord>;
  reserveInventory(input: ReserveInventoryInput): Promise<ReservationResult>;
  setInventoryLevel(
    input: SetInventoryLevelInput
  ): Promise<InventoryLevelRecord>;
}

export const InventoryService = Context.Service<InventoryServiceShape>(
  "@ecommerce/inventory/InventoryService"
);

export interface CreateInventoryServiceOptions {
  readonly clock?: ClockServiceShape;
  readonly coordinator?: StatefulCoordinator;
  readonly eventPublisher?: EventPublisherServiceShape;
  readonly idGenerator?: IdGeneratorServiceShape;
  readonly repository?: InventoryRepository;
}

const createDefaultClock = (): ClockServiceShape => ({
  now: () => new Date(),
});

const createDefaultIdGenerator = (): IdGeneratorServiceShape => ({
  nextId: () => nanoid(),
});

const createNoopEventPublisher = (): EventPublisherServiceShape => ({
  publish: () => {
    // Inventory events are emitted when a runtime event bus is composed.
  },
});

const normalizeText = (value: string): string => value.trim();

const createId = (prefix: string, idGenerator: IdGeneratorServiceShape) => {
  const rawId = idGenerator.nextId();
  return rawId.startsWith(prefix) ? rawId : `${prefix}${rawId}`;
};

const getReservedQuantity = (level: InventoryLevelRecord): number =>
  level.reservedQuantity;

const DUPLICATE_RESERVATION_REPLAY_ATTEMPTS = 20;
const DUPLICATE_RESERVATION_REPLAY_DELAY_MS = 5;

const waitForDuplicateReservationReplay = async (
  repository: InventoryRepository,
  idempotencyKey: string
): Promise<InventoryReservationRecord | null> => {
  for (
    let attempt = 0;
    attempt < DUPLICATE_RESERVATION_REPLAY_ATTEMPTS;
    attempt += 1
  ) {
    const reservation =
      await repository.findReservationByIdempotencyKey(idempotencyKey);

    if (reservation) {
      return reservation;
    }

    if (attempt < DUPLICATE_RESERVATION_REPLAY_ATTEMPTS - 1) {
      await new Promise((resolve) => {
        setTimeout(resolve, DUPLICATE_RESERVATION_REPLAY_DELAY_MS);
      });
    }
  }

  return null;
};

const createAvailability = ({
  level,
  salesChannelId,
}: {
  readonly level: InventoryLevelRecord;
  readonly salesChannelId?: string;
}): InventoryAvailability => {
  const reservedQuantity = getReservedQuantity(level);

  return {
    availableQuantity: Math.max(level.stockedQuantity - reservedQuantity, 0),
    inventoryItemId: level.inventoryItemId,
    reservedQuantity,
    scopedBy: {
      ...(salesChannelId ? { salesChannelId } : {}),
      stockLocationId: level.stockLocationId,
    },
    stockedQuantity: level.stockedQuantity,
  };
};

export const createInventoryService = ({
  clock = createDefaultClock(),
  coordinator = createInMemoryInventoryCoordinator(),
  eventPublisher = createNoopEventPublisher(),
  idGenerator = createDefaultIdGenerator(),
  repository = defaultInventoryRepository,
}: CreateInventoryServiceOptions = {}): InventoryServiceShape => {
  const service: InventoryServiceShape = {
    adjustInventory: async (input) => {
      const inventoryItemId = createInventoryItemId(input.inventoryItemId);
      const stockLocationId = createStockLocationId(input.stockLocationId);
      const level = await repository.findLevel(
        inventoryItemId,
        stockLocationId
      );

      if (!level) {
        throw new Error("Inventory level was not found.");
      }

      const updatedStockedQuantity = level.stockedQuantity + input.adjustment;

      if (updatedStockedQuantity < 0) {
        throw new Error("Inventory adjustment cannot reduce stock below zero.");
      }

      const now = clock.now();
      await repository.saveLevel({
        ...level,
        stockedQuantity: updatedStockedQuantity,
        updatedAt: now,
      });

      const eventRecord: InventoryAdjustmentEventRecord = {
        adjustment: input.adjustment,
        causationId: input.causationId ?? null,
        correlationId: input.correlationId,
        createdAt: now,
        id: createInventoryAdjustmentEventId(
          createId(INVENTORY_ADJUSTMENT_EVENT_ID_PREFIX, idGenerator)
        ),
        inventoryItemId,
        reason: input.reason ?? "correction",
        stockLocationId,
        updatedStockedQuantity,
        workflowRunId: input.workflowRunId ?? null,
      };
      const saved = await repository.saveAdjustmentEvent(eventRecord);

      await eventPublisher.publish(
        createEventEnvelope({
          causationId: input.causationId,
          correlationId: input.correlationId,
          id: createId("evt_", idGenerator),
          name: INVENTORY_ADJUSTED_EVENT,
          payload: {
            adjustment: saved.adjustment,
            inventoryItemId: saved.inventoryItemId,
            stockLocationId: saved.stockLocationId,
            updatedStockedQuantity: saved.updatedStockedQuantity,
          } satisfies InventoryAdjustedEventPayload,
          sourceModule: "inventory",
          subject: {
            id: saved.inventoryItemId,
            type: "inventory-item",
          },
          workflowRunId: input.workflowRunId,
        })
      );

      return saved;
    },
    checkAvailability: async (input) => {
      const inventoryItemId = createInventoryItemId(input.inventoryItemId);
      const explicitStockLocationId = input.stockLocationId
        ? createStockLocationId(input.stockLocationId)
        : null;
      let candidateLocations: readonly StockLocationRecord["id"][] = [];

      if (explicitStockLocationId) {
        candidateLocations = [explicitStockLocationId];
      } else if (input.salesChannelId) {
        const scopedLocations =
          await repository.listStockLocationsForSalesChannel(
            input.salesChannelId
          );
        candidateLocations = scopedLocations.map((location) => location.id);
      }

      if (candidateLocations.length === 0) {
        return {
          availableQuantity: 0,
          inventoryItemId,
          reservedQuantity: 0,
          scopedBy: {
            ...(input.salesChannelId
              ? { salesChannelId: input.salesChannelId }
              : {}),
            ...(explicitStockLocationId
              ? { stockLocationId: explicitStockLocationId }
              : {}),
          },
          stockedQuantity: 0,
        };
      }

      let availability: InventoryAvailability | null = null;

      for (const stockLocationId of candidateLocations) {
        const level = await repository.findLevel(
          inventoryItemId,
          stockLocationId
        );

        if (!level) {
          continue;
        }

        const levelAvailability = createAvailability({
          level,
          salesChannelId: input.salesChannelId,
        });

        availability = availability
          ? {
              availableQuantity:
                availability.availableQuantity +
                levelAvailability.availableQuantity,
              inventoryItemId: availability.inventoryItemId,
              reservedQuantity:
                availability.reservedQuantity +
                levelAvailability.reservedQuantity,
              scopedBy: availability.scopedBy,
              stockedQuantity:
                availability.stockedQuantity +
                levelAvailability.stockedQuantity,
            }
          : levelAvailability;
      }

      return (
        availability ?? {
          availableQuantity: 0,
          inventoryItemId,
          reservedQuantity: 0,
          scopedBy: {
            ...(input.salesChannelId
              ? { salesChannelId: input.salesChannelId }
              : {}),
            ...(explicitStockLocationId
              ? { stockLocationId: explicitStockLocationId }
              : {}),
          },
          stockedQuantity: 0,
        }
      );
    },
    createInventoryItem: (input) => {
      const sku = normalizeText(input.sku);
      const title = normalizeText(input.title);

      if (!sku || !title) {
        throw new Error("Inventory item SKU and title are required.");
      }

      const now = clock.now();
      const item: InventoryItemRecord = {
        createdAt: now,
        id: createInventoryItemId(
          createId(INVENTORY_ITEM_ID_PREFIX, idGenerator)
        ),
        metadata: input.metadata ?? {},
        sku,
        title,
        updatedAt: now,
      };

      return repository.saveInventoryItem(item);
    },
    createStockLocation: (input) => {
      const name = normalizeText(input.name);

      if (!name) {
        throw new Error("Stock location name is required.");
      }

      const now = clock.now();
      const location: StockLocationRecord = {
        createdAt: now,
        id: createStockLocationId(
          createId(STOCK_LOCATION_ID_PREFIX, idGenerator)
        ),
        metadata: input.metadata ?? {},
        name,
        salesChannelIds: input.salesChannelIds ?? [],
        updatedAt: now,
      };

      return repository.saveStockLocation(location);
    },
    reserveInventory: async (input) => {
      const inventoryItemId = createInventoryItemId(input.inventoryItemId);
      const stockLocationId = createStockLocationId(input.stockLocationId);
      const duplicateReservation =
        await repository.findReservationByIdempotencyKey(input.idempotencyKey);

      if (duplicateReservation) {
        const duplicateAvailability = await service.checkAvailability({
          inventoryItemId,
          salesChannelId: input.salesChannelId,
          stockLocationId,
        });

        return {
          availability: duplicateAvailability,
          duplicate: true,
          reservation: duplicateReservation,
        };
      }

      const coordination = await coordinator.coordinate(
        defineStatefulCoordinationRequest({
          causationId: input.causationId,
          coordinatorKey: "inventory.reservation",
          correlationId: input.correlationId,
          idempotencyKey: input.idempotencyKey,
          operationName: "reserveInventory",
          payload: input,
          subject: {
            id: inventoryItemId,
            type: "inventory-item",
          },
          workflowRunId: input.workflowRunId,
        })
      );

      if (coordination.duplicate) {
        const coordinatedReservation = await waitForDuplicateReservationReplay(
          repository,
          input.idempotencyKey
        );

        if (coordinatedReservation) {
          const coordinatedAvailability = await service.checkAvailability({
            inventoryItemId,
            salesChannelId: input.salesChannelId,
            stockLocationId,
          });

          return {
            availability: coordinatedAvailability,
            duplicate: true,
            reservation: coordinatedReservation,
          };
        }

        throw new Error(
          "Duplicate reservation was not persisted before replay timeout."
        );
      }

      const level = await repository.findLevel(
        inventoryItemId,
        stockLocationId
      );

      if (!level) {
        throw new Error("Inventory level was not found.");
      }

      const now = clock.now();
      const reservation: InventoryReservationRecord = {
        causationId: input.causationId ?? null,
        correlationId: input.correlationId,
        createdAt: now,
        id: createInventoryReservationId(
          createId(INVENTORY_RESERVATION_ID_PREFIX, idGenerator)
        ),
        idempotencyKey: input.idempotencyKey,
        inventoryItemId,
        quantity: input.quantity,
        releasedAt: null,
        salesChannelId: input.salesChannelId ?? null,
        status: "active",
        stockLocationId,
        updatedAt: now,
        workflowRunId: input.workflowRunId ?? null,
      };
      const saveResult =
        await repository.saveReservationIfAvailable(reservation);

      if (saveResult.status === "insufficient-stock") {
        throw new Error("Insufficient inventory availability.");
      }

      const saved = saveResult.reservation;
      const remainingAvailability = await service.checkAvailability({
        inventoryItemId,
        salesChannelId: input.salesChannelId,
        stockLocationId,
      });

      if (saveResult.status === "duplicate") {
        return {
          availability: remainingAvailability,
          duplicate: true,
          reservation: saved,
        };
      }

      await eventPublisher.publish(
        createEventEnvelope({
          causationId: input.causationId,
          correlationId: input.correlationId,
          id: createId("evt_", idGenerator),
          name: INVENTORY_RESERVED_EVENT,
          payload: {
            inventoryItemId: saved.inventoryItemId,
            quantity: saved.quantity,
            reservationId: saved.id,
            stockLocationId: saved.stockLocationId,
          } satisfies InventoryReservedEventPayload,
          sourceModule: "inventory",
          subject: {
            id: saved.inventoryItemId,
            type: "inventory-item",
          },
          workflowRunId: input.workflowRunId,
        })
      );

      return {
        availability: remainingAvailability,
        duplicate: false,
        reservation: saved,
      };
    },
    setInventoryLevel: async (input) => {
      const inventoryItemId = createInventoryItemId(input.inventoryItemId);
      const stockLocationId = createStockLocationId(input.stockLocationId);
      const [item, location, existing] = await Promise.all([
        repository.findInventoryItemById(inventoryItemId),
        repository.findStockLocationById(stockLocationId),
        repository.findLevel(inventoryItemId, stockLocationId),
      ]);

      if (!item) {
        throw new Error(
          `Inventory item "${input.inventoryItemId}" was not found.`
        );
      }

      if (!location) {
        throw new Error(
          `Stock location "${input.stockLocationId}" was not found.`
        );
      }

      const now = clock.now();
      const level: InventoryLevelRecord = {
        createdAt: existing?.createdAt ?? now,
        id:
          existing?.id ??
          createInventoryLevelId(
            createId(INVENTORY_LEVEL_ID_PREFIX, idGenerator)
          ),
        inventoryItemId,
        reservedQuantity: existing?.reservedQuantity ?? 0,
        stockLocationId,
        stockedQuantity: input.stockedQuantity,
        updatedAt: now,
      };

      return repository.saveLevel(level);
    },
  };

  return service;
};

export const createInventoryServiceLayer = (service: InventoryServiceShape) =>
  Layer.succeed(InventoryService, service);

export const defaultInventoryService = createInventoryService({
  repository: defaultInventoryRepository,
});

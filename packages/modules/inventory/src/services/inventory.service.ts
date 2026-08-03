import type {
  ClockServiceShape,
  EventPublisherServiceShape,
  IdGeneratorServiceShape,
} from "@ecommerce/core";
import {
  ClockService,
  EventPublisherService,
  IdGeneratorService,
} from "@ecommerce/core";
import { createEventEnvelope } from "@ecommerce/core/events";
import type { KeyedActorService } from "@ecommerce/core/stateful";
import { KeyedActorCommandSchema } from "@ecommerce/core/stateful";
import { Context, Effect, Layer, Schema } from "effect";
import type { Effect as EffectValue } from "effect/Effect";
import { nanoid } from "nanoid";

import { createInMemoryInventoryActorService } from "../coordination";
import type {
  AdjustInventoryInput,
  CreateInventoryItemInput,
  CreateStockLocationInput,
  InventoryAdjustmentEventRecord,
  InventoryAvailability,
  InventoryAvailabilityInput,
  InventoryExpectedError,
  InventoryItemRecord,
  InventoryLevelRecord,
  InventoryRepository,
  InventoryReservationRecord,
  ReservationResult,
  ReserveInventoryInput,
  SetInventoryLevelInput,
  StockLocationId,
  StockLocationRecord,
} from "../domain";
import {
  INVENTORY_ADJUSTMENT_EVENT_ID_PREFIX,
  INVENTORY_ITEM_ID_PREFIX,
  INVENTORY_LEVEL_ID_PREFIX,
  INVENTORY_RESERVATION_ID_PREFIX,
  STOCK_LOCATION_ID_PREFIX,
  InventoryInsufficientStock,
  InventoryItemNotFound,
  InventoryLevelNotFound,
  InventoryRepositoryService,
  InventoryValidationFailure,
  StockLocationNotFound,
  createInventoryAdjustmentEventIdEffect,
  createInventoryItemIdEffect,
  createInventoryLevelIdEffect,
  createInventoryReservationIdEffect,
  createStockLocationIdEffect,
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

export type InventoryServiceFailure = InventoryExpectedError;

export interface InventoryServiceShape {
  readonly adjustInventory: (
    input: AdjustInventoryInput
  ) => EffectValue<InventoryAdjustmentEventRecord, InventoryServiceFailure>;
  readonly checkAvailability: (
    input: InventoryAvailabilityInput
  ) => EffectValue<InventoryAvailability, InventoryServiceFailure>;
  readonly createInventoryItem: (
    input: CreateInventoryItemInput
  ) => EffectValue<InventoryItemRecord, InventoryServiceFailure>;
  readonly createStockLocation: (
    input: CreateStockLocationInput
  ) => EffectValue<StockLocationRecord, InventoryServiceFailure>;
  readonly reserveInventory: (
    input: ReserveInventoryInput
  ) => EffectValue<ReservationResult, InventoryServiceFailure>;
  readonly setInventoryLevel: (
    input: SetInventoryLevelInput
  ) => EffectValue<InventoryLevelRecord, InventoryServiceFailure>;
}

export const InventoryService = Context.Service<InventoryServiceShape>(
  "@ecommerce/inventory/InventoryService"
);

export interface CreateInventoryServiceOptions {
  readonly actorService?: KeyedActorService;
  readonly clock?: ClockServiceShape;
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
    // Inventory events are optional until a runtime event bus is composed.
  },
});

const normalizeText = (value: string): string => value.trim();

const createId = (prefix: string, idGenerator: IdGeneratorServiceShape) => {
  const rawId = idGenerator.nextId();
  return rawId.startsWith(prefix) ? rawId : `${prefix}${rawId}`;
};

const publishEvent = (
  eventPublisher: EventPublisherServiceShape,
  envelope: Parameters<EventPublisherServiceShape["publish"]>[0]
) =>
  Effect.tryPromise({
    catch: () =>
      new InventoryValidationFailure({
        message: "Inventory event publication failed.",
      }),
    try: () => Promise.resolve(eventPublisher.publish(envelope)),
  }).pipe(Effect.asVoid);

const coordinateInventory = (
  actorService: KeyedActorService,
  input: AdjustInventoryInput | ReserveInventoryInput,
  operationName: "adjustInventory" | "reserveInventory",
  actorType: "inventory-adjustment" | "inventory-reservation"
): EffectValue<{ readonly duplicate: boolean }, InventoryValidationFailure> =>
  Effect.gen(function* coordinateInventoryThroughActor() {
    const command = yield* Schema.decodeUnknownEffect(KeyedActorCommandSchema)({
      actor: {
        key: input.inventoryItemId,
        type: actorType,
      },
      causationId: input.causationId,
      commandId: input.idempotencyKey,
      commandName: operationName,
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey,
      issuedAt: new Date().toISOString(),
      payload: input,
      schemaVersion: 1,
      subject: {
        id: input.inventoryItemId,
        type: "inventory-item",
      },
      workflowRunId: input.workflowRunId,
    }).pipe(
      Effect.mapError(
        () =>
          new InventoryValidationFailure({
            message: "Inventory coordination failed.",
          })
      )
    );

    return yield* actorService.dispatch(command).pipe(
      Effect.mapError(
        () =>
          new InventoryValidationFailure({
            message: "Inventory coordination failed.",
          })
      )
    );
  });

const getReservedQuantity = (level: InventoryLevelRecord): number =>
  level.reservedQuantity;

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

const createAggregateScopedBy = ({
  explicitStockLocationId,
  salesChannelId,
}: {
  readonly explicitStockLocationId: StockLocationId | null;
  readonly salesChannelId?: string;
}) => ({
  ...(salesChannelId ? { salesChannelId } : {}),
  ...(explicitStockLocationId
    ? { stockLocationId: explicitStockLocationId }
    : {}),
});

const waitForDuplicateReservationReplay = (
  repository: InventoryRepository,
  idempotencyKey: string
): EffectValue<InventoryReservationRecord | null, InventoryServiceFailure> =>
  repository.findReservationByIdempotencyKey(idempotencyKey);

const waitForDuplicateAdjustmentReplay = (
  repository: InventoryRepository,
  idempotencyKey: string
): EffectValue<
  InventoryAdjustmentEventRecord | null,
  InventoryServiceFailure
> => repository.findAdjustmentEventByIdempotencyKey(idempotencyKey);

export const createInventoryService = ({
  actorService = createInMemoryInventoryActorService(),
  clock = createDefaultClock(),
  eventPublisher = createNoopEventPublisher(),
  idGenerator = createDefaultIdGenerator(),
  repository = defaultInventoryRepository,
}: CreateInventoryServiceOptions = {}): InventoryServiceShape => {
  const service: InventoryServiceShape = {
    adjustInventory: (input) =>
      Effect.gen(function* adjustInventoryEffect() {
        const inventoryItemId = yield* createInventoryItemIdEffect(
          input.inventoryItemId
        );
        const stockLocationId = yield* createStockLocationIdEffect(
          input.stockLocationId
        );
        const duplicateEvent =
          yield* repository.findAdjustmentEventByIdempotencyKey(
            input.idempotencyKey
          );

        if (duplicateEvent) {
          return duplicateEvent;
        }

        const coordination = yield* coordinateInventory(
          actorService,
          input,
          "adjustInventory",
          "inventory-adjustment"
        );

        if (coordination.duplicate) {
          const coordinatedEvent = yield* waitForDuplicateAdjustmentReplay(
            repository,
            input.idempotencyKey
          );

          if (coordinatedEvent) {
            return coordinatedEvent;
          }

          return yield* new InventoryValidationFailure({
            message: "Duplicate adjustment is still being coordinated.",
          });
        }

        const level = yield* repository.findLevel(
          inventoryItemId,
          stockLocationId
        );

        if (!level) {
          return yield* new InventoryLevelNotFound({
            inventoryItemId,
            stockLocationId,
          });
        }

        const updatedStockedQuantity = level.stockedQuantity + input.adjustment;

        if (updatedStockedQuantity < 0) {
          return yield* new InventoryValidationFailure({
            message: "Inventory adjustment cannot reduce stock below zero.",
          });
        }

        const now = clock.now();
        yield* repository.saveLevel({
          ...level,
          stockedQuantity: updatedStockedQuantity,
          updatedAt: now,
        });

        const eventRecord: InventoryAdjustmentEventRecord = {
          adjustment: input.adjustment,
          causationId: input.causationId ?? null,
          correlationId: input.correlationId,
          createdAt: now,
          id: yield* createInventoryAdjustmentEventIdEffect(
            createId(INVENTORY_ADJUSTMENT_EVENT_ID_PREFIX, idGenerator)
          ),
          idempotencyKey: input.idempotencyKey,
          inventoryItemId,
          reason: input.reason ?? "correction",
          stockLocationId,
          updatedStockedQuantity,
          workflowRunId: input.workflowRunId ?? null,
        };
        const saved = yield* repository.saveAdjustmentEvent(eventRecord);

        yield* publishEvent(
          eventPublisher,
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
      }),
    checkAvailability: (input) =>
      Effect.gen(function* checkAvailabilityEffect() {
        const inventoryItemId = yield* createInventoryItemIdEffect(
          input.inventoryItemId
        );
        const explicitStockLocationId = input.stockLocationId
          ? yield* createStockLocationIdEffect(input.stockLocationId)
          : null;
        const aggregateScopedBy = createAggregateScopedBy({
          explicitStockLocationId,
          salesChannelId: input.salesChannelId,
        });
        let candidateLocations: readonly StockLocationRecord["id"][] = [];

        if (explicitStockLocationId) {
          candidateLocations = [explicitStockLocationId];
        } else if (input.salesChannelId) {
          const scopedLocations =
            yield* repository.listStockLocationsForSalesChannel(
              input.salesChannelId
            );
          candidateLocations = scopedLocations.map((location) => location.id);
        }

        if (candidateLocations.length === 0) {
          return {
            availableQuantity: 0,
            inventoryItemId,
            reservedQuantity: 0,
            scopedBy: aggregateScopedBy,
            stockedQuantity: 0,
          };
        }

        let availability: InventoryAvailability | null = null;

        for (const stockLocationId of candidateLocations) {
          const level = yield* repository.findLevel(
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
                scopedBy: aggregateScopedBy,
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
            scopedBy: aggregateScopedBy,
            stockedQuantity: 0,
          }
        );
      }),
    createInventoryItem: (input) =>
      Effect.gen(function* createInventoryItemEffect() {
        const sku = normalizeText(input.sku);
        const title = normalizeText(input.title);

        if (!sku || !title) {
          return yield* new InventoryValidationFailure({
            message: "Inventory item SKU and title are required.",
          });
        }

        const now = clock.now();
        const item: InventoryItemRecord = {
          createdAt: now,
          id: yield* createInventoryItemIdEffect(
            createId(INVENTORY_ITEM_ID_PREFIX, idGenerator)
          ),
          metadata: input.metadata ?? {},
          sku,
          title,
          updatedAt: now,
        };

        return yield* repository.saveInventoryItem(item);
      }),
    createStockLocation: (input) =>
      Effect.gen(function* createStockLocationEffect() {
        const name = normalizeText(input.name);

        if (!name) {
          return yield* new InventoryValidationFailure({
            message: "Stock location name is required.",
          });
        }

        const now = clock.now();
        const location: StockLocationRecord = {
          createdAt: now,
          id: yield* createStockLocationIdEffect(
            createId(STOCK_LOCATION_ID_PREFIX, idGenerator)
          ),
          metadata: input.metadata ?? {},
          name,
          salesChannelIds: input.salesChannelIds ?? [],
          updatedAt: now,
        };

        return yield* repository.saveStockLocation(location);
      }),
    reserveInventory: (input) =>
      Effect.gen(function* reserveInventoryEffect() {
        const inventoryItemId = yield* createInventoryItemIdEffect(
          input.inventoryItemId
        );
        const stockLocationId = yield* createStockLocationIdEffect(
          input.stockLocationId
        );
        const duplicateReservation =
          yield* repository.findReservationByIdempotencyKey(
            input.idempotencyKey
          );

        if (duplicateReservation) {
          const duplicateAvailability = yield* service.checkAvailability({
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

        const coordination = yield* coordinateInventory(
          actorService,
          input,
          "reserveInventory",
          "inventory-reservation"
        );

        if (coordination.duplicate) {
          const coordinatedReservation =
            yield* waitForDuplicateReservationReplay(
              repository,
              input.idempotencyKey
            );

          if (coordinatedReservation) {
            const coordinatedAvailability = yield* service.checkAvailability({
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

          return yield* new InventoryValidationFailure({
            message:
              "Duplicate reservation was not persisted before replay timeout.",
          });
        }

        const level = yield* repository.findLevel(
          inventoryItemId,
          stockLocationId
        );

        if (!level) {
          return yield* new InventoryLevelNotFound({
            inventoryItemId,
            stockLocationId,
          });
        }

        const now = clock.now();
        const reservation: InventoryReservationRecord = {
          causationId: input.causationId ?? null,
          correlationId: input.correlationId,
          createdAt: now,
          id: yield* createInventoryReservationIdEffect(
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
          yield* repository.saveReservationIfAvailable(reservation);

        if (saveResult.status === "insufficient-stock") {
          return yield* new InventoryInsufficientStock({
            inventoryItemId,
            stockLocationId,
          });
        }

        const saved = saveResult.reservation;
        const remainingAvailability = yield* service.checkAvailability({
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

        yield* publishEvent(
          eventPublisher,
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
      }),
    setInventoryLevel: (input) =>
      Effect.gen(function* setInventoryLevelEffect() {
        const inventoryItemId = yield* createInventoryItemIdEffect(
          input.inventoryItemId
        );
        const stockLocationId = yield* createStockLocationIdEffect(
          input.stockLocationId
        );
        const [item, location, existing] = yield* Effect.all([
          repository.findInventoryItemById(inventoryItemId),
          repository.findStockLocationById(stockLocationId),
          repository.findLevel(inventoryItemId, stockLocationId),
        ]);

        if (!item) {
          return yield* new InventoryItemNotFound({ inventoryItemId });
        }

        if (!location) {
          return yield* new StockLocationNotFound({ stockLocationId });
        }

        const now = clock.now();
        const level: InventoryLevelRecord = {
          createdAt: existing?.createdAt ?? now,
          id:
            existing?.id ??
            (yield* createInventoryLevelIdEffect(
              createId(INVENTORY_LEVEL_ID_PREFIX, idGenerator)
            )),
          inventoryItemId,
          reservedQuantity: existing?.reservedQuantity ?? 0,
          stockLocationId,
          stockedQuantity: input.stockedQuantity,
          updatedAt: now,
        };

        return yield* repository.saveLevel(level);
      }),
  };

  return service;
};

export const createInventoryRepositoryLayer = (
  repository: InventoryRepository
) => Layer.succeed(InventoryRepositoryService, repository);

export const createInventoryServiceLayer = (service: InventoryServiceShape) =>
  Layer.succeed(InventoryService, service);

export const createInventoryServiceFromDependenciesLayer = () =>
  Layer.effect(
    InventoryService,
    Effect.gen(function* createInventoryServiceFromDependenciesEffect() {
      const clock = yield* ClockService;
      const idGenerator = yield* IdGeneratorService;
      const repository = yield* InventoryRepositoryService;
      const eventPublisher = yield* Effect.serviceOption(
        EventPublisherService
      ).pipe(
        Effect.map((option) =>
          option._tag === "Some" ? option.value : undefined
        )
      );

      return createInventoryService({
        clock,
        eventPublisher,
        idGenerator,
        repository,
      });
    })
  );

export const defaultInventoryService = createInventoryService({
  repository: defaultInventoryRepository,
});

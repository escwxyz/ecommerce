import {
  InventoryService,
  inventoryPermissions,
  serializeInventoryAdjustmentEventId,
  serializeInventoryItemId,
  serializeInventoryLevelId,
  serializeInventoryReservationId,
  serializeStockLocationId,
} from "@ecommerce/inventory";
import type {
  InventoryAdjustmentEventApiRecord,
  InventoryAdjustmentEventRecord,
  InventoryAvailability,
  InventoryAvailabilityApiRecord,
  InventoryItemApiRecord,
  InventoryItemRecord,
  InventoryLevelApiRecord,
  InventoryLevelRecord,
  InventoryReservationApiRecord,
  InventoryReservationRecord,
  ReservationResult,
  ReservationResultApiRecord,
  StockLocationApiRecord,
  StockLocationRecord,
} from "@ecommerce/inventory";
import { Effect } from "effect";
import { HttpApi, HttpApiBuilder } from "effect/unstable/httpapi";

import {
  defineAdminHttpApiGroupContribution,
  defineEffectHttpApiModuleContribution,
} from "./effect-http-api";
import {
  CurrentEffectHttpRequestContext,
  withEffectHttpPermission,
} from "./effect-http-middleware";
import type { EffectHttpRequestIdentity } from "./effect-http-middleware";
import { inventoryAdminHttpApiGroup } from "./inventory-effect-http-contract";

const serializeInventoryItem = (
  item: InventoryItemRecord
): InventoryItemApiRecord => ({
  createdAt: item.createdAt.toISOString(),
  id: serializeInventoryItemId(item.id),
  metadata: item.metadata,
  sku: item.sku,
  title: item.title,
  updatedAt: item.updatedAt.toISOString(),
});

const serializeStockLocation = (
  location: StockLocationRecord
): StockLocationApiRecord => ({
  createdAt: location.createdAt.toISOString(),
  id: serializeStockLocationId(location.id),
  metadata: location.metadata,
  name: location.name,
  salesChannelIds: location.salesChannelIds,
  updatedAt: location.updatedAt.toISOString(),
});

const serializeInventoryLevel = (
  level: InventoryLevelRecord
): InventoryLevelApiRecord => ({
  createdAt: level.createdAt.toISOString(),
  id: serializeInventoryLevelId(level.id),
  inventoryItemId: serializeInventoryItemId(level.inventoryItemId),
  reservedQuantity: level.reservedQuantity,
  stockLocationId: serializeStockLocationId(level.stockLocationId),
  stockedQuantity: level.stockedQuantity,
  updatedAt: level.updatedAt.toISOString(),
});

const serializeReservation = (
  reservation: InventoryReservationRecord
): InventoryReservationApiRecord => ({
  causationId: reservation.causationId,
  correlationId: reservation.correlationId,
  createdAt: reservation.createdAt.toISOString(),
  id: serializeInventoryReservationId(reservation.id),
  idempotencyKey: reservation.idempotencyKey,
  inventoryItemId: serializeInventoryItemId(reservation.inventoryItemId),
  quantity: reservation.quantity,
  releasedAt: reservation.releasedAt?.toISOString() ?? null,
  salesChannelId: reservation.salesChannelId,
  status: reservation.status,
  stockLocationId: serializeStockLocationId(reservation.stockLocationId),
  updatedAt: reservation.updatedAt.toISOString(),
  workflowRunId: reservation.workflowRunId,
});

const serializeAvailability = (
  availability: InventoryAvailability
): InventoryAvailabilityApiRecord => ({
  availableQuantity: availability.availableQuantity,
  inventoryItemId: serializeInventoryItemId(availability.inventoryItemId),
  reservedQuantity: availability.reservedQuantity,
  scopedBy: {
    ...(availability.scopedBy.salesChannelId
      ? { salesChannelId: availability.scopedBy.salesChannelId }
      : {}),
    ...(availability.scopedBy.stockLocationId
      ? {
          stockLocationId: serializeStockLocationId(
            availability.scopedBy.stockLocationId
          ),
        }
      : {}),
  },
  stockedQuantity: availability.stockedQuantity,
});

const serializeAdjustmentEvent = (
  event: InventoryAdjustmentEventRecord
): InventoryAdjustmentEventApiRecord => ({
  adjustment: event.adjustment,
  causationId: event.causationId,
  correlationId: event.correlationId,
  createdAt: event.createdAt.toISOString(),
  id: serializeInventoryAdjustmentEventId(event.id),
  idempotencyKey: event.idempotencyKey,
  inventoryItemId: serializeInventoryItemId(event.inventoryItemId),
  reason: event.reason,
  stockLocationId: serializeStockLocationId(event.stockLocationId),
  updatedStockedQuantity: event.updatedStockedQuantity,
  workflowRunId: event.workflowRunId,
});

const serializeReservationResult = (
  result: ReservationResult
): ReservationResultApiRecord => ({
  availability: serializeAvailability(result.availability),
  duplicate: result.duplicate,
  reservation: serializeReservation(result.reservation),
});

const withSuccessEnvelope = <TData>(
  data: TData,
  request: EffectHttpRequestIdentity
) =>
  ({
    data,
    meta: { request },
    success: true,
  }) as const;

const withCurrentRequest = <TData, TError, TRequirements>(
  effect: Effect.Effect<TData, TError, TRequirements>
) =>
  Effect.gen(function* createInventoryApiSuccessEnvelope() {
    const context = yield* CurrentEffectHttpRequestContext;
    const data = yield* effect;
    return withSuccessEnvelope(data, context.identity);
  });

const inventoryAdminGroupIdentifier = "inventoryAdmin";
const inventoryAdminHttpApi = HttpApi.make("InventoryAdminApi").add(
  inventoryAdminHttpApiGroup
);

export const inventoryAdminHttpApiHandlers = HttpApiBuilder.group(
  inventoryAdminHttpApi,
  inventoryAdminGroupIdentifier,
  (handlers) =>
    handlers
      .handle("inventoryAdjust", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            InventoryService.use((service) =>
              service
                .adjustInventory(payload)
                .pipe(Effect.map(serializeAdjustmentEvent))
            )
          ),
          inventoryPermissions.write
        )
      )
      .handle("inventoryAvailabilityCheck", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            InventoryService.use((service) =>
              service
                .checkAvailability(payload)
                .pipe(Effect.map(serializeAvailability))
            )
          ),
          inventoryPermissions.read
        )
      )
      .handle("inventoryItemCreate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            InventoryService.use((service) =>
              service
                .createInventoryItem(payload)
                .pipe(Effect.map(serializeInventoryItem))
            )
          ),
          inventoryPermissions.write
        )
      )
      .handle("inventoryLevelSet", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            InventoryService.use((service) =>
              service
                .setInventoryLevel(payload)
                .pipe(Effect.map(serializeInventoryLevel))
            )
          ),
          inventoryPermissions.write
        )
      )
      .handle("inventoryReserve", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            InventoryService.use((service) =>
              service
                .reserveInventory(payload)
                .pipe(Effect.map(serializeReservationResult))
            )
          ),
          inventoryPermissions.write
        )
      )
      .handle("inventoryStockLocationCreate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            InventoryService.use((service) =>
              service
                .createStockLocation(payload)
                .pipe(Effect.map(serializeStockLocation))
            )
          ),
          inventoryPermissions.write
        )
      )
);

export const inventoryEffectHttpApiContribution =
  defineEffectHttpApiModuleContribution({
    groups: [
      defineAdminHttpApiGroupContribution({
        group: inventoryAdminHttpApiGroup,
        handlers: inventoryAdminHttpApiHandlers,
        key: "module:inventory.admin",
        owner: "module",
      }),
    ],
    moduleName: "inventory",
  });

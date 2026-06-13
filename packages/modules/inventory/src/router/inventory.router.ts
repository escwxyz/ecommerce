import type { CommerceModuleApiFragment } from "@ecommerce/core";
import type { CommercePermissionDescriptor } from "@ecommerce/core/permissions";
import { implement, ORPCError } from "@orpc/server";

import { inventoryContractRouter } from "../contracts";
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
} from "../domain";
import { inventoryPermissions } from "../permissions";
import { createInventoryService, defaultInventoryService } from "../services";
import type { CreateInventoryServiceOptions } from "../services";

export interface InventoryModuleContext {
  readonly auth: unknown;
  readonly authorization: {
    evaluatePermission(input: {
      readonly permission: CommercePermissionDescriptor;
      readonly session: InventoryModuleContext["session"];
    }): InventoryAuthorizationDecision;
  };
  readonly session: {
    readonly user?: unknown | null;
  } | null;
}

type InventoryAuthorizationDecision =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly reason:
        | "missing-authenticated-actor"
        | "missing-permission"
        | "unsupported-permission";
    };

const assertPermission = (
  session: InventoryModuleContext["session"],
  permission: CommercePermissionDescriptor,
  authorization: InventoryModuleContext["authorization"]
): void => {
  const decision = authorization.evaluatePermission({ permission, session });

  if (decision.allowed) {
    return;
  }

  if (decision.reason === "missing-authenticated-actor") {
    throw new ORPCError("UNAUTHORIZED");
  }

  throw new ORPCError("FORBIDDEN");
};

const serializeItem = (item: InventoryItemRecord): InventoryItemApiRecord => ({
  createdAt: item.createdAt.toISOString(),
  id: item.id,
  metadata: item.metadata,
  sku: item.sku,
  title: item.title,
  updatedAt: item.updatedAt.toISOString(),
});

const serializeStockLocation = (
  location: StockLocationRecord
): StockLocationApiRecord => ({
  createdAt: location.createdAt.toISOString(),
  id: location.id,
  metadata: location.metadata,
  name: location.name,
  salesChannelIds: [...location.salesChannelIds],
  updatedAt: location.updatedAt.toISOString(),
});

const serializeLevel = (
  level: InventoryLevelRecord
): InventoryLevelApiRecord => ({
  createdAt: level.createdAt.toISOString(),
  id: level.id,
  inventoryItemId: level.inventoryItemId,
  reservedQuantity: level.reservedQuantity,
  stockLocationId: level.stockLocationId,
  stockedQuantity: level.stockedQuantity,
  updatedAt: level.updatedAt.toISOString(),
});

const serializeAvailability = (
  availability: InventoryAvailability
): InventoryAvailabilityApiRecord => availability;

const serializeReservation = (
  reservation: InventoryReservationRecord
): InventoryReservationApiRecord => ({
  causationId: reservation.causationId,
  correlationId: reservation.correlationId,
  createdAt: reservation.createdAt.toISOString(),
  id: reservation.id,
  idempotencyKey: reservation.idempotencyKey,
  inventoryItemId: reservation.inventoryItemId,
  quantity: reservation.quantity,
  releasedAt: reservation.releasedAt?.toISOString() ?? null,
  salesChannelId: reservation.salesChannelId,
  status: reservation.status,
  stockLocationId: reservation.stockLocationId,
  updatedAt: reservation.updatedAt.toISOString(),
  workflowRunId: reservation.workflowRunId,
});

const serializeAdjustmentEvent = (
  event: InventoryAdjustmentEventRecord
): InventoryAdjustmentEventApiRecord => ({
  adjustment: event.adjustment,
  causationId: event.causationId,
  correlationId: event.correlationId,
  createdAt: event.createdAt.toISOString(),
  id: event.id,
  inventoryItemId: event.inventoryItemId,
  reason: event.reason,
  stockLocationId: event.stockLocationId,
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

export interface CreateInventoryRouteFragmentOptions extends CreateInventoryServiceOptions {
  readonly key?: string;
}

export const createInventoryRouteFragment = ({
  key = "module:inventory",
  ...options
}: CreateInventoryRouteFragmentOptions = {}) => {
  const service =
    options.clock ||
    options.coordinator ||
    options.eventPublisher ||
    options.idGenerator ||
    options.repository
      ? createInventoryService(options)
      : defaultInventoryService;

  const baseImplementation = implement(
    inventoryContractRouter
  ).$context<InventoryModuleContext>();

  const protectedImplementation = baseImplementation.use(
    ({ context, next }) => {
      if (!context.session?.user) {
        throw new ORPCError("UNAUTHORIZED");
      }

      return next({
        context: {
          auth: context.auth,
          authorization: context.authorization,
          session: context.session,
        },
      });
    }
  );

  const router = protectedImplementation.router({
    inventoryAdjust: protectedImplementation.inventoryAdjust.handler(
      async ({ context, input }) => {
        assertPermission(
          context.session,
          inventoryPermissions.write,
          context.authorization
        );

        return serializeAdjustmentEvent(await service.adjustInventory(input));
      }
    ),
    inventoryAvailabilityCheck:
      protectedImplementation.inventoryAvailabilityCheck.handler(
        async ({ context, input }) => {
          assertPermission(
            context.session,
            inventoryPermissions.read,
            context.authorization
          );

          return serializeAvailability(await service.checkAvailability(input));
        }
      ),
    inventoryItemCreate: protectedImplementation.inventoryItemCreate.handler(
      async ({ context, input }) => {
        assertPermission(
          context.session,
          inventoryPermissions.write,
          context.authorization
        );

        return serializeItem(await service.createInventoryItem(input));
      }
    ),
    inventoryLevelSet: protectedImplementation.inventoryLevelSet.handler(
      async ({ context, input }) => {
        assertPermission(
          context.session,
          inventoryPermissions.write,
          context.authorization
        );

        return serializeLevel(await service.setInventoryLevel(input));
      }
    ),
    inventoryReserve: protectedImplementation.inventoryReserve.handler(
      async ({ context, input }) => {
        assertPermission(
          context.session,
          inventoryPermissions.write,
          context.authorization
        );

        return serializeReservationResult(
          await service.reserveInventory(input)
        );
      }
    ),
    inventoryStockLocationCreate:
      protectedImplementation.inventoryStockLocationCreate.handler(
        async ({ context, input }) => {
          assertPermission(
            context.session,
            inventoryPermissions.write,
            context.authorization
          );

          return serializeStockLocation(
            await service.createStockLocation(input)
          );
        }
      ),
  });

  return {
    key,
    router,
  } as const satisfies CommerceModuleApiFragment<typeof router>;
};

export const inventoryApiFragment = createInventoryRouteFragment();
export const inventoryRouter = inventoryApiFragment.router;

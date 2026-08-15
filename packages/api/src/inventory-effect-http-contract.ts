import {
  RepositoryConflict,
  RepositoryDecodeFailure,
  RepositoryUnavailable,
  TransactionalMutationFailure,
} from "@ecommerce/core";
import {
  AdjustInventoryInputSchema,
  CreateInventoryItemInputSchema,
  CreateStockLocationInputSchema,
  InventoryAdjustmentEventApiRecordSchema,
  InventoryInsufficientStock,
  InventoryInvalidIdentifier,
  InventoryItemApiRecordSchema,
  InventoryItemNotFound,
  InventoryLevelApiRecordSchema,
  InventoryLevelNotFound,
  InventoryReservationApiRecordSchema,
  InventoryValidationFailure,
  InventoryAvailabilityApiSchema,
  InventoryAvailabilityInputSchema,
  ReservationResultApiSchema,
  ReserveInventoryInputSchema,
  SetInventoryLevelInputSchema,
  StockLocationApiRecordSchema,
  StockLocationNotFound,
} from "@ecommerce/inventory";
import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from "effect/unstable/httpapi";

import {
  EffectHttpAuthMiddleware,
  EffectHttpExecutionMiddleware,
  EffectHttpForbidden,
  EffectHttpRequestContextMiddleware,
} from "./effect-http-middleware";
import { createApiSuccessSchema } from "./http-api-schemas";

const inventoryDomainErrors = [
  InventoryInsufficientStock.pipe(HttpApiSchema.status(409)),
  InventoryInvalidIdentifier.pipe(HttpApiSchema.status(400)),
  InventoryItemNotFound.pipe(HttpApiSchema.status(404)),
  InventoryLevelNotFound.pipe(HttpApiSchema.status(404)),
  InventoryValidationFailure.pipe(HttpApiSchema.status(400)),
  StockLocationNotFound.pipe(HttpApiSchema.status(404)),
] as const;

const inventoryPersistenceErrors = [
  RepositoryConflict.pipe(HttpApiSchema.status(409)),
  RepositoryDecodeFailure.pipe(HttpApiSchema.status(503)),
  RepositoryUnavailable.pipe(HttpApiSchema.status(503)),
  TransactionalMutationFailure.pipe(HttpApiSchema.status(503)),
] as const;

export const inventoryReadErrors = [
  EffectHttpForbidden,
  ...inventoryDomainErrors,
  ...inventoryPersistenceErrors,
] as const;

export const inventoryWriteErrors = [
  EffectHttpForbidden,
  ...inventoryDomainErrors,
  ...inventoryPersistenceErrors,
] as const;

export const InventoryAdjustmentEventApiRecordSuccessSchema =
  createApiSuccessSchema(InventoryAdjustmentEventApiRecordSchema);
export const InventoryAvailabilityApiSuccessSchema = createApiSuccessSchema(
  InventoryAvailabilityApiSchema
);
export const InventoryItemApiRecordSuccessSchema = createApiSuccessSchema(
  InventoryItemApiRecordSchema
);
export const InventoryLevelApiRecordSuccessSchema = createApiSuccessSchema(
  InventoryLevelApiRecordSchema
);
export const InventoryReservationApiRecordSuccessSchema =
  createApiSuccessSchema(InventoryReservationApiRecordSchema);
export const ReservationResultApiSuccessSchema = createApiSuccessSchema(
  ReservationResultApiSchema
);
export const StockLocationApiRecordSuccessSchema = createApiSuccessSchema(
  StockLocationApiRecordSchema
);

const inventoryAdminGroupIdentifier = "inventoryAdmin";

/** Inventory admin Effect HTTP contract for stock, availability, and reservation operations. */
export const inventoryAdminHttpApiGroup = HttpApiGroup.make(
  inventoryAdminGroupIdentifier
)
  .add(
    HttpApiEndpoint.post("inventoryAdjust", "/admin/inventory/adjustments", {
      error: inventoryWriteErrors,
      payload: AdjustInventoryInputSchema,
      success: InventoryAdjustmentEventApiRecordSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.post(
      "inventoryAvailabilityCheck",
      "/admin/inventory/availability",
      {
        error: inventoryReadErrors,
        payload: InventoryAvailabilityInputSchema,
        success: InventoryAvailabilityApiSuccessSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post("inventoryItemCreate", "/admin/inventory/items", {
      error: inventoryWriteErrors,
      payload: CreateInventoryItemInputSchema,
      success: InventoryItemApiRecordSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.put("inventoryLevelSet", "/admin/inventory/levels", {
      error: inventoryWriteErrors,
      payload: SetInventoryLevelInputSchema,
      success: InventoryLevelApiRecordSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.post("inventoryReserve", "/admin/inventory/reservations", {
      error: inventoryWriteErrors,
      payload: ReserveInventoryInputSchema,
      success: ReservationResultApiSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.post(
      "inventoryStockLocationCreate",
      "/admin/inventory/stock-locations",
      {
        error: inventoryWriteErrors,
        payload: CreateStockLocationInputSchema,
        success: StockLocationApiRecordSuccessSchema,
      }
    )
  )
  .middleware(EffectHttpExecutionMiddleware)
  .middleware(EffectHttpAuthMiddleware)
  .middleware(EffectHttpRequestContextMiddleware);

import {
  EffectHttpAuthMiddleware,
  EffectHttpExecutionMiddleware,
  EffectHttpForbidden,
  EffectHttpRequestContextMiddleware,
} from "@ecommerce/api/effect-http-middleware";
import { createApiSuccessSchema } from "@ecommerce/api/http-api-schemas";
import {
  RepositoryConflict,
  RepositoryDecodeFailure,
  RepositoryUnavailable,
  TransactionalMutationFailure,
} from "@ecommerce/core";
import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from "effect/unstable/httpapi";

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
} from "../domain";

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

/** Declared HTTP error schemas for this module contract surface. */
export const inventoryReadErrors = [
  EffectHttpForbidden,
  ...inventoryDomainErrors,
  ...inventoryPersistenceErrors,
] as const;

/** Declared HTTP error schemas for this module contract surface. */
export const inventoryWriteErrors = [
  EffectHttpForbidden,
  ...inventoryDomainErrors,
  ...inventoryPersistenceErrors,
] as const;

/** Success envelope schema exported for contract-only API consumers. */
export const InventoryAdjustmentEventApiRecordSuccessSchema =
  createApiSuccessSchema(InventoryAdjustmentEventApiRecordSchema);
/** Success envelope schema exported for contract-only API consumers. */
export const InventoryAvailabilityApiSuccessSchema = createApiSuccessSchema(
  InventoryAvailabilityApiSchema
);
/** Success envelope schema exported for contract-only API consumers. */
export const InventoryItemApiRecordSuccessSchema = createApiSuccessSchema(
  InventoryItemApiRecordSchema
);
/** Success envelope schema exported for contract-only API consumers. */
export const InventoryLevelApiRecordSuccessSchema = createApiSuccessSchema(
  InventoryLevelApiRecordSchema
);
/** Success envelope schema exported for contract-only API consumers. */
export const InventoryReservationApiRecordSuccessSchema =
  createApiSuccessSchema(InventoryReservationApiRecordSchema);
/** Success envelope schema exported for contract-only API consumers. */
export const ReservationResultApiSuccessSchema = createApiSuccessSchema(
  ReservationResultApiSchema
);
/** Success envelope schema exported for contract-only API consumers. */
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

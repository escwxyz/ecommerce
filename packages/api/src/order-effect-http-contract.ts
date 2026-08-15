import {
  RepositoryConflict,
  RepositoryDecodeFailure,
  RepositoryUnavailable,
  TransactionalMutationFailure,
} from "@ecommerce/core";
import {
  CreateOrderFromCheckoutInputSchema,
  OrderAggregateApiSchema,
  OrderApiListSchema,
  OrderIdentifierSchema,
  OrderInvalidIdentifier,
  OrderNotFound,
  OrderTransactionApiRecordSchema,
  OrderValidationFailure,
  RecordOrderTransactionInputSchema,
  TransitionOrderStatusInputSchema,
} from "@ecommerce/order";
import { Schema } from "effect";
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

const orderAdminGroupIdentifier = "orderAdmin";

const orderDomainErrors = [
  OrderInvalidIdentifier.pipe(HttpApiSchema.status(400)),
  OrderNotFound.pipe(HttpApiSchema.status(404)),
  OrderValidationFailure.pipe(HttpApiSchema.status(400)),
] as const;
const orderPersistenceErrors = [
  RepositoryConflict.pipe(HttpApiSchema.status(409)),
  RepositoryDecodeFailure.pipe(HttpApiSchema.status(503)),
  RepositoryUnavailable.pipe(HttpApiSchema.status(503)),
  TransactionalMutationFailure.pipe(HttpApiSchema.status(503)),
] as const;

export const orderReadErrors = [
  EffectHttpForbidden,
  ...orderDomainErrors,
  ...orderPersistenceErrors,
] as const;
export const orderWriteErrors = [
  EffectHttpForbidden,
  ...orderDomainErrors,
  ...orderPersistenceErrors,
] as const;

export const OrderAggregateSuccessSchema = createApiSuccessSchema(
  OrderAggregateApiSchema
);
export const OrderAggregateNullableSuccessSchema = createApiSuccessSchema(
  Schema.NullOr(OrderAggregateApiSchema)
);
export const OrderListSuccessSchema =
  createApiSuccessSchema(OrderApiListSchema);
export const OrderTransactionSuccessSchema = createApiSuccessSchema(
  OrderTransactionApiRecordSchema
);

/** Order admin Effect HTTP contract for checkout snapshots and order history. */
export const orderAdminHttpApiGroup = HttpApiGroup.make(
  orderAdminGroupIdentifier
)
  .add(
    HttpApiEndpoint.post("orderCreateFromCheckout", "/admin/orders", {
      error: orderWriteErrors,
      payload: CreateOrderFromCheckoutInputSchema,
      success: OrderAggregateSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.get("orderGet", "/admin/orders/:id", {
      error: orderReadErrors,
      params: OrderIdentifierSchema,
      success: OrderAggregateNullableSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.get("orderList", "/admin/orders", {
      error: orderReadErrors,
      success: OrderListSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.post(
      "orderRecordTransaction",
      "/admin/orders/:orderId/transactions",
      {
        error: orderWriteErrors,
        payload: RecordOrderTransactionInputSchema,
        success: OrderTransactionSuccessSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post(
      "orderTransitionStatus",
      "/admin/orders/:orderId/status",
      {
        error: orderWriteErrors,
        payload: TransitionOrderStatusInputSchema,
        success: OrderAggregateSuccessSchema,
      }
    )
  )
  .middleware(EffectHttpExecutionMiddleware)
  .middleware(EffectHttpAuthMiddleware)
  .middleware(EffectHttpRequestContextMiddleware);

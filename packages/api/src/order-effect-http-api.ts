import {
  OrderService,
  createOrderIdEffect,
  orderPermissions,
} from "@ecommerce/order";
import type {
  OrderAggregate,
  OrderAggregateApiRecord,
  OrderLineItemRecord,
  OrderPostPurchaseOperationRecord,
  OrderRecord,
  OrderStateTransitionRecord,
  OrderTransactionRecord,
} from "@ecommerce/order";
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
import { orderAdminHttpApiGroup } from "./order-effect-http-contract";

const serializeOrder = (order: OrderRecord) => ({
  ...order,
  completedAt: order.completedAt?.toISOString() ?? null,
  createdAt: order.createdAt.toISOString(),
  updatedAt: order.updatedAt.toISOString(),
});

const serializeLineItem = (item: OrderLineItemRecord) => ({
  ...item,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
});

const serializeTransaction = (transaction: OrderTransactionRecord) => ({
  ...transaction,
  createdAt: transaction.createdAt.toISOString(),
  updatedAt: transaction.updatedAt.toISOString(),
});

const serializeTransition = (transition: OrderStateTransitionRecord) => ({
  ...transition,
  changedAt: transition.changedAt.toISOString(),
});

const serializeOperation = (operation: OrderPostPurchaseOperationRecord) => ({
  ...operation,
  createdAt: operation.createdAt.toISOString(),
  updatedAt: operation.updatedAt.toISOString(),
});

const serializeAggregate = (
  aggregate: OrderAggregate
): OrderAggregateApiRecord => ({
  lineItems: aggregate.lineItems.map(serializeLineItem),
  operations: aggregate.operations.map(serializeOperation),
  order: serializeOrder(aggregate.order),
  stateTransitions: aggregate.stateTransitions.map(serializeTransition),
  transactions: aggregate.transactions.map(serializeTransaction),
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
  Effect.gen(function* createOrderApiSuccessEnvelope() {
    const context = yield* CurrentEffectHttpRequestContext;
    const data = yield* effect;
    return withSuccessEnvelope(data, context.identity);
  });

const orderAdminGroupIdentifier = "orderAdmin";
const orderAdminHttpApi = HttpApi.make("OrderAdminApi").add(
  orderAdminHttpApiGroup
);

export const orderAdminHttpApiHandlers = HttpApiBuilder.group(
  orderAdminHttpApi,
  orderAdminGroupIdentifier,
  (handlers) =>
    handlers
      .handle("orderCreateFromCheckout", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            OrderService.use((service) =>
              service
                .createOrderFromCheckout(payload)
                .pipe(Effect.map(serializeAggregate))
            )
          ),
          orderPermissions.write
        )
      )
      .handle("orderGet", ({ params }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            createOrderIdEffect(params.id).pipe(
              Effect.flatMap((orderId) =>
                OrderService.use((service) => service.getOrder(orderId))
              ),
              Effect.map((aggregate) =>
                aggregate ? serializeAggregate(aggregate) : null
              )
            )
          ),
          orderPermissions.read
        )
      )
      .handle("orderList", () =>
        withEffectHttpPermission(
          withCurrentRequest(
            OrderService.use((service) =>
              service.listOrders.pipe(Effect.map((orders) => orders.map(serializeOrder)))
            )
          ),
          orderPermissions.read
        )
      )
      .handle("orderRecordTransaction", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            OrderService.use((service) =>
              service
                .recordTransaction(payload)
                .pipe(Effect.map(serializeTransaction))
            )
          ),
          orderPermissions.write
        )
      )
      .handle("orderTransitionStatus", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            OrderService.use((service) =>
              service.transitionStatus(payload).pipe(Effect.map(serializeAggregate))
            )
          ),
          orderPermissions.write
        )
      )
);

export const orderEffectHttpApiContribution =
  defineEffectHttpApiModuleContribution({
    groups: [
      defineAdminHttpApiGroupContribution({
        group: orderAdminHttpApiGroup,
        handlers: orderAdminHttpApiHandlers,
        key: "module:order.admin",
        owner: "module",
      }),
    ],
    moduleName: "order",
  });

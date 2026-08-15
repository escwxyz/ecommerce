import type {
  ClockServiceShape,
  IdGeneratorServiceShape,
  OutboxWriterServiceShape,
  TransactionBoundaryServiceShape,
  CurrentTransactionService,
} from "@ecommerce/core";
import {
  COMMERCE_EVENTS_OUTBOX_TOPIC,
  OutboxWriterService,
  TransactionBoundaryService,
  executeTransactionalMutation,
} from "@ecommerce/core";
import { createEventEnvelope } from "@ecommerce/core/events";
import { Context, Effect, Layer } from "effect";
import type { Effect as EffectValue } from "effect/Effect";
import { nanoid } from "nanoid";

import type {
  CreateOrderFromCheckoutInput,
  OrderAggregate,
  OrderExpectedError,
  OrderId,
  OrderLineItemRecord,
  OrderRecord,
  OrderRepository,
  OrderTransactionRecord,
  RecordOrderTransactionInput,
  TransitionOrderStatusInput,
} from "../domain";
import {
  ORDER_ID_PREFIX,
  ORDER_LINE_ITEM_ID_PREFIX,
  ORDER_TRANSACTION_ID_PREFIX,
  OrderNotFound,
  OrderRepositoryService,
  OrderValidationFailure,
  createOrderIdEffect,
  createOrderLineItemIdEffect,
  createOrderTransactionIdEffect,
} from "../domain";

export const ORDER_PLACED_EVENT = "order.placed" as const;
export const ORDER_STATUS_TRANSITIONED_EVENT =
  "order.status-transitioned" as const;
export const ORDER_TRANSACTION_RECORDED_EVENT =
  "order.transaction-recorded" as const;

export interface OrderServiceShape {
  readonly createOrderFromCheckout: (
    input: CreateOrderFromCheckoutInput
  ) => EffectValue<OrderAggregate, OrderExpectedError>;
  readonly getOrder: (
    id: OrderId
  ) => EffectValue<OrderAggregate | null, OrderExpectedError>;
  readonly listOrders: EffectValue<readonly OrderRecord[], OrderExpectedError>;
  readonly recordTransaction: (
    input: RecordOrderTransactionInput
  ) => EffectValue<OrderTransactionRecord, OrderExpectedError>;
  readonly transitionStatus: (
    input: TransitionOrderStatusInput
  ) => EffectValue<OrderAggregate, OrderExpectedError>;
}

export const OrderService = Context.Service<OrderServiceShape>(
  "@ecommerce/order/OrderService"
);

export interface CreateOrderServiceOptions {
  readonly clock?: ClockServiceShape;
  readonly idGenerator?: IdGeneratorServiceShape;
  readonly outboxWriter: OutboxWriterServiceShape;
  readonly repository: OrderRepository;
  readonly transactionBoundary: TransactionBoundaryServiceShape;
}

const createDefaultClock = (): ClockServiceShape => ({
  now: () => new Date(),
});

const createDefaultIdGenerator = (): IdGeneratorServiceShape => ({
  nextId: () => nanoid(),
});

const createPrefixedId = (
  idGenerator: IdGeneratorServiceShape,
  prefix: string
): string => {
  const nextId = idGenerator.nextId();
  return nextId.startsWith(prefix) ? nextId : `${prefix}${nextId}`;
};

const normalizeCurrencyCode = (currencyCode: string): string =>
  currencyCode.trim().toUpperCase();

const requireOrder = (repository: OrderRepository, id: OrderId) =>
  Effect.gen(function* requireOrderEffect() {
    const order = yield* repository.findOrderById(id);

    if (!order) {
      return yield* new OrderNotFound({ orderId: id });
    }

    return order;
  });

const requireAggregate = (repository: OrderRepository, id: OrderId) =>
  Effect.gen(function* requireOrderAggregateEffect() {
    const aggregate = yield* repository.getOrderAggregate(id);

    if (!aggregate) {
      return yield* new OrderNotFound({ orderId: id });
    }

    return aggregate;
  });

const publishOrderEvent = ({
  causationId,
  correlationId,
  idGenerator,
  idempotencyKey,
  name,
  orderId,
  outboxWriter,
  payload,
  workflowRunId,
}: {
  readonly causationId?: string;
  readonly correlationId: string;
  readonly idGenerator: IdGeneratorServiceShape;
  readonly idempotencyKey: string;
  readonly name: string;
  readonly orderId: OrderId;
  readonly outboxWriter: OutboxWriterServiceShape;
  readonly payload: unknown;
  readonly workflowRunId?: string;
}) => {
  const event = createEventEnvelope({
    causationId,
    correlationId,
    id: createPrefixedId(idGenerator, "evt_"),
    name,
    payload,
    sourceModule: "order",
    subject: {
      id: orderId,
      type: "order",
    },
    workflowRunId,
  });

  return outboxWriter.enqueue({
    event,
    idempotencyKey: `${event.name}:${idempotencyKey}`,
    topic: COMMERCE_EVENTS_OUTBOX_TOPIC,
  });
};

export const createOrderService = ({
  clock = createDefaultClock(),
  idGenerator = createDefaultIdGenerator(),
  outboxWriter,
  repository,
  transactionBoundary,
}: CreateOrderServiceOptions): OrderServiceShape => {
  const service = {
    createOrderFromCheckout: (input: CreateOrderFromCheckoutInput) =>
      Effect.gen(function* createOrderFromCheckoutEffect() {
        const duplicate = yield* repository.findOrderByIdempotencyKey(
          input.idempotencyKey
        );

        if (duplicate) {
          return yield* requireAggregate(repository, duplicate.id);
        }

        const now = clock.now();
        const orderId = yield* createOrderIdEffect(
          createPrefixedId(idGenerator, ORDER_ID_PREFIX)
        );
        const currencyCode = normalizeCurrencyCode(input.totals.currencyCode);
        const order: OrderRecord = {
          billingAddress: input.billingAddress ?? null,
          cartId: input.cartId,
          completedAt: null,
          createdAt: now,
          currencyCode,
          customerId: input.customerId ?? null,
          email: input.email ?? null,
          fulfillmentReferences: [...(input.fulfillmentReferences ?? [])],
          id: orderId,
          metadata: input.metadata ?? {},
          paymentReferences: [...(input.paymentReferences ?? [])],
          shippingAddress: input.shippingAddress ?? null,
          status: "placed",
          totals: {
            ...input.totals,
            currencyCode,
          },
          updatedAt: now,
        };
        const lineItems: OrderLineItemRecord[] = [];

        for (const item of input.lineItems) {
          lineItems.push({
            createdAt: now,
            id: yield* createOrderLineItemIdEffect(
              createPrefixedId(idGenerator, ORDER_LINE_ITEM_ID_PREFIX)
            ),
            itemSnapshot: {
              ...item.itemSnapshot,
              metadata: item.itemSnapshot.metadata
                ? { ...item.itemSnapshot.metadata }
                : undefined,
            },
            metadata: item.metadata ?? {},
            orderId,
            quantity: item.quantity,
            taxTotal: item.taxTotal ?? 0,
            title: item.title.trim(),
            total: item.total,
            unitPrice: item.unitPrice,
            updatedAt: now,
          });
        }

        const aggregate = yield* repository.saveOrderAggregate(
          {
            lineItems,
            operations: [],
            order,
            stateTransitions: [
              {
                changedAt: now,
                fromStatus: null,
                metadata: {},
                orderId,
                toStatus: "placed",
              },
            ],
            transactions: [],
          },
          input.idempotencyKey
        );

        yield* publishOrderEvent({
          causationId: input.causationId,
          correlationId: input.correlationId,
          idGenerator,
          idempotencyKey: input.idempotencyKey,
          name: ORDER_PLACED_EVENT,
          orderId,
          outboxWriter,
          payload: {
            cartId: input.cartId,
            orderId,
            total: order.totals.total,
          },
          workflowRunId: input.workflowRunId,
        });

        return aggregate;
      }),
    getOrder: (id: OrderId) => repository.getOrderAggregate(id),
    listOrders: repository.listOrders,
    recordTransaction: (input: RecordOrderTransactionInput) =>
      Effect.gen(function* recordOrderTransactionEffect() {
        const orderId = yield* createOrderIdEffect(input.orderId);
        yield* requireOrder(repository, orderId);

        const now = clock.now();
        const transaction = yield* repository.saveOrderTransaction(
          {
            amount: input.amount,
            createdAt: now,
            currencyCode: normalizeCurrencyCode(input.currencyCode),
            id: yield* createOrderTransactionIdEffect(
              createPrefixedId(idGenerator, ORDER_TRANSACTION_ID_PREFIX)
            ),
            metadata: input.metadata ?? {},
            orderId,
            referenceId: input.referenceId ?? null,
            type: input.type,
            updatedAt: now,
          },
          input.idempotencyKey
        );

        yield* publishOrderEvent({
          causationId: input.causationId,
          correlationId: input.correlationId,
          idGenerator,
          idempotencyKey: input.idempotencyKey,
          name: ORDER_TRANSACTION_RECORDED_EVENT,
          orderId,
          outboxWriter,
          payload: {
            amount: transaction.amount,
            orderId,
            transactionId: transaction.id,
            type: transaction.type,
          },
          workflowRunId: input.workflowRunId,
        });

        return transaction;
      }),
    transitionStatus: (input: TransitionOrderStatusInput) =>
      Effect.gen(function* transitionOrderStatusEffect() {
        const orderId = yield* createOrderIdEffect(input.orderId);
        const duplicateTransition =
          yield* repository.findStateTransitionByIdempotencyKey(
            input.idempotencyKey
          );

        if (duplicateTransition) {
          if (
            duplicateTransition.orderId !== orderId ||
            duplicateTransition.toStatus !== input.status
          ) {
            return yield* new OrderValidationFailure({
              message: `Order status transition idempotency key "${input.idempotencyKey}" was already used.`,
            });
          }

          return yield* requireAggregate(repository, orderId);
        }

        const existing = yield* requireOrder(repository, orderId);

        if (existing.status === input.status) {
          return yield* requireAggregate(repository, orderId);
        }

        const now = clock.now();
        yield* repository.updateOrder({
          ...existing,
          completedAt:
            input.status === "completed" ? now : existing.completedAt,
          status: input.status,
          updatedAt: now,
        });
        yield* repository.saveStateTransition(
          {
            changedAt: now,
            fromStatus: existing.status,
            metadata: input.metadata ?? {},
            orderId,
            toStatus: input.status,
          },
          input.idempotencyKey
        );

        yield* publishOrderEvent({
          causationId: input.causationId,
          correlationId: input.correlationId,
          idGenerator,
          idempotencyKey: input.idempotencyKey,
          name: ORDER_STATUS_TRANSITIONED_EVENT,
          orderId,
          outboxWriter,
          payload: {
            fromStatus: existing.status,
            orderId,
            toStatus: input.status,
          },
          workflowRunId: input.workflowRunId,
        });

        return yield* requireAggregate(repository, orderId);
      }),
  };

  const transactionalOrderMutation = <A, E>(
    operation: string,
    effect: EffectValue<A, E, CurrentTransactionService>
  ) =>
    executeTransactionalMutation<A, E, never>({
      effect,
      moduleName: "order",
      operation,
      outboxMessages: () => [],
      outboxWriter,
      transactionBoundary,
    });

  return {
    ...service,
    createOrderFromCheckout: (input) =>
      transactionalOrderMutation(
        "createOrderFromCheckout",
        service.createOrderFromCheckout(input)
      ),
    recordTransaction: (input) =>
      transactionalOrderMutation(
        "recordTransaction",
        service.recordTransaction(input)
      ),
    transitionStatus: (input) =>
      transactionalOrderMutation(
        "transitionStatus",
        service.transitionStatus(input)
      ),
  };
};

export const createOrderServiceLayer = (service: OrderServiceShape) =>
  Layer.succeed(OrderService, service);

export const orderServiceFromRepositoryLayer = Layer.effect(
  OrderService,
  Effect.gen(function* createOrderServiceFromRepositoryEffect() {
    const repository = yield* OrderRepositoryService;
    const outboxWriter = yield* OutboxWriterService;
    const transactionBoundary = yield* TransactionBoundaryService;
    return createOrderService({
      outboxWriter,
      repository,
      transactionBoundary,
    });
  })
);

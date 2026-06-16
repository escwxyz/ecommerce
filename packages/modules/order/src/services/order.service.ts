import type {
  ClockServiceShape,
  EventPublisherServiceShape,
  IdGeneratorServiceShape,
} from "@ecommerce/core";
import { createEventEnvelope } from "@ecommerce/core/events";
import { Context, Layer } from "effect";
import { nanoid } from "nanoid";

import type {
  CreateOrderFromCheckoutInput,
  OrderAggregate,
  OrderId,
  OrderLineItemRecord,
  OrderRecord,
  OrderRepository,
  OrderTransactionRecord,
  RecordOrderTransactionInput,
  TransitionOrderStatusInput,
} from "../domain";
import {
  createOrderId,
  createOrderLineItemId,
  createOrderTransactionId,
  ORDER_ID_PREFIX,
  ORDER_LINE_ITEM_ID_PREFIX,
  ORDER_TRANSACTION_ID_PREFIX,
} from "../domain";
import { defaultOrderRepository } from "../repositories";

export const ORDER_PLACED_EVENT = "order.placed" as const;
export const ORDER_STATUS_TRANSITIONED_EVENT =
  "order.status-transitioned" as const;
export const ORDER_TRANSACTION_RECORDED_EVENT =
  "order.transaction-recorded" as const;

export interface OrderServiceShape {
  createOrderFromCheckout(
    input: CreateOrderFromCheckoutInput
  ): Promise<OrderAggregate>;
  getOrder(id: OrderId): Promise<OrderAggregate | null>;
  listOrders(): Promise<readonly OrderRecord[]>;
  recordTransaction(
    input: RecordOrderTransactionInput
  ): Promise<OrderTransactionRecord>;
  transitionStatus(input: TransitionOrderStatusInput): Promise<OrderAggregate>;
}

export const OrderService = Context.Service<OrderServiceShape>(
  "@ecommerce/order/OrderService"
);

export interface CreateOrderServiceOptions {
  readonly clock?: ClockServiceShape;
  readonly eventPublisher?: EventPublisherServiceShape;
  readonly idGenerator?: IdGeneratorServiceShape;
  readonly repository?: OrderRepository;
}

const createDefaultClock = (): ClockServiceShape => ({
  now: () => new Date(),
});

const createDefaultIdGenerator = (): IdGeneratorServiceShape => ({
  nextId: () => nanoid(),
});

const createNoopEventPublisher = (): EventPublisherServiceShape => ({
  publish: () => {
    // Order events are emitted when a runtime event bus is composed.
  },
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

const requireOrder = async (
  repository: OrderRepository,
  id: OrderId
): Promise<OrderRecord> => {
  const order = await repository.findOrderById(id);

  if (!order) {
    throw new Error(`Order "${id}" was not found.`);
  }

  return order;
};

const requireAggregate = async (
  repository: OrderRepository,
  id: OrderId
): Promise<OrderAggregate> => {
  const aggregate = await repository.getOrderAggregate(id);

  if (!aggregate) {
    throw new Error(`Order "${id}" was not found.`);
  }

  return aggregate;
};

const publishOrderEvent = async ({
  causationId,
  correlationId,
  eventPublisher,
  idGenerator,
  name,
  orderId,
  payload,
  workflowRunId,
}: {
  readonly causationId?: string;
  readonly correlationId: string;
  readonly eventPublisher: EventPublisherServiceShape;
  readonly idGenerator: IdGeneratorServiceShape;
  readonly name: string;
  readonly orderId: OrderId;
  readonly payload: unknown;
  readonly workflowRunId?: string;
}): Promise<void> => {
  await eventPublisher.publish(
    createEventEnvelope({
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
    })
  );
};

export const createOrderService = ({
  clock = createDefaultClock(),
  eventPublisher = createNoopEventPublisher(),
  idGenerator = createDefaultIdGenerator(),
  repository = defaultOrderRepository,
}: CreateOrderServiceOptions = {}): OrderServiceShape => ({
  createOrderFromCheckout: async (input) => {
    const duplicate = await repository.findOrderByIdempotencyKey(
      input.idempotencyKey
    );

    if (duplicate) {
      return requireAggregate(repository, createOrderId(duplicate.id));
    }

    const now = clock.now();
    const orderId = createOrderId(
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
    const lineItems: OrderLineItemRecord[] = input.lineItems.map((item) => ({
      createdAt: now,
      id: createOrderLineItemId(
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
    }));
    const aggregate = await repository.saveOrderAggregate(
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

    await publishOrderEvent({
      causationId: input.causationId,
      correlationId: input.correlationId,
      eventPublisher,
      idGenerator,
      name: ORDER_PLACED_EVENT,
      orderId,
      payload: {
        cartId: input.cartId,
        orderId,
        total: order.totals.total,
      },
      workflowRunId: input.workflowRunId,
    });

    return aggregate;
  },
  getOrder: (id) => repository.getOrderAggregate(id),
  listOrders: () => repository.listOrders(),
  recordTransaction: async (input) => {
    const orderId = createOrderId(input.orderId);
    await requireOrder(repository, orderId);

    const now = clock.now();
    const transaction = await repository.saveOrderTransaction(
      {
        amount: input.amount,
        createdAt: now,
        currencyCode: normalizeCurrencyCode(input.currencyCode),
        id: createOrderTransactionId(
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

    await publishOrderEvent({
      causationId: input.causationId,
      correlationId: input.correlationId,
      eventPublisher,
      idGenerator,
      name: ORDER_TRANSACTION_RECORDED_EVENT,
      orderId,
      payload: {
        amount: transaction.amount,
        orderId,
        transactionId: transaction.id,
        type: transaction.type,
      },
      workflowRunId: input.workflowRunId,
    });

    return transaction;
  },
  transitionStatus: async (input) => {
    const orderId = createOrderId(input.orderId);
    const duplicateTransition =
      await repository.findStateTransitionByIdempotencyKey(
        input.idempotencyKey
      );

    if (duplicateTransition) {
      if (
        duplicateTransition.orderId !== orderId ||
        duplicateTransition.toStatus !== input.status
      ) {
        throw new Error(
          `Order status transition idempotency key "${input.idempotencyKey}" was already used.`
        );
      }

      return requireAggregate(repository, orderId);
    }

    const existing = await requireOrder(repository, orderId);

    if (existing.status === input.status) {
      return requireAggregate(repository, orderId);
    }

    const now = clock.now();
    await repository.updateOrder({
      ...existing,
      completedAt: input.status === "completed" ? now : existing.completedAt,
      status: input.status,
      updatedAt: now,
    });
    await repository.saveStateTransition(
      {
        changedAt: now,
        fromStatus: existing.status,
        metadata: input.metadata ?? {},
        orderId,
        toStatus: input.status,
      },
      input.idempotencyKey
    );

    await publishOrderEvent({
      causationId: input.causationId,
      correlationId: input.correlationId,
      eventPublisher,
      idGenerator,
      name: ORDER_STATUS_TRANSITIONED_EVENT,
      orderId,
      payload: {
        fromStatus: existing.status,
        orderId,
        toStatus: input.status,
      },
      workflowRunId: input.workflowRunId,
    });

    return requireAggregate(repository, orderId);
  },
});

export const defaultOrderService = createOrderService();

export const createOrderServiceLayer = (
  options: CreateOrderServiceOptions = {}
) => Layer.succeed(OrderService, createOrderService(options));

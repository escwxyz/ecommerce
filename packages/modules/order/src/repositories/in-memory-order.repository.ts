import { Effect, Layer } from "effect";

import type {
  OrderAggregate,
  OrderExpectedError,
  OrderId,
  OrderRecord,
  OrderRepository,
  OrderStateTransitionRecord,
  OrderTransactionRecord,
} from "../domain";
import { OrderNotFound, OrderRepositoryService } from "../domain";

const cloneDate = (date: Date): Date => new Date(date);

const cloneOrder = (order: OrderRecord): OrderRecord => ({
  ...order,
  completedAt: order.completedAt ? cloneDate(order.completedAt) : null,
  createdAt: cloneDate(order.createdAt),
  fulfillmentReferences: order.fulfillmentReferences.map((reference) => ({
    ...reference,
  })),
  metadata: { ...order.metadata },
  paymentReferences: order.paymentReferences.map((reference) => ({
    ...reference,
  })),
  totals: { ...order.totals },
  updatedAt: cloneDate(order.updatedAt),
});

const cloneAggregate = (aggregate: OrderAggregate): OrderAggregate => ({
  lineItems: aggregate.lineItems.map((item) => ({
    ...item,
    createdAt: cloneDate(item.createdAt),
    itemSnapshot: {
      ...item.itemSnapshot,
      metadata: item.itemSnapshot.metadata
        ? { ...item.itemSnapshot.metadata }
        : undefined,
    },
    metadata: { ...item.metadata },
    updatedAt: cloneDate(item.updatedAt),
  })),
  operations: aggregate.operations.map((operation) => ({
    ...operation,
    createdAt: cloneDate(operation.createdAt),
    metadata: { ...operation.metadata },
    updatedAt: cloneDate(operation.updatedAt),
  })),
  order: cloneOrder(aggregate.order),
  stateTransitions: aggregate.stateTransitions.map((transition) => ({
    ...transition,
    changedAt: cloneDate(transition.changedAt),
    metadata: { ...transition.metadata },
  })),
  transactions: aggregate.transactions.map((transaction) => ({
    ...transaction,
    createdAt: cloneDate(transaction.createdAt),
    metadata: { ...transaction.metadata },
    updatedAt: cloneDate(transaction.updatedAt),
  })),
});

export interface ResettableOrderRepository extends OrderRepository {
  readonly clear: Effect.Effect<void>;
}

export class InMemoryOrderRepository implements ResettableOrderRepository {
  readonly #aggregates = new Map<string, OrderAggregate>();
  readonly #orderIdempotency = new Map<string, string>();
  readonly #transactionIdempotency = new Map<string, string>();
  readonly #transitionIdempotency = new Map<
    string,
    OrderStateTransitionRecord
  >();

  readonly clear = Effect.sync(() => {
    this.#aggregates.clear();
    this.#orderIdempotency.clear();
    this.#transactionIdempotency.clear();
    this.#transitionIdempotency.clear();
  });

  readonly findOrderById = (
    orderId: OrderId
  ): Effect.Effect<OrderRecord | null, OrderExpectedError> =>
    Effect.sync(() => {
      const aggregate = this.#aggregates.get(orderId);
      return aggregate ? cloneOrder(aggregate.order) : null;
    });

  readonly findOrderByIdempotencyKey = (
    idempotencyKey: string
  ): Effect.Effect<OrderRecord | null, OrderExpectedError> => {
    const self = this;
    return Effect.gen(function* findOrderByIdempotencyKeyEffect() {
      const orderId = self.#orderIdempotency.get(idempotencyKey);
      return orderId ? yield* self.findOrderById(orderId as OrderId) : null;
    });
  };

  readonly findStateTransitionByIdempotencyKey = (
    idempotencyKey: string
  ): Effect.Effect<OrderStateTransitionRecord | null, OrderExpectedError> =>
    Effect.sync(() => {
      const transition = this.#transitionIdempotency.get(idempotencyKey);

      return transition
        ? {
            ...transition,
            changedAt: cloneDate(transition.changedAt),
            metadata: { ...transition.metadata },
          }
        : null;
    });

  readonly getOrderAggregate = (
    orderId: OrderId
  ): Effect.Effect<OrderAggregate | null, OrderExpectedError> =>
    Effect.sync(() => {
      const aggregate = this.#aggregates.get(orderId);
      return aggregate ? cloneAggregate(aggregate) : null;
    });

  readonly listOrders: Effect.Effect<
    readonly OrderRecord[],
    OrderExpectedError
  > = Effect.sync(() =>
    [...this.#aggregates.values()].map((aggregate) =>
      cloneOrder(aggregate.order)
    )
  );

  readonly saveOrderAggregate = (
    aggregate: OrderAggregate,
    idempotencyKey: string
  ): Effect.Effect<OrderAggregate, OrderExpectedError> =>
    Effect.sync(() => {
      const existingOrderId = this.#orderIdempotency.get(idempotencyKey);

      if (existingOrderId) {
        const existing = this.#aggregates.get(existingOrderId);
        if (existing) {
          return cloneAggregate(existing);
        }
      }

      const cloned = cloneAggregate(aggregate);
      this.#aggregates.set(cloned.order.id, cloned);
      this.#orderIdempotency.set(idempotencyKey, cloned.order.id);

      return cloneAggregate(cloned);
    });

  readonly saveOrderTransaction = (
    transaction: OrderTransactionRecord,
    idempotencyKey: string
  ): Effect.Effect<OrderTransactionRecord, OrderExpectedError> => {
    const self = this;
    return Effect.gen(function* saveOrderTransactionEffect() {
      const existingId = self.#transactionIdempotency.get(idempotencyKey);

      if (existingId) {
        const existing = self.#aggregates
          .get(transaction.orderId)
          ?.transactions.find(
            (candidate: OrderTransactionRecord) => candidate.id === existingId
          );

        if (existing) {
          return {
            ...existing,
            createdAt: cloneDate(existing.createdAt),
            updatedAt: cloneDate(existing.updatedAt),
          };
        }
      }

      const aggregate = self.#aggregates.get(transaction.orderId);

      if (!aggregate) {
        return yield* new OrderNotFound({ orderId: transaction.orderId });
      }

      self.#aggregates.set(transaction.orderId, {
        ...aggregate,
        transactions: [...aggregate.transactions, transaction],
      });
      self.#transactionIdempotency.set(idempotencyKey, transaction.id);

      return {
        ...transaction,
        createdAt: cloneDate(transaction.createdAt),
        updatedAt: cloneDate(transaction.updatedAt),
      };
    });
  };

  readonly saveStateTransition = (
    transition: OrderStateTransitionRecord,
    idempotencyKey: string
  ): Effect.Effect<OrderStateTransitionRecord, OrderExpectedError> => {
    const self = this;
    return Effect.gen(function* saveStateTransitionEffect() {
      const existing = self.#transitionIdempotency.get(idempotencyKey);

      if (existing) {
        return {
          ...existing,
          changedAt: cloneDate(existing.changedAt),
          metadata: { ...existing.metadata },
        };
      }

      const aggregate = self.#aggregates.get(transition.orderId);

      if (!aggregate) {
        return yield* new OrderNotFound({ orderId: transition.orderId });
      }

      self.#aggregates.set(transition.orderId, {
        ...aggregate,
        stateTransitions: [...aggregate.stateTransitions, transition],
      });
      self.#transitionIdempotency.set(idempotencyKey, transition);

      return {
        ...transition,
        changedAt: cloneDate(transition.changedAt),
        metadata: { ...transition.metadata },
      };
    });
  };

  readonly updateOrder = (
    order: OrderRecord
  ): Effect.Effect<OrderRecord, OrderExpectedError> => {
    const self = this;
    return Effect.gen(function* updateOrderEffect() {
      const aggregate = self.#aggregates.get(order.id);

      if (!aggregate) {
        return yield* new OrderNotFound({ orderId: order.id });
      }

      self.#aggregates.set(order.id, {
        ...aggregate,
        order: cloneOrder(order),
      });

      return cloneOrder(order);
    });
  };
}

export const createInMemoryOrderRepository = (): OrderRepository =>
  new InMemoryOrderRepository();

export const createResettableInMemoryOrderRepository =
  (): ResettableOrderRepository => new InMemoryOrderRepository();

export const defaultOrderRepository = createInMemoryOrderRepository();

export const createOrderRepositoryLayer = (repository: OrderRepository) =>
  Layer.succeed(OrderRepositoryService, repository);

import type {
  OrderAggregate,
  OrderRecord,
  OrderRepository,
  OrderStateTransitionRecord,
  OrderTransactionRecord,
} from "../domain";

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

export class InMemoryOrderRepository implements OrderRepository {
  readonly #aggregates = new Map<string, OrderAggregate>();
  readonly #orderIdempotency = new Map<string, string>();
  readonly #transactionIdempotency = new Map<string, string>();
  readonly #transitionIdempotency = new Map<
    string,
    OrderStateTransitionRecord
  >();

  findOrderById(orderId: string): Promise<OrderRecord | null> {
    const aggregate = this.#aggregates.get(orderId);

    return Promise.resolve(aggregate ? cloneOrder(aggregate.order) : null);
  }

  findOrderByIdempotencyKey(
    idempotencyKey: string
  ): Promise<OrderRecord | null> {
    const orderId = this.#orderIdempotency.get(idempotencyKey);

    return orderId ? this.findOrderById(orderId) : Promise.resolve(null);
  }

  findStateTransitionByIdempotencyKey(
    idempotencyKey: string
  ): Promise<OrderStateTransitionRecord | null> {
    const transition = this.#transitionIdempotency.get(idempotencyKey);

    return Promise.resolve(
      transition
        ? {
            ...transition,
            changedAt: cloneDate(transition.changedAt),
            metadata: { ...transition.metadata },
          }
        : null
    );
  }

  getOrderAggregate(orderId: string): Promise<OrderAggregate | null> {
    const aggregate = this.#aggregates.get(orderId);

    return Promise.resolve(aggregate ? cloneAggregate(aggregate) : null);
  }

  listOrders(): Promise<readonly OrderRecord[]> {
    return Promise.resolve(
      [...this.#aggregates.values()].map((aggregate) =>
        cloneOrder(aggregate.order)
      )
    );
  }

  saveOrderAggregate(
    aggregate: OrderAggregate,
    idempotencyKey: string
  ): Promise<OrderAggregate> {
    const cloned = cloneAggregate(aggregate);
    this.#aggregates.set(cloned.order.id, cloned);
    this.#orderIdempotency.set(idempotencyKey, cloned.order.id);

    return Promise.resolve(cloneAggregate(cloned));
  }

  saveOrderTransaction(
    transaction: OrderTransactionRecord,
    idempotencyKey: string
  ): Promise<OrderTransactionRecord> {
    const existingId = this.#transactionIdempotency.get(idempotencyKey);

    if (existingId) {
      const existing = this.#aggregates
        .get(transaction.orderId)
        ?.transactions.find((candidate) => candidate.id === existingId);

      if (existing) {
        return Promise.resolve({
          ...existing,
          createdAt: cloneDate(existing.createdAt),
        });
      }
    }

    const aggregate = this.#aggregates.get(transaction.orderId);

    if (!aggregate) {
      return Promise.reject(
        new Error(`Order "${transaction.orderId}" was not found.`)
      );
    }

    aggregate.transactions = [...aggregate.transactions, transaction];
    this.#transactionIdempotency.set(idempotencyKey, transaction.id);

    return Promise.resolve({
      ...transaction,
      createdAt: cloneDate(transaction.createdAt),
    });
  }

  saveStateTransition(
    transition: OrderStateTransitionRecord,
    idempotencyKey: string
  ): Promise<OrderStateTransitionRecord> {
    const aggregate = this.#aggregates.get(transition.orderId);

    if (!aggregate) {
      return Promise.reject(
        new Error(`Order "${transition.orderId}" was not found.`)
      );
    }

    if (!this.#transitionIdempotency.has(idempotencyKey)) {
      aggregate.stateTransitions = [...aggregate.stateTransitions, transition];
      this.#transitionIdempotency.set(idempotencyKey, transition);
    }

    return Promise.resolve({
      ...transition,
      changedAt: cloneDate(transition.changedAt),
      metadata: { ...transition.metadata },
    });
  }

  updateOrder(order: OrderRecord): Promise<OrderRecord> {
    const aggregate = this.#aggregates.get(order.id);

    if (!aggregate) {
      return Promise.reject(new Error(`Order "${order.id}" was not found.`));
    }

    aggregate.order = cloneOrder(order);

    return Promise.resolve(cloneOrder(order));
  }

  reset(): void {
    this.#aggregates.clear();
    this.#orderIdempotency.clear();
    this.#transactionIdempotency.clear();
    this.#transitionIdempotency.clear();
  }
}

export interface ResettableOrderRepository extends OrderRepository {
  reset(): void;
}

export const createInMemoryOrderRepository = (): OrderRepository =>
  new InMemoryOrderRepository();

export const createResettableInMemoryOrderRepository =
  (): ResettableOrderRepository => new InMemoryOrderRepository();

export const defaultOrderRepository = createInMemoryOrderRepository();

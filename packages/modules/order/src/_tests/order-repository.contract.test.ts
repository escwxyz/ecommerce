import { Database, type SQLQueryBindings } from "bun:sqlite";
import { afterEach, describe, expect, it } from "bun:test";

import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";

import { createD1OrderRepository } from "../adapters/d1";
import {
  createOrderId,
  createOrderLineItemId,
  createOrderTransactionId,
  orderMigration,
  type OrderAggregate,
  type OrderDatabase,
  type OrderRepository,
  type OrderStateTransitionRecord,
  type OrderTransactionRecord,
} from "../domain";
import { createInMemoryOrderRepository } from "../repositories";

const now = new Date("2026-01-01T00:00:00.000Z");
const orderId = createOrderId("ord_contract");

const createAggregate = (): OrderAggregate => ({
  lineItems: [
    {
      createdAt: now,
      id: createOrderLineItemId("ordli_contract"),
      itemSnapshot: {
        productId: "prod_contract",
        productTitle: "Contract product",
        variantId: "variant_contract",
        variantTitle: "Default",
      },
      metadata: {},
      orderId,
      quantity: 1,
      taxTotal: 100,
      title: "Contract product",
      total: 1200,
      unitPrice: 1200,
      updatedAt: now,
    },
  ],
  operations: [],
  order: {
    billingAddress: null,
    cartId: "cart_contract",
    completedAt: null,
    createdAt: now,
    currencyCode: "USD",
    customerId: "cust_contract",
    email: "ada@example.com",
    fulfillmentReferences: [],
    id: orderId,
    metadata: {},
    paymentReferences: [
      {
        amount: 1300,
        currencyCode: "USD",
        paymentId: "pay_contract",
        status: "authorized",
      },
    ],
    shippingAddress: null,
    status: "placed",
    totals: {
      adjustmentTotal: 0,
      currencyCode: "USD",
      discountTotal: 0,
      giftCardTotal: 0,
      itemSubtotal: 1200,
      shippingTotal: 0,
      subtotal: 1200,
      taxTotal: 100,
      total: 1300,
    },
    updatedAt: now,
  },
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
});

const createTransaction = (): OrderTransactionRecord => ({
  amount: 1300,
  createdAt: now,
  currencyCode: "USD",
  id: createOrderTransactionId("ordtxn_contract"),
  metadata: {},
  orderId,
  referenceId: "pay_contract",
  type: "payment",
  updatedAt: now,
});

const createTransition = (): OrderStateTransitionRecord => ({
  changedAt: new Date("2026-01-02T00:00:00.000Z"),
  fromStatus: "placed",
  metadata: {},
  orderId,
  toStatus: "completed",
});

interface RepositoryTestContext {
  readonly cleanup?: () => void;
  readonly repository: OrderRepository;
}

const runOrderRepositoryContract = (
  name: string,
  createContext: () => Promise<RepositoryTestContext> | RepositoryTestContext
) => {
  describe(name, () => {
    let cleanup: (() => void) | undefined;

    afterEach(() => {
      cleanup?.();
      cleanup = undefined;
    });

    const setup = async () => {
      const context = await createContext();
      cleanup = context.cleanup;
      return context.repository;
    };

    it("persists and reads complete order aggregates", async () => {
      const repository = await setup();
      const aggregate = createAggregate();

      await expect(
        repository.saveOrderAggregate(aggregate, "order_contract")
      ).resolves.toEqual(aggregate);
      await expect(repository.findOrderById(orderId)).resolves.toEqual(
        aggregate.order
      );
      await expect(
        repository.findOrderByIdempotencyKey("order_contract")
      ).resolves.toEqual(aggregate.order);
      await expect(repository.getOrderAggregate(orderId)).resolves.toEqual(
        aggregate
      );
      await expect(repository.listOrders()).resolves.toEqual([aggregate.order]);
    });

    it("deduplicates aggregate, transaction, and transition writes", async () => {
      const repository = await setup();
      const aggregate = createAggregate();
      await repository.saveOrderAggregate(aggregate, "order_contract");

      const conflictingAggregate = {
        ...aggregate,
        order: { ...aggregate.order, email: "changed@example.com" },
      };
      await expect(
        repository.saveOrderAggregate(conflictingAggregate, "order_contract")
      ).resolves.toEqual(aggregate);

      const transaction = createTransaction();
      await expect(
        repository.saveOrderTransaction(transaction, "transaction_contract")
      ).resolves.toEqual(transaction);
      await expect(
        repository.saveOrderTransaction(
          { ...transaction, amount: 9999 },
          "transaction_contract"
        )
      ).resolves.toEqual(transaction);

      const transition = createTransition();
      await expect(
        repository.saveStateTransition(transition, "transition_contract")
      ).resolves.toEqual(transition);
      await expect(
        repository.saveStateTransition(
          { ...transition, toStatus: "canceled" },
          "transition_contract"
        )
      ).resolves.toEqual(transition);
      await expect(
        repository.findStateTransitionByIdempotencyKey("transition_contract")
      ).resolves.toEqual(transition);
    });

    it("updates the order record without replacing aggregate children", async () => {
      const repository = await setup();
      const aggregate = createAggregate();
      await repository.saveOrderAggregate(aggregate, "order_contract");

      const completedAt = new Date("2026-01-02T00:00:00.000Z");
      const updated = {
        ...aggregate.order,
        completedAt,
        status: "completed" as const,
        updatedAt: completedAt,
      };

      await expect(repository.updateOrder(updated)).resolves.toEqual(updated);
      await expect(
        repository.getOrderAggregate(orderId)
      ).resolves.toMatchObject({
        lineItems: aggregate.lineItems,
        order: updated,
      });
    });
  });
};

type FakeD1Binding = ConstructorParameters<typeof D1Dialect>[0]["database"];

class FakeD1PreparedStatement {
  readonly #query: string;
  readonly #sqlite: Database;
  readonly #values: readonly SQLQueryBindings[];

  constructor(
    sqlite: Database,
    query: string,
    values: readonly SQLQueryBindings[] = []
  ) {
    this.#query = query;
    this.#sqlite = sqlite;
    this.#values = values;
  }

  bind(...values: readonly SQLQueryBindings[]): FakeD1PreparedStatement {
    return new FakeD1PreparedStatement(this.#sqlite, this.#query, values);
  }

  all() {
    const normalizedQuery = this.#query.trim().toLowerCase();
    const statement = this.#sqlite.query(this.#query);

    if (
      normalizedQuery.startsWith("select") ||
      normalizedQuery.startsWith("pragma")
    ) {
      return Promise.resolve({
        meta: { changes: 0, last_row_id: 0 },
        results: statement.all(...this.#values),
        success: true,
      });
    }

    const result = statement.run(...this.#values);
    return Promise.resolve({
      meta: {
        changes: result.changes,
        last_row_id: Number(result.lastInsertRowid),
      },
      results: [],
      success: true,
    });
  }
}

const createFakeD1Binding = (sqlite: Database) => ({
  batch: async (statements: readonly FakeD1PreparedStatement[]) =>
    Promise.all(statements.map((statement) => statement.all())),
  exec: async (query: string) => {
    sqlite.exec(query);
    return { count: 0, duration: 0 };
  },
  prepare: (query: string) => new FakeD1PreparedStatement(sqlite, query),
});

const createD1OrderRepositoryContext = async (): Promise<RepositoryTestContext> => {
  const sqlite = new Database(":memory:");
  sqlite.exec("pragma foreign_keys = on");
  const db = new Kysely<OrderDatabase>({
    dialect: new D1Dialect({
      database: createFakeD1Binding(sqlite) as unknown as FakeD1Binding,
    }),
  });
  await orderMigration.up(db);

  return {
    cleanup: () => {
      db.destroy();
      sqlite.close();
    },
    repository: createD1OrderRepository({ db }),
  };
};

runOrderRepositoryContract("in-memory order repository", () => ({
  repository: createInMemoryOrderRepository(),
}));

runOrderRepositoryContract("D1 order repository", createD1OrderRepositoryContext);

describe("D1 order repository rollback safety", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  it("preserves an existing order when a conflicting aggregate insert fails", async () => {
    const context = await createD1OrderRepositoryContext();
    cleanup = context.cleanup;
    const repository = context.repository;
    const aggregate = createAggregate();

    await repository.saveOrderAggregate(aggregate, "order_contract");

    await expect(
      repository.saveOrderAggregate(
        {
          ...aggregate,
          order: {
            ...aggregate.order,
            email: "conflict@example.com",
          },
        },
        "order_contract_conflict"
      )
    ).rejects.toThrow();

    await expect(repository.getOrderAggregate(orderId)).resolves.toEqual(
      aggregate
    );
    await expect(repository.findOrderByIdempotencyKey("order_contract")).resolves.toEqual(
      aggregate.order
    );
  });
});

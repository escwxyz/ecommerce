import { afterAll, describe, expect, it } from "bun:test";

import {
  createRepositoryContractHarness,
  type RepositoryContractCase,
} from "@ecommerce/core/testing";
import {
  OrderRepositoryService,
  createOrderId,
  createOrderLineItemId,
  createOrderTransactionId,
} from "@ecommerce/order";
import type {
  OrderAggregate,
  OrderRepository,
  OrderStateTransitionRecord,
  OrderTransactionRecord,
} from "@ecommerce/order";
import { Effect, Exit, Layer, ManagedRuntime, Redacted } from "effect";

import {
  createPostgresClientLayer,
  createPostgresDrizzleLayer,
  createPostgresOrderRepositoryLayer,
  postgresAdapterTarget,
  resetPostgresDevelopmentDatabase,
  resetPostgresOrderTables,
  runPostgresMigrations,
  withPostgresOrderTransaction,
} from "../index";
import {
  createLocalPostgresRepositoryContractHarness,
  localPostgresContractUrlEnv,
} from "../repository-contract-harness";

const livePostgresUrl = process.env[localPostgresContractUrlEnv];
const describeLivePostgres = livePostgresUrl ? describe : describe.skip;

const now = new Date("2026-01-01T00:00:00.000Z");
const orderId = createOrderId("ord_postgres_contract");

const createAggregate = (): OrderAggregate => ({
  lineItems: [
    {
      createdAt: now,
      id: createOrderLineItemId("ordli_postgres_contract"),
      itemSnapshot: {
        productId: "prod_postgres_contract",
        productTitle: "Postgres contract product",
        variantId: "variant_postgres_contract",
        variantTitle: "Default",
      },
      metadata: {},
      orderId,
      quantity: 1,
      taxTotal: 100,
      title: "Postgres contract product",
      total: 1200,
      unitPrice: 1200,
      updatedAt: now,
    },
  ],
  operations: [],
  order: {
    billingAddress: null,
    cartId: "cart_postgres_contract",
    completedAt: null,
    createdAt: now,
    currencyCode: "USD",
    customerId: "cust_postgres_contract",
    email: "ada@example.com",
    fulfillmentReferences: [],
    id: orderId,
    metadata: {},
    paymentReferences: [
      {
        amount: 1300,
        currencyCode: "USD",
        paymentId: "pay_postgres_contract",
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
  id: createOrderTransactionId("ordtxn_postgres_contract"),
  metadata: {},
  orderId,
  referenceId: "pay_postgres_contract",
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

const orderRepositoryContractCases: readonly RepositoryContractCase<OrderRepository>[] =
  [
    {
      name: "persists and reads complete order aggregates",
      run: OrderRepositoryService.use((repository) =>
        Effect.gen(function* persistsAndReadsCompleteOrderAggregate() {
          const aggregate = createAggregate();

          const saved = yield* repository.saveOrderAggregate(
            aggregate,
            "order_postgres_contract"
          );
          const byId = yield* repository.findOrderById(orderId);
          const byIdempotency = yield* repository.findOrderByIdempotencyKey(
            "order_postgres_contract"
          );
          const loaded = yield* repository.getOrderAggregate(orderId);
          const listed = yield* repository.listOrders;

          expect(saved).toEqual(aggregate);
          expect(byId).toEqual(aggregate.order);
          expect(byIdempotency).toEqual(aggregate.order);
          expect(loaded).toEqual(aggregate);
          expect(listed).toContainEqual(aggregate.order);
        })
      ),
    },
    {
      name: "deduplicates aggregate, transaction, and transition writes",
      run: OrderRepositoryService.use((repository) =>
        Effect.gen(function* deduplicatesIdempotentWrites() {
          const aggregate = createAggregate();
          yield* repository.saveOrderAggregate(
            aggregate,
            "order_postgres_contract"
          );

          const duplicate = yield* repository.saveOrderAggregate(
            {
              ...aggregate,
              order: { ...aggregate.order, email: "changed@example.com" },
            },
            "order_postgres_contract"
          );
          const transaction = createTransaction();
          const savedTransaction = yield* repository.saveOrderTransaction(
            transaction,
            "transaction_postgres_contract"
          );
          const duplicateTransaction = yield* repository.saveOrderTransaction(
            { ...transaction, amount: 9999 },
            "transaction_postgres_contract"
          );
          const transition = createTransition();
          const savedTransition = yield* repository.saveStateTransition(
            transition,
            "transition_postgres_contract"
          );
          const duplicateTransition = yield* repository.saveStateTransition(
            { ...transition, toStatus: "canceled" },
            "transition_postgres_contract"
          );

          expect(duplicate).toEqual(aggregate);
          expect(savedTransaction).toEqual(transaction);
          expect(duplicateTransaction).toEqual(transaction);
          expect(savedTransition).toEqual(transition);
          expect(duplicateTransition).toEqual(transition);
        })
      ),
    },
    {
      name: "updates the order record without replacing aggregate children",
      run: OrderRepositoryService.use((repository) =>
        Effect.gen(function* updatesOrderRecordOnly() {
          const aggregate = createAggregate();
          yield* repository.saveOrderAggregate(
            aggregate,
            "order_postgres_contract"
          );

          const completedAt = new Date("2026-01-02T00:00:00.000Z");
          const updated = {
            ...aggregate.order,
            completedAt,
            status: "completed" as const,
            updatedAt: completedAt,
          };
          const saved = yield* repository.updateOrder(updated);
          const loaded = yield* repository.getOrderAggregate(orderId);

          expect(saved).toEqual(updated);
          expect(loaded).toMatchObject({
            lineItems: aggregate.lineItems,
            order: updated,
          });
        })
      ),
    },
  ];

const createLiveDatabaseLayer = () =>
  createPostgresClientLayer({
    applicationName: "@ecommerce/db-postgres:order-repository",
    maxConnections: 2,
    url: Redacted.make(livePostgresUrl ?? "postgres://missing"),
  }).pipe((clientLayer) =>
    Layer.merge(
      clientLayer,
      createPostgresDrizzleLayer().pipe(Layer.provide(clientLayer))
    )
  );

describe("PostgreSQL order repository Layer", () => {
  it("constructs a repository Layer without opening a connection", () => {
    const harness = createRepositoryContractHarness({
      adapter: postgresAdapterTarget,
      layer: createPostgresOrderRepositoryLayer().pipe(
        Layer.provide(createLiveDatabaseLayer())
      ),
      repositoryName: "OrderRepository",
    });

    expect(harness.adapter).toBe(postgresAdapterTarget);
    expect(harness.repositoryName).toBe("OrderRepository");
    expect(Effect.isEffect(harness.runAll(orderRepositoryContractCases))).toBe(
      true
    );
  });

  it("skips the live contract harness when no PostgreSQL URL is configured", () => {
    const originalUrl = process.env[localPostgresContractUrlEnv];

    delete process.env[localPostgresContractUrlEnv];

    const result = createLocalPostgresRepositoryContractHarness({
      repositoryLayer: createPostgresOrderRepositoryLayer(),
      repositoryName: "OrderRepository",
      reset: resetPostgresOrderTables,
    });

    if (originalUrl) {
      process.env[localPostgresContractUrlEnv] = originalUrl;
    }

    expect(result).toEqual({
      _tag: "skipped",
      reason: "missing-postgres-url",
    });
  });
});

describeLivePostgres("PostgreSQL order repository Layer", () => {
  const liveDatabaseLayer = createLiveDatabaseLayer();
  const liveRepositoryLayer = createPostgresOrderRepositoryLayer().pipe(
    Layer.provide(liveDatabaseLayer)
  );
  const liveRuntime = ManagedRuntime.make(
    Layer.merge(liveDatabaseLayer, liveRepositoryLayer)
  );
  const liveHarness = createLocalPostgresRepositoryContractHarness({
    databaseUrl: livePostgresUrl,
    repositoryLayer: createPostgresOrderRepositoryLayer(),
    repositoryName: "OrderRepository",
    reset: resetPostgresOrderTables,
  });

  afterAll(async () => {
    await liveRuntime.dispose();
  });

  it("runs the order repository contract against local PostgreSQL", async () => {
    expect(liveHarness._tag).toBe("available");

    if (liveHarness._tag === "available") {
      await Effect.runPromise(
        liveHarness.harness.runAll(orderRepositoryContractCases)
      );
    }
  });

  it("rolls back order writes inside PostgreSQL transactions", async () => {
    await liveRuntime.runPromise(
      resetPostgresDevelopmentDatabase({
        allowDestructive: true,
      }).pipe(
        Effect.andThen(runPostgresMigrations()),
        Effect.provide(liveDatabaseLayer)
      )
    );

    const rollbackExit = await liveRuntime.runPromiseExit(
      withPostgresOrderTransaction(
        OrderRepositoryService.use((repository) =>
          repository
            .saveOrderAggregate(createAggregate(), "order_postgres_rollback")
            .pipe(Effect.andThen(Effect.fail("force-rollback")))
        )
      )
    );
    const loaded = await liveRuntime.runPromise(
      OrderRepositoryService.use((repository) =>
        repository.findOrderById(orderId)
      )
    );

    expect(Exit.isFailure(rollbackExit)).toBe(true);
    expect(loaded).toBeNull();
  });
});

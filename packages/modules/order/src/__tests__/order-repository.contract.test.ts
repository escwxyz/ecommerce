import { describe, expect, it } from "bun:test";

import { Effect } from "effect";

import {
  createOrderId,
  createOrderLineItemId,
  createOrderTransactionId,
  type OrderAggregate,
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

const runOrderRepositoryContract = (
  name: string,
  createRepository: () => OrderRepository
) => {
  describe(name, () => {
    it("persists and reads complete order aggregates", async () => {
      const repository = createRepository();
      const aggregate = createAggregate();

      await expect(
        Effect.runPromise(
          repository.saveOrderAggregate(aggregate, "order_contract")
        )
      ).resolves.toEqual(aggregate);
      await expect(
        Effect.runPromise(repository.findOrderById(orderId))
      ).resolves.toEqual(aggregate.order);
      await expect(
        Effect.runPromise(repository.findOrderByIdempotencyKey("order_contract"))
      ).resolves.toEqual(aggregate.order);
      await expect(
        Effect.runPromise(repository.getOrderAggregate(orderId))
      ).resolves.toEqual(aggregate);
      await expect(Effect.runPromise(repository.listOrders)).resolves.toEqual([
        aggregate.order,
      ]);
    });

    it("deduplicates aggregate, transaction, and transition writes", async () => {
      const repository = createRepository();
      const aggregate = createAggregate();
      await Effect.runPromise(
        repository.saveOrderAggregate(aggregate, "order_contract")
      );

      const conflictingAggregate = {
        ...aggregate,
        order: { ...aggregate.order, email: "changed@example.com" },
      };
      await expect(
        Effect.runPromise(
          repository.saveOrderAggregate(conflictingAggregate, "order_contract")
        )
      ).resolves.toEqual(aggregate);

      const transaction = createTransaction();
      await expect(
        Effect.runPromise(
          repository.saveOrderTransaction(transaction, "transaction_contract")
        )
      ).resolves.toEqual(transaction);
      await expect(
        Effect.runPromise(
          repository.saveOrderTransaction(
            { ...transaction, amount: 9999 },
            "transaction_contract"
          )
        )
      ).resolves.toEqual(transaction);

      const transition = createTransition();
      await expect(
        Effect.runPromise(
          repository.saveStateTransition(transition, "transition_contract")
        )
      ).resolves.toEqual(transition);
      await expect(
        Effect.runPromise(
          repository.saveStateTransition(
            { ...transition, toStatus: "canceled" },
            "transition_contract"
          )
        )
      ).resolves.toEqual(transition);
      await expect(
        Effect.runPromise(
          repository.findStateTransitionByIdempotencyKey("transition_contract")
        )
      ).resolves.toEqual(transition);
    });

    it("updates the order record without replacing aggregate children", async () => {
      const repository = createRepository();
      const aggregate = createAggregate();
      await Effect.runPromise(
        repository.saveOrderAggregate(aggregate, "order_contract")
      );

      const completedAt = new Date("2026-01-02T00:00:00.000Z");
      const updated = {
        ...aggregate.order,
        completedAt,
        status: "completed" as const,
        updatedAt: completedAt,
      };

      await expect(
        Effect.runPromise(repository.updateOrder(updated))
      ).resolves.toEqual(updated);
      await expect(
        Effect.runPromise(repository.getOrderAggregate(orderId))
      ).resolves.toMatchObject({
        lineItems: aggregate.lineItems,
        order: updated,
      });
    });
  });
};

runOrderRepositoryContract("in-memory order repository", () =>
  createInMemoryOrderRepository()
);

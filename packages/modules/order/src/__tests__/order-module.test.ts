import { describe, expect, it } from "bun:test";

import {
  createInMemoryOutbox,
  createInMemoryTransactionBoundary,
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";
import { Effect } from "effect";

import { OrderValidationFailure, createOrderId } from "../domain";
import { orderModule } from "../module";
import { createInMemoryOrderRepository } from "../repositories";
import {
  ORDER_PLACED_EVENT,
  ORDER_STATUS_TRANSITIONED_EVENT,
  createOrderService,
} from "../services";

const checkoutInput = {
  cartId: "cart_1",
  correlationId: "corr_1",
  email: "buyer@example.com",
  idempotencyKey: "order_create_1",
  lineItems: [
    {
      itemSnapshot: {
        productId: "prod_1",
        productTitle: "Linen Shirt",
        variantId: "variant_1",
        variantTitle: "Medium",
      },
      quantity: 2,
      title: "Linen Shirt",
      total: 5000,
      unitPrice: 2500,
    },
  ],
  paymentReferences: [
    {
      amount: 5000,
      currencyCode: "USD",
      paymentId: "pay_1",
      status: "authorized",
    },
  ],
  totals: {
    adjustmentTotal: 0,
    currencyCode: "usd",
    discountTotal: 0,
    giftCardTotal: 0,
    itemSubtotal: 5000,
    shippingTotal: 0,
    subtotal: 5000,
    taxTotal: 0,
    total: 5000,
  },
} as const;

describe("order module foundation", () => {
  it("creates orders from checkout snapshots through the Effect service contract", async () => {
    const outbox = createInMemoryOutbox();
    const service = createOrderService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator([
        "ord_1",
        "ordli_1",
        "evt_placed",
      ]),
      outboxWriter: outbox.writer,
      repository: createInMemoryOrderRepository(),
      transactionBoundary: createInMemoryTransactionBoundary({
        resources: [outbox],
      }),
    });

    const created = await Effect.runPromise(
      service.createOrderFromCheckout(checkoutInput)
    );

    expect(created.order).toMatchObject({
      cartId: "cart_1",
      currencyCode: "USD",
      email: "buyer@example.com",
      id: "ord_1",
      status: "placed",
    });
    expect(created.lineItems[0]?.itemSnapshot).toMatchObject({
      productId: "prod_1",
      variantId: "variant_1",
    });
    expect(created.order.paymentReferences[0]?.paymentId).toBe("pay_1");
    expect(outbox.records.map((record) => record.event)).toMatchObject([
      {
        name: ORDER_PLACED_EVENT,
        sourceModule: "order",
        subject: {
          id: "ord_1",
          type: "order",
        },
      },
    ]);
  });

  it("keeps stored snapshots isolated from returned aggregate mutations", async () => {
    const repository = createInMemoryOrderRepository();
    const outbox = createInMemoryOutbox();
    const service = createOrderService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator(["ord_1", "ordli_1", "evt_1"]),
      outboxWriter: outbox.writer,
      repository,
      transactionBoundary: createInMemoryTransactionBoundary({
        resources: [outbox],
      }),
    });

    const created = await Effect.runPromise(
      service.createOrderFromCheckout(checkoutInput)
    );
    const mutated = {
      ...created,
      lineItems: created.lineItems.map((item) => ({
        ...item,
        itemSnapshot: { ...item.itemSnapshot, productTitle: "Mutated" },
      })),
      order: {
        ...created.order,
        paymentReferences: created.order.paymentReferences.map((reference) => ({
          ...reference,
          status: "captured",
        })),
      },
    };

    expect(mutated.lineItems[0]?.itemSnapshot.productTitle).toBe("Mutated");

    const loaded = await Effect.runPromise(
      service.getOrder(createOrderId(created.order.id))
    );

    expect(loaded?.lineItems[0]?.itemSnapshot.productTitle).toBe("Linen Shirt");
    expect(loaded?.order.paymentReferences[0]?.status).toBe("authorized");
  });

  it("transitions order status and publishes state events", async () => {
    const outbox = createInMemoryOutbox();
    const service = createOrderService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator([
        "ord_1",
        "ordli_1",
        "evt_placed",
        "evt_transition",
      ]),
      outboxWriter: outbox.writer,
      repository: createInMemoryOrderRepository(),
      transactionBoundary: createInMemoryTransactionBoundary({
        resources: [outbox],
      }),
    });
    const created = await Effect.runPromise(
      service.createOrderFromCheckout(checkoutInput)
    );

    const transitioned = await Effect.runPromise(
      service.transitionStatus({
        correlationId: "corr_2",
        idempotencyKey: "transition_1",
        orderId: created.order.id,
        status: "completed",
      })
    );

    expect(transitioned.order.status).toBe("completed");
    expect(transitioned.stateTransitions).toHaveLength(2);
    expect(outbox.records.map((record) => record.event)).toMatchObject([
      { name: ORDER_PLACED_EVENT },
      { name: ORDER_STATUS_TRANSITIONED_EVENT },
    ]);
  });

  it("rejects conflicting transition idempotency reuse before mutating order state", async () => {
    const outbox = createInMemoryOutbox();
    const repository = createInMemoryOrderRepository();
    const service = createOrderService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator([
        "ord_1",
        "ordli_1",
        "evt_placed",
        "evt_transition",
      ]),
      outboxWriter: outbox.writer,
      repository,
      transactionBoundary: createInMemoryTransactionBoundary({
        resources: [outbox],
      }),
    });
    const created = await Effect.runPromise(
      service.createOrderFromCheckout(checkoutInput)
    );

    await Effect.runPromise(
      service.transitionStatus({
        correlationId: "corr_2",
        idempotencyKey: "transition_1",
        orderId: created.order.id,
        status: "completed",
      })
    );

    await expect(
      Effect.runPromise(
        service.transitionStatus({
          correlationId: "corr_3",
          idempotencyKey: "transition_1",
          orderId: created.order.id,
          status: "canceled",
        })
      )
    ).rejects.toBeInstanceOf(OrderValidationFailure);

    await expect(
      Effect.runPromise(service.getOrder(createOrderId(created.order.id)))
    ).resolves.toMatchObject({
      order: {
        status: "completed",
      },
      stateTransitions: [{ toStatus: "placed" }, { toStatus: "completed" }],
    });
    expect(outbox.records.map((record) => record.event)).toMatchObject([
      { name: ORDER_PLACED_EVENT },
      { name: ORDER_STATUS_TRANSITIONED_EVENT },
    ]);
  });

  it("exposes typed module contributions without legacy API fragments", () => {
    expect(orderModule.key).toBe("order");
    expect(orderModule.contributions?.apiFragments).toEqual([]);
    expect(orderModule.contributions?.adminSurfaces?.[0]?.label).toBe("Orders");
    expect(orderModule.contributions?.eventTypes).toContain(ORDER_PLACED_EVENT);
  });
});

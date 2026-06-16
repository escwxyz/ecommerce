import { describe, expect, it } from "bun:test";

import {
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";
import { call } from "@orpc/server";

import { orderContractRouter } from "../contracts";
import type { CreateOrderFromCheckoutInput } from "../domain";
import { createOrderId } from "../domain";
import { orderModule } from "../module";
import { createInMemoryOrderRepository } from "../repositories";
import { createOrderRouteFragment } from "../router";
import {
  createOrderService,
  ORDER_PLACED_EVENT,
  ORDER_STATUS_TRANSITIONED_EVENT,
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
  it("creates orders from checkout snapshots through the service contract", async () => {
    const published: unknown[] = [];
    const service = createOrderService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      eventPublisher: {
        publish: async (event) => {
          published.push(event);
        },
      },
      idGenerator: createSequenceIdGenerator([
        "ord_1",
        "ordli_1",
        "evt_placed",
      ]),
      repository: createInMemoryOrderRepository(),
    });

    const created = await service.createOrderFromCheckout(checkoutInput);

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
    expect(published).toMatchObject([
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

  it("keeps stored snapshots isolated from caller mutations", async () => {
    const repository = createInMemoryOrderRepository();
    const service = createOrderService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator(["ord_1", "ordli_1", "evt_1"]),
      repository,
    });
    const mutableInput: CreateOrderFromCheckoutInput = {
      ...checkoutInput,
      lineItems: checkoutInput.lineItems.map((item) => ({ ...item })),
      paymentReferences: checkoutInput.paymentReferences.map((reference) => ({
        ...reference,
      })),
    };

    const created = await service.createOrderFromCheckout(mutableInput);
    const mutableLineItem = mutableInput.lineItems[0];
    const mutablePaymentReference = mutableInput.paymentReferences?.[0];

    if (!mutableLineItem || !mutablePaymentReference) {
      throw new Error("Expected mutable checkout input fixtures.");
    }

    mutableLineItem.itemSnapshot.productTitle = "Mutated";
    mutablePaymentReference.status = "captured";

    const loaded = await service.getOrder(createOrderId(created.order.id));

    expect(loaded?.lineItems[0]?.itemSnapshot.productTitle).toBe("Linen Shirt");
    expect(loaded?.order.paymentReferences[0]?.status).toBe("authorized");
  });

  it("transitions order status and publishes state events", async () => {
    const published: unknown[] = [];
    const service = createOrderService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      eventPublisher: {
        publish: async (event) => {
          published.push(event);
        },
      },
      idGenerator: createSequenceIdGenerator([
        "ord_1",
        "ordli_1",
        "evt_placed",
        "evt_transition",
      ]),
      repository: createInMemoryOrderRepository(),
    });
    const created = await service.createOrderFromCheckout(checkoutInput);

    const transitioned = await service.transitionStatus({
      correlationId: "corr_2",
      idempotencyKey: "transition_1",
      orderId: created.order.id,
      status: "completed",
    });

    expect(transitioned.order.status).toBe("completed");
    expect(transitioned.stateTransitions).toHaveLength(2);
    expect(published).toMatchObject([
      { name: ORDER_PLACED_EVENT },
      { name: ORDER_STATUS_TRANSITIONED_EVENT },
    ]);
  });

  it("declares contract-first order route metadata", () => {
    expect(
      orderContractRouter.orderCreateFromCheckout["~orpc"].route.operationId
    ).toBe("orderCreateFromCheckout");
    expect(orderContractRouter.orderGet["~orpc"].route.tags).toEqual([
      "Orders",
    ]);
  });

  it("exposes typed module contributions", () => {
    expect(orderModule.key).toBe("order");
    expect(orderModule.contributions?.apiFragments?.[0]?.key).toBe(
      "module:order"
    );
    expect(orderModule.contributions?.adminSurfaces?.[0]?.label).toBe("Orders");
    expect(orderModule.contributions?.eventTypes).toContain(ORDER_PLACED_EVENT);
  });

  it("serializes order route responses through injected service options", async () => {
    const repository = createInMemoryOrderRepository();
    const fragment = createOrderRouteFragment({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator(["ord_1", "ordli_1", "evt_1"]),
      repository,
    });
    const aggregate = await call(
      fragment.router.orderCreateFromCheckout,
      checkoutInput,
      {
        context: {
          auth: {},
          authorization: {
            evaluatePermission: () => ({ allowed: true }),
          },
          session: {
            user: {},
          },
        },
      }
    );

    expect(aggregate.order.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(aggregate.order.id).toBe("ord_1");
  });
});

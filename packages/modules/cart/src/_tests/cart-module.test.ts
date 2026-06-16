import { describe, expect, it } from "bun:test";

import type {
  StatefulCoordinationRequest,
  StatefulCoordinationResult,
  StatefulCoordinator,
} from "@ecommerce/core/stateful";
import {
  createEventCollector,
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";
import { call } from "@orpc/server";

import {
  createCachedCartRepository,
  createInMemoryCartActiveCache,
  createVisitorCartScope,
} from "../cache";
import { cartContractRouter } from "../contracts";
import { createCartId } from "../domain";
import { cartModule } from "../module";
import { createResettableInMemoryCartRepository } from "../repositories";
import { createCartRouteFragment } from "../router";
import { createCartService } from "../services";

const createAllowedContext = () =>
  ({
    context: {
      auth: {},
      authorization: {
        evaluatePermission: () => ({ allowed: true as const }),
      },
      session: {
        user: {
          email: "ada@example.com",
          id: "user_1",
        },
      },
    },
  }) as const;

class RecordingCoordinator implements StatefulCoordinator {
  readonly requests: StatefulCoordinationRequest[] = [];

  coordinate<Input = unknown, Output = unknown>(
    request: StatefulCoordinationRequest<Input>
  ): Promise<StatefulCoordinationResult<Output>> {
    this.requests.push(request);

    return Promise.resolve({
      causationId: request.causationId,
      coordinatedAt: new Date("2026-01-01T00:00:00.000Z"),
      coordinatorKey: request.coordinatorKey,
      correlationId: request.correlationId,
      duplicate: false,
      idempotencyKey: request.idempotencyKey,
      operationName: request.operationName,
      output: undefined as Output,
      subject: request.subject,
      workflowRunId: request.workflowRunId,
    });
  }
}

describe("cart module foundation", () => {
  it("declares boundaries, dependencies, schema, events, permissions, workflow steps, and extension points", () => {
    expect(cartModule.key).toBe("cart");
    expect(cartModule.dependencies).toEqual([
      "customer",
      "fulfillment",
      "inventory",
      "payment",
      "pricing",
      "product",
      "promotion",
      "region-sales-channel",
      "store",
      "tax",
    ]);
    expect(cartModule.providedServices?.map(({ key }) => key)).toEqual([
      "cart-service",
    ]);
    expect(cartModule.schema?.tables).toEqual([
      "cart",
      "cart_line_item",
      "cart_adjustment",
    ]);
    expect(cartModule.contributions?.eventTypes).toContain(
      "cart.line-item-added"
    );
    expect(
      cartModule.contributions?.workflowSteps?.map((step) => step.name)
    ).toEqual(["cart.prepare-checkout"]);
  });

  it("creates and mutates a cart aggregate with idempotent line item metadata", async () => {
    const repository = createResettableInMemoryCartRepository();
    const eventCollector = createEventCollector();
    const coordinator = new RecordingCoordinator();
    const service = createCartService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      coordinator,
      eventPublisher: eventCollector.publisher,
      idGenerator: createSequenceIdGenerator([
        "cart_active",
        "evt_created",
        "clitem_hat",
        "evt_line",
        "cadj_discount",
        "evt_adjustment",
        "evt_totals",
      ]),
      repository,
    });

    const cart = await service.createCart({
      currencyCode: "usd",
      customerId: "cus_1",
      email: "ada@example.com",
      regionId: "reg_us",
      salesChannelId: "sc_web",
    });
    const firstAdd = await service.addLineItem({
      cartId: cart.id,
      correlationId: "cart_update_1",
      idempotencyKey: "line_key_1",
      productId: "prod_hat",
      quantity: 2,
      title: "Hat",
      unitPrice: 1200,
      variantId: "variant_hat_black",
    });
    const duplicateAdd = await service.addLineItem({
      cartId: cart.id,
      correlationId: "cart_update_1",
      idempotencyKey: "line_key_1",
      productId: "prod_hat",
      quantity: 2,
      title: "Hat",
      unitPrice: 1200,
      variantId: "variant_hat_black",
    });
    const adjusted = await service.applyAdjustment({
      amount: -300,
      cartId: cart.id,
      correlationId: "cart_adjust_1",
      idempotencyKey: "adjustment_key_1",
      source: "promotion",
      type: "promotion",
    });
    const totals = await service.updateTotals({
      cartId: cart.id,
      correlationId: "cart_totals_1",
      idempotencyKey: "totals_key_1",
      totals: {
        adjustmentTotal: -300,
        currencyCode: "usd",
        discountTotal: 300,
        giftCardTotal: 0,
        itemSubtotal: 2400,
        shippingTotal: 0,
        subtotal: 2400,
        taxTotal: 0,
        total: 2100,
      },
    });

    expect(cart.currencyCode).toBe("USD");
    expect(firstAdd.lineItems).toHaveLength(1);
    expect(duplicateAdd.lineItems).toHaveLength(1);
    expect(adjusted.adjustments).toHaveLength(1);
    expect(totals.cart.totals.total).toBe(2100);
    expect(
      coordinator.requests.map((request) => request.operationName)
    ).toContain("cart.addLineItem");
    expect(eventCollector.events.map((event) => event.name)).toEqual([
      "cart.created",
      "cart.line-item-added",
      "cart.adjustment-applied",
      "cart.totals-updated",
    ]);
  });

  it("rejects line-item adjustments for missing or different-cart line items", async () => {
    const repository = createResettableInMemoryCartRepository();
    const service = createCartService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator([
        "cart_a",
        "evt_cart_a",
        "cart_b",
        "evt_cart_b",
        "clitem_cart_b",
        "evt_line_cart_b",
        "cadj_missing",
        "evt_missing",
        "cadj_cross_cart",
        "evt_cross_cart",
      ]),
      repository,
    });
    const cartA = await service.createCart({ currencyCode: "USD" });
    const cartB = await service.createCart({ currencyCode: "USD" });
    const cartBLine = await service.addLineItem({
      cartId: cartB.id,
      correlationId: "cart_b_line",
      idempotencyKey: "cart_b_line",
      productId: "prod_hat",
      quantity: 1,
      title: "Hat",
      unitPrice: 1200,
      variantId: "variant_hat_black",
    });
    const lineItem = cartBLine.lineItems[0];

    if (!lineItem) {
      throw new Error("Expected cart B to have one line item.");
    }

    await expect(
      service.applyAdjustment({
        amount: -100,
        cartId: cartA.id,
        correlationId: "missing_line",
        idempotencyKey: "missing_line",
        lineItemId: "clitem_missing",
        source: "tax",
        type: "tax",
      })
    ).rejects.toThrow('Cart line item "clitem_missing" was not found.');

    await expect(
      service.applyAdjustment({
        amount: -100,
        cartId: cartA.id,
        correlationId: "cross_cart_line",
        idempotencyKey: "cross_cart_line",
        lineItemId: lineItem.id,
        source: "promotion",
        type: "promotion",
      })
    ).rejects.toThrow(`Cart line item "${lineItem.id}" was not found.`);
  });

  it("resets totals snapshot when changing cart currency", async () => {
    const repository = createResettableInMemoryCartRepository();
    const service = createCartService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator([
        "cart_currency",
        "evt_currency_created",
        "evt_currency_totals",
      ]),
      repository,
    });
    const cart = await service.createCart({ currencyCode: "USD" });
    await service.updateTotals({
      cartId: cart.id,
      correlationId: "cart_currency_totals",
      idempotencyKey: "cart_currency_totals",
      totals: {
        adjustmentTotal: -100,
        currencyCode: "USD",
        discountTotal: 100,
        giftCardTotal: 0,
        itemSubtotal: 1500,
        shippingTotal: 500,
        subtotal: 1500,
        taxTotal: 200,
        total: 2100,
      },
    });

    const updated = await service.setRegionChannel({
      cartId: cart.id,
      correlationId: "cart_currency_change",
      currencyCode: "eur",
      idempotencyKey: "cart_currency_change",
      regionId: "reg_eu",
    });

    expect(updated.cart.currencyCode).toBe("EUR");
    expect(updated.cart.totals).toEqual({
      adjustmentTotal: 0,
      currencyCode: "EUR",
      discountTotal: 0,
      giftCardTotal: 0,
      itemSubtotal: 0,
      shippingTotal: 0,
      subtotal: 0,
      taxTotal: 0,
      total: 0,
    });
  });

  it("exposes cart operations through shared API fragments", async () => {
    const repository = createResettableInMemoryCartRepository();
    const fragment = createCartRouteFragment({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator(["cart_api", "evt_api"]),
      repository,
    });
    const cart = await call(
      fragment.router.cartCreate,
      {
        currencyCode: "USD",
      },
      createAllowedContext()
    );

    expect(Object.keys(cartContractRouter)).toContain("cartCreate");
    expect(cart).toMatchObject({
      currencyCode: "USD",
      id: "cart_api",
      status: "active",
    });
  });

  it("allows anonymous visitor sessions to create and mutate carts", async () => {
    const projectionRepository = createResettableInMemoryCartRepository();
    const fragment = createCartRouteFragment({
      createServiceOptionsForContext: () => ({
        repository: createCachedCartRepository({
          cache: createInMemoryCartActiveCache(),
          projectionRepository,
          scope: createVisitorCartScope("visitor_1"),
        }),
      }),
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator([
        "cart_visitor",
        "evt_visitor_created",
        "clitem_visitor",
        "evt_visitor_line",
      ]),
    });
    const anonymousContext = {
      context: {
        auth: {},
        authorization: createAllowedContext().context.authorization,
        session: null,
      },
    } as const;
    const cart = await call(
      fragment.router.cartCreate,
      {
        currencyCode: "USD",
      },
      anonymousContext
    );

    const updated = await call(
      fragment.router.cartAddLineItem,
      {
        cartId: cart.id,
        correlationId: "visitor_line",
        idempotencyKey: "visitor_line",
        productId: "prod_hat",
        quantity: 1,
        title: "Hat",
        unitPrice: 1200,
        variantId: "variant_hat_black",
      },
      anonymousContext
    );

    expect(cart.id).toBe("cart_visitor");
    expect(updated.lineItems).toHaveLength(1);
    await expect(
      projectionRepository.getCartAggregate(createCartId(cart.id))
    ).resolves.toMatchObject({
      cart: {
        id: cart.id,
      },
      lineItems: [
        {
          id: "clitem_visitor",
        },
      ],
    });
  });
});

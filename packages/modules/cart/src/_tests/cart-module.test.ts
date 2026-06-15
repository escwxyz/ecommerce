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

import { cartContractRouter } from "../contracts";
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
});

import { describe, expect, it } from "bun:test";

import {
  createEventCollector,
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";
import { Effect } from "effect";

import { CartLineItemNotFound, createCartLineItemId } from "../domain";
import { createResettableInMemoryCartRepository } from "../repositories";
import { createCartService } from "../services";

describe("cart Effect service", () => {
  it("creates and mutates a cart aggregate with idempotent line item metadata", async () => {
    const eventCollector = createEventCollector();
    const service = createCartService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
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
      repository: createResettableInMemoryCartRepository(),
    });

    const cart = await Effect.runPromise(
      service.createCart({
        currencyCode: "usd",
        customerId: "cus_1",
        email: "ada@example.com",
        regionId: "reg_us",
        salesChannelId: "sc_web",
      })
    );
    const firstAdd = await Effect.runPromise(
      service.addLineItem({
        cartId: cart.id,
        correlationId: "cart_update_1",
        idempotencyKey: "line_key_1",
        productId: "prod_hat",
        quantity: 2,
        title: "Hat",
        unitPrice: 1200,
        variantId: "variant_hat_black",
      })
    );
    const duplicateAdd = await Effect.runPromise(
      service.addLineItem({
        cartId: cart.id,
        correlationId: "cart_update_1",
        idempotencyKey: "line_key_1",
        productId: "prod_hat",
        quantity: 2,
        title: "Hat",
        unitPrice: 1200,
        variantId: "variant_hat_black",
      })
    );
    const adjusted = await Effect.runPromise(
      service.applyAdjustment({
        amount: -300,
        cartId: cart.id,
        correlationId: "cart_adjust_1",
        idempotencyKey: "adjustment_key_1",
        source: "promotion",
        type: "promotion",
      })
    );
    const totals = await Effect.runPromise(
      service.updateTotals({
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
      })
    );

    expect(cart.currencyCode).toBe("USD");
    expect(firstAdd.lineItems).toHaveLength(1);
    expect(duplicateAdd.lineItems).toHaveLength(1);
    expect(adjusted.adjustments).toHaveLength(1);
    expect(totals.cart.totals.total).toBe(2100);
    expect(eventCollector.events.map((event) => event.name)).toEqual([
      "cart.created",
      "cart.line-item-added",
      "cart.adjustment-applied",
      "cart.totals-updated",
    ]);
  });

  it("returns typed failures for missing line-item adjustments", async () => {
    const service = createCartService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator([
        "cart_a",
        "evt_cart_a",
        "cadj_missing",
      ]),
      repository: createResettableInMemoryCartRepository(),
    });
    const cart = await Effect.runPromise(
      service.createCart({ currencyCode: "USD" })
    );

    const result = await Effect.runPromiseExit(
      service.applyAdjustment({
        amount: -100,
        cartId: cart.id,
        correlationId: "missing_line",
        idempotencyKey: "missing_line",
        lineItemId: createCartLineItemId("clitem_missing"),
        source: "tax",
        type: "tax",
      })
    );

    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      expect(String(result.cause)).toContain(CartLineItemNotFound.name);
    }
  });
});

import { describe, expect, it } from "bun:test";

import { createStaticClock } from "@ecommerce/core/testing";

import { createCartId, createCartLineItemId, type CartRecord } from "../domain";
import { createResettableInMemoryCartRepository } from "../repositories";

const clock = createStaticClock(new Date("2026-01-01T00:00:00.000Z"));

const createCart = (): CartRecord => ({
  billingAddress: null,
  completedAt: null,
  createdAt: clock.now(),
  currencyCode: "USD",
  customerId: null,
  email: null,
  id: createCartId("cart_repo"),
  metadata: {},
  paymentCollectionId: null,
  regionId: null,
  salesChannelId: null,
  shippingAddress: null,
  shippingOptionId: null,
  status: "active",
  totals: {
    adjustmentTotal: 0,
    currencyCode: "USD",
    discountTotal: 0,
    giftCardTotal: 0,
    itemSubtotal: 0,
    shippingTotal: 0,
    subtotal: 0,
    taxTotal: 0,
    total: 0,
  },
  updatedAt: clock.now(),
});

describe("cart repository contract", () => {
  it("persists cart aggregates and replays line item idempotency keys", async () => {
    const repository = createResettableInMemoryCartRepository();
    const cart = await repository.saveCart(createCart());
    const lineItem = {
      cartId: cart.id,
      createdAt: clock.now(),
      id: createCartLineItemId("clitem_repo"),
      metadata: {},
      productId: "prod_1",
      quantity: 1,
      title: "Test item",
      unitPrice: 1000,
      updatedAt: clock.now(),
      variantId: "variant_1",
    };

    await repository.saveLineItem(lineItem, "line_item_key");
    const duplicate = await repository.saveLineItem(
      {
        ...lineItem,
        id: createCartLineItemId("clitem_duplicate"),
        quantity: 2,
      },
      "line_item_key"
    );
    const aggregate = await repository.getCartAggregate(cart.id);

    expect(duplicate.id).toBe(lineItem.id);
    expect(aggregate?.cart.id).toBe(cart.id);
    expect(aggregate?.lineItems).toHaveLength(1);
  });
});

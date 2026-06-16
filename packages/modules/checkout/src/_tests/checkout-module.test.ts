import { describe, expect, it } from "bun:test";

import { createEventCollector } from "@ecommerce/core/testing";

import { checkoutAdminMetadata } from "../admin";
import { checkoutModule } from "../module";
import {
  CHECKOUT_COMPLETED_EVENT,
  CHECKOUT_FAILED_EVENT,
  createCheckoutService,
} from "../services";

const checkoutInput = {
  cartId: "cart_1",
  correlationId: "corr_1",
  idempotencyKey: "checkout_1",
  payment: {
    capture: true,
    providerKey: "test-payments",
  },
  shippingOptionId: "shipopt_1",
};

const createDependencyStubs = (calls: string[]) => {
  const cartAggregate = {
    adjustments: [],
    cart: {
      billingAddress: null,
      completedAt: null,
      createdAt: new Date("2026-06-16T10:00:00.000Z"),
      currencyCode: "USD",
      customerId: "cus_1",
      email: "ada@example.com",
      id: "cart_1",
      metadata: {},
      paymentCollectionId: null,
      regionId: "reg_1",
      salesChannelId: "sc_1",
      shippingAddress: {
        address1: "1 Main St",
        city: "New York",
        countryCode: "US",
        postalCode: "10001",
      },
      shippingOptionId: "shipopt_1",
      status: "active" as const,
      totals: {
        adjustmentTotal: 0,
        currencyCode: "USD",
        discountTotal: 100,
        giftCardTotal: 0,
        itemSubtotal: 1000,
        shippingTotal: 200,
        subtotal: 900,
        taxTotal: 90,
        total: 1190,
      },
      updatedAt: new Date("2026-06-16T10:00:00.000Z"),
    },
    lineItems: [
      {
        cartId: "cart_1",
        createdAt: new Date("2026-06-16T10:00:00.000Z"),
        id: "clitem_1",
        metadata: {
          inventoryItemId: "invitem_1",
          priceSetId: "pset_1",
          sku: "HAT-1",
          stockLocationId: "sloc_1",
          taxCategoryId: "taxcat_1",
        },
        productId: "prod_1",
        quantity: 1,
        title: "Hat",
        unitPrice: 1000,
        updatedAt: new Date("2026-06-16T10:00:00.000Z"),
        variantId: "variant_1",
      },
    ],
  };

  const cart = {
    getCart: async () => {
      calls.push("cart.getCart");
      return cartAggregate;
    },
    setCheckoutReferences: async () => {
      calls.push("cart.setCheckoutReferences");
      return cartAggregate;
    },
    updateTotals: async () => {
      calls.push("cart.updateTotals");
      return cartAggregate;
    },
  };
  const store = {
    getStoreDefaults: async () => {
      calls.push("store.getStoreDefaults");
      return {
        defaultCurrencyCode: "USD",
        defaultLocale: "en-US",
        defaultRegionId: "reg_1",
        defaultSalesChannelId: "sc_1",
        supportedCurrencyCodes: ["USD"],
        timezone: "UTC",
      };
    },
  };
  const customer = {
    getPaymentIdentity: async () => {
      calls.push("customer.getPaymentIdentity");
      return {
        customerId: "cus_1",
        email: "ada@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
        phone: undefined,
      };
    },
  };
  const product = {
    validateProductVariant: async () => {
      calls.push("product.validateProductVariant");
      return {
        productId: "prod_1",
        valid: true,
        variantId: "variant_1",
      };
    },
  };
  const region = {
    validateRegionConstraints: async () => {
      calls.push("region.validateRegionConstraints");
      return {
        allowed: true,
        reasons: [],
      };
    },
  };
  const salesChannel = {
    checkProductPublishability: async () => {
      calls.push("salesChannel.checkProductPublishability");
      return {
        publishable: true,
        reasons: [],
      };
    },
  };
  const pricing = {
    calculatePrice: async () => {
      calls.push("pricing.calculatePrice");
      return {
        amount: 1000,
        currencyCode: "USD",
        priceSetId: "pset_1",
        quantity: 1,
        subtotal: 1000,
        trace: {
          moneyAmountId: "money_1",
          ruleMatches: [],
          source: "base",
        },
      };
    },
  };
  const promotion = {
    calculateAdjustments: async () => {
      calls.push("promotion.calculateAdjustments");
      return {
        adjustments: [
          {
            amount: -100,
            lineItemId: "clitem_1",
            promotionId: "promo_1",
            source: "promotion",
            type: "promotion",
          },
        ],
        totalDiscount: 100,
      };
    },
  };
  const tax = {
    calculateTax: async () => {
      calls.push("tax.calculateTax");
      return {
        currencyCode: "USD",
        id: "taxcalc_1",
        lines: [
          {
            amount: 90,
            lineItemId: "clitem_1",
            rateId: "taxrate_1",
            taxableAmount: 900,
          },
        ],
        providerKey: "manual",
        regionId: "reg_1",
        totalTax: 90,
      };
    },
  };
  const inventory = {
    adjustInventory: async () => {
      calls.push("inventory.adjustInventory");
      return {
        adjustment: 1,
        createdAt: new Date("2026-06-16T10:00:00.000Z"),
        id: "iadj_1",
        idempotencyKey: "checkout_1:inventory:release:invitem_1",
        inventoryItemId: "invitem_1",
        reason: "checkout-compensation",
        stockLocationId: "stockloc_1",
      };
    },
    checkAvailability: async () => {
      calls.push("inventory.checkAvailability");
      return {
        availableQuantity: 10,
        inventoryItemId: "invitem_1",
        reservedQuantity: 0,
        scopedBy: {
          salesChannelId: "sc_1",
          stockLocationId: "sloc_1",
        },
        stockedQuantity: 10,
      };
    },
    reserveInventory: async () => {
      calls.push("inventory.reserveInventory");
      return {
        reservations: [
          {
            cartId: "cart_1",
            createdAt: new Date("2026-06-16T10:00:00.000Z"),
            expiresAt: null,
            id: "ires_1",
            idempotencyKey: "checkout_1:inventory:reserve:invitem_1",
            inventoryItemId: "invitem_1",
            quantity: 1,
            stockLocationId: "sloc_1",
            workflowRunId: "checkout_1",
          },
        ],
        status: "reserved",
      };
    },
  };
  const payment = {
    authorizePaymentSession: async () => {
      calls.push("payment.authorizePaymentSession");
      return {
        amount: 1190,
        collectionId: "paycol_1",
        createdAt: new Date("2026-06-16T10:00:00.000Z"),
        currencyCode: "USD",
        id: "pay_1",
        metadata: {},
        providerKey: "test-payments",
        providerPaymentIntentId: "pi_1",
        sessionId: "payses_1",
        status: "authorized",
        updatedAt: new Date("2026-06-16T10:00:00.000Z"),
      };
    },
    capturePayment: async () => {
      calls.push("payment.capturePayment");
      return {
        amount: 1190,
        createdAt: new Date("2026-06-16T10:00:00.000Z"),
        currencyCode: "USD",
        id: "paycap_1",
        idempotencyKey: "checkout_1:payment:capture",
        paymentId: "pay_1",
        status: "succeeded",
      };
    },
    createCollection: async () => {
      calls.push("payment.createCollection");
      return {
        amount: 1190,
        cartId: "cart_1",
        createdAt: new Date("2026-06-16T10:00:00.000Z"),
        currencyCode: "USD",
        id: "paycol_1",
        metadata: {},
        status: "pending",
        updatedAt: new Date("2026-06-16T10:00:00.000Z"),
      };
    },
    createSession: async () => {
      calls.push("payment.createSession");
      return {
        amount: 1190,
        collectionId: "paycol_1",
        createdAt: new Date("2026-06-16T10:00:00.000Z"),
        currencyCode: "USD",
        id: "payses_1",
        metadata: {},
        providerKey: "test-payments",
        status: "pending",
        updatedAt: new Date("2026-06-16T10:00:00.000Z"),
      };
    },
  };
  const fulfillment = {
    cancelFulfillment: async () => {
      calls.push("fulfillment.cancelFulfillment");
      return {
        createdAt: new Date("2026-06-16T10:00:00.000Z"),
        id: "fulf_1",
        idempotencyKey: "checkout_1:fulfillment:create",
        items: [],
        metadata: {},
        orderId: "ord_1",
        providerKey: "test-fulfillment",
        shippingOptionId: "shipopt_1",
        status: "canceled",
        updatedAt: new Date("2026-06-16T10:00:00.000Z"),
      };
    },
    createFulfillment: async () => {
      calls.push("fulfillment.createFulfillment");
      return {
        fulfillment: {
          createdAt: new Date("2026-06-16T10:00:00.000Z"),
          id: "fulf_1",
          idempotencyKey: "checkout_1:fulfillment:create",
          items: [{ lineItemId: "clitem_1", quantity: 1, sku: "HAT-1" }],
          metadata: {},
          orderId: "ord_1",
          providerKey: "test-fulfillment",
          shippingOptionId: "shipopt_1",
          status: "created",
          updatedAt: new Date("2026-06-16T10:00:00.000Z"),
        },
        shipments: [],
      };
    },
    listShippingOptions: async () => {
      calls.push("fulfillment.listShippingOptions");
      return [
        {
          createdAt: new Date("2026-06-16T10:00:00.000Z"),
          currencyCode: "USD",
          fulfillmentSetId: "fset_1",
          id: "shipopt_1",
          isEnabled: true,
          metadata: {},
          name: "Ground",
          priceAmount: 200,
          profileId: "shprof_1",
          providerKey: "test-fulfillment",
          providerServiceId: "ground",
          serviceZoneId: "fzone_1",
          updatedAt: new Date("2026-06-16T10:00:00.000Z"),
        },
      ];
    },
  };
  const order = {
    createOrderFromCheckout: async () => {
      calls.push("order.createOrderFromCheckout");
      return {
        lineItems: [],
        operations: [],
        order: {
          billingAddress: null,
          cartId: "cart_1",
          completedAt: null,
          createdAt: new Date("2026-06-16T10:00:00.000Z"),
          currencyCode: "USD",
          customerId: "cus_1",
          email: "ada@example.com",
          fulfillmentReferences: [],
          id: "ord_1",
          metadata: {},
          paymentReferences: [],
          shippingAddress: null,
          status: "placed",
          totals: cartAggregate.cart.totals,
          updatedAt: new Date("2026-06-16T10:00:00.000Z"),
        },
        stateTransitions: [],
        transactions: [],
      };
    },
  };
  const notificationEvent = {
    publishEvent: async (input: { readonly name: string }) => {
      calls.push(`notificationEvent.publishEvent:${input.name}`);
      return {};
    },
  };

  return {
    cart,
    customer,
    fulfillment,
    inventory,
    notificationEvent,
    order,
    payment,
    pricing,
    product,
    promotion,
    region,
    salesChannel,
    store,
    tax,
  };
};

describe("checkout workflow orchestration", () => {
  it("declares dependencies, workflow, events, API, admin metadata, and permissions", () => {
    expect(checkoutModule.key).toBe("checkout");
    expect(checkoutModule.dependencies).toEqual([
      "store",
      "region-sales-channel",
      "product",
      "pricing",
      "promotion",
      "tax",
      "inventory",
      "customer",
      "cart",
      "payment",
      "fulfillment",
      "order",
      "notification-event",
    ]);
    expect(checkoutModule.contributions?.eventTypes).toEqual([
      CHECKOUT_COMPLETED_EVENT,
      CHECKOUT_FAILED_EVENT,
    ]);
    expect(checkoutModule.contributions?.workflows?.[0]?.key).toBe(
      "checkout.complete"
    );
    expect(checkoutModule.contributions?.apiFragments?.[0]?.key).toBe(
      "module:checkout"
    );
    expect(checkoutAdminMetadata.surfaces[0]?.operations?.complete?.key).toBe(
      "checkoutComplete"
    );
  });

  it("coordinates checkout through public service contracts with stable idempotency keys", async () => {
    const calls: string[] = [];
    const eventCollector = createEventCollector();
    const service = createCheckoutService({
      ...createDependencyStubs(calls),
      eventPublisher: eventCollector.publisher,
    });

    const result = await service.completeCheckout(checkoutInput);

    expect(result.status).toBe("completed");
    expect(result.orderId).toBe("ord_1");
    expect(result.paymentId).toBe("pay_1");
    expect(result.fulfillmentIds).toEqual(["fulf_1"]);
    expect(calls).toEqual([
      "cart.getCart",
      "store.getStoreDefaults",
      "customer.getPaymentIdentity",
      "product.validateProductVariant",
      "salesChannel.checkProductPublishability",
      "region.validateRegionConstraints",
      "pricing.calculatePrice",
      "promotion.calculateAdjustments",
      "tax.calculateTax",
      "fulfillment.listShippingOptions",
      "cart.updateTotals",
      "inventory.checkAvailability",
      "inventory.reserveInventory",
      "payment.createCollection",
      "payment.createSession",
      "cart.setCheckoutReferences",
      "payment.authorizePaymentSession",
      "order.createOrderFromCheckout",
      "fulfillment.createFulfillment",
      "payment.capturePayment",
      `notificationEvent.publishEvent:${CHECKOUT_COMPLETED_EVENT}`,
    ]);
    expect(eventCollector.events.map((event) => event.name)).toEqual([
      CHECKOUT_COMPLETED_EVENT,
    ]);
  });

  it("deduplicates checkout completion by idempotency key", async () => {
    const calls: string[] = [];
    const service = createCheckoutService(createDependencyStubs(calls));

    await service.completeCheckout(checkoutInput);
    const duplicate = await service.completeCheckout(checkoutInput);

    expect(duplicate.status).toBe("completed");
    expect(
      calls.filter((call) => call === "order.createOrderFromCheckout")
    ).toHaveLength(1);
  });

  it("passes the selected stock location to inventory reservations", async () => {
    const calls: string[] = [];
    const dependencies = createDependencyStubs(calls);
    const reserveInputs: Record<string, unknown>[] = [];
    const service = createCheckoutService({
      ...dependencies,
      inventory: {
        ...dependencies.inventory,
        checkAvailability: async () => {
          calls.push("inventory.checkAvailability");
          return {
            availableQuantity: 10,
            inventoryItemId: "invitem_1",
            reservedQuantity: 0,
            scopedBy: {
              salesChannelId: "sc_1",
              stockLocationId: "sloc_1",
            },
            stockedQuantity: 10,
          };
        },
        reserveInventory: async (input) => {
          calls.push("inventory.reserveInventory");
          reserveInputs.push(input);

          if (input.stockLocationId !== "sloc_1") {
            throw new Error("stockLocationId is required");
          }

          return {
            reservation: {
              inventoryItemId: "invitem_1",
              quantity: 1,
              stockLocationId: "sloc_1",
            },
          };
        },
      },
    });

    await service.completeCheckout(checkoutInput);

    expect(reserveInputs[0]?.stockLocationId).toBe("sloc_1");
  });

  it("compensates inventory and emits a failed event when order creation fails after reservation", async () => {
    const calls: string[] = [];
    const eventCollector = createEventCollector();
    const dependencies = createDependencyStubs(calls);
    const service = createCheckoutService({
      ...dependencies,
      eventPublisher: eventCollector.publisher,
      order: {
        createOrderFromCheckout: async () => {
          calls.push("order.createOrderFromCheckout");
          throw new Error("order unavailable");
        },
      },
    });

    await expect(service.completeCheckout(checkoutInput)).rejects.toThrow(
      "order unavailable"
    );

    expect(calls).toContain("inventory.adjustInventory");
    expect(eventCollector.events.map((event) => event.name)).toEqual([
      CHECKOUT_FAILED_EVENT,
    ]);
  });

  it("does not capture payment before later fallible checkout steps complete", async () => {
    const calls: string[] = [];
    const dependencies = createDependencyStubs(calls);
    const service = createCheckoutService({
      ...dependencies,
      order: {
        createOrderFromCheckout: async () => {
          calls.push("order.createOrderFromCheckout");
          throw new Error("order unavailable");
        },
      },
    });

    await expect(service.completeCheckout(checkoutInput)).rejects.toThrow(
      "order unavailable"
    );

    expect(calls).toContain("payment.authorizePaymentSession");
    expect(calls).not.toContain("payment.capturePayment");
  });
});

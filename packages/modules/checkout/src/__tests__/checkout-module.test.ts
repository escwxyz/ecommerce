import { describe, expect, it } from "bun:test";

import { CartService } from "@ecommerce/cart";
import { clockLayer, idGeneratorLayer } from "@ecommerce/core";
import { CustomerService } from "@ecommerce/customer";
import { FulfillmentService } from "@ecommerce/fulfillment";
import { InventoryService } from "@ecommerce/inventory";
import type { InventoryServiceShape } from "@ecommerce/inventory";
import { NotificationEventService } from "@ecommerce/notification-event";
import type { NotificationEventServiceShape } from "@ecommerce/notification-event";
import { OrderService } from "@ecommerce/order";
import type { OrderServiceShape } from "@ecommerce/order";
import { PaymentService } from "@ecommerce/payment";
import type { PaymentServiceShape } from "@ecommerce/payment";
import { PricingService } from "@ecommerce/pricing";
import { ProductService } from "@ecommerce/product";
import { PromotionService } from "@ecommerce/promotion";
import {
  RegionService,
  SalesChannelService,
} from "@ecommerce/region-sales-channel";
import { StoreService } from "@ecommerce/store";
import { TaxService } from "@ecommerce/tax";
import type { TaxServiceShape } from "@ecommerce/tax";
import { Context, Deferred, Effect, Fiber, Layer } from "effect";

import { checkoutAdminMetadata } from "../admin";
import { CheckoutCompletionFailure } from "../domain";
import { checkoutModule } from "../module";
import {
  CHECKOUT_COMPLETED_EVENT,
  CHECKOUT_FAILED_EVENT,
  CheckoutService,
  CheckoutServiceLive,
  createCheckoutCompletionStoreLayer,
  type CheckoutCompletionClaim,
  type CheckoutCompletionStoreShape,
} from "../services";
import { createInMemoryCheckoutCompletionStore } from "../testing";

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

const partialMockLayer = <Identifier, Service extends object>(
  tag: Context.Key<Identifier, Service>,
  implementation: object
) =>
  // Layer.mock supplies fail-loudly methods outside each focused fixture.
  Layer.mock(tag, implementation as never);

const timestamp = new Date("2026-06-16T10:00:00.000Z");
const baseTotals = {
  adjustmentTotal: 0,
  currencyCode: "USD",
  discountTotal: 100,
  giftCardTotal: 0,
  itemSubtotal: 1000,
  shippingTotal: 200,
  subtotal: 900,
  taxTotal: 90,
  total: 1190,
};
const cartAggregate = {
  adjustments: [],
  cart: {
    billingAddress: null,
    completedAt: null,
    createdAt: timestamp,
    currencyCode: "USD",
    customerId: "cust_1",
    email: "ada@example.com",
    id: "cart_1",
    metadata: { taxRegionId: "txreg_1" },
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
    status: "active",
    totals: baseTotals,
    updatedAt: timestamp,
  },
  lineItems: [
    {
      cartId: "cart_1",
      createdAt: timestamp,
      id: "clitem_1",
      metadata: {
        inventoryItemId: "iitem_1",
        priceSetId: "pset_1",
        sku: "HAT-1",
        stockLocationId: "sloc_1",
        taxCategoryId: "txcat_1",
      },
      productId: "prod_1",
      quantity: 1,
      title: "Hat",
      unitPrice: 1000,
      updatedAt: timestamp,
      variantId: "variant_1",
    },
  ],
};

interface TestOverrides {
  readonly completionStore?: CheckoutCompletionStoreShape;
  readonly completionEventFailures?: number;
  readonly lineItems?: readonly (typeof cartAggregate.lineItems)[number][];
  readonly orderFailure?: string;
  readonly priceSubtotals?: readonly number[];
  readonly pricingRelease?: Deferred.Deferred<void>;
  readonly priceSubtotal?: number;
  readonly pricingStarted?: Deferred.Deferred<void>;
  readonly promotionDiscount?: number;
  readonly withoutShippingAddress?: boolean;
}

const createCheckoutTestLayer = (
  calls: string[],
  overrides: TestOverrides = {}
) => {
  const publishedEvents: string[] = [];
  const completionEventInputs: Parameters<
    NotificationEventServiceShape["publishEvent"]
  >[0][] = [];
  const inventoryReservationInputs: unknown[] = [];
  const orderInputs: unknown[] = [];
  const paymentCancellationInputs: Parameters<
    PaymentServiceShape["cancelPayment"]
  >[0][] = [];
  const taxInputs: Parameters<TaxServiceShape["calculateTax"]>[0][] = [];
  let remainingCompletionEventFailures = overrides.completionEventFailures ?? 0;
  const priceSubtotal = overrides.priceSubtotal ?? 1000;
  let priceCalculationIndex = 0;
  const cart = {
    getCart: () =>
      Effect.sync(() => {
        calls.push("cart.getCart");
        return {
          ...cartAggregate,
          cart: {
            ...cartAggregate.cart,
            shippingAddress: overrides.withoutShippingAddress
              ? null
              : cartAggregate.cart.shippingAddress,
          },
          lineItems: overrides.lineItems ?? cartAggregate.lineItems,
        };
      }),
    setCheckoutReferences: () =>
      Effect.sync(() => {
        calls.push("cart.setCheckoutReferences");
        return cartAggregate;
      }),
    updateTotals: () =>
      Effect.sync(() => {
        calls.push("cart.updateTotals");
        return cartAggregate;
      }),
  };
  const customer = {
    getPaymentIdentity: () =>
      Effect.sync(() => {
        calls.push("customer.getPaymentIdentity");
        return null;
      }),
  };
  const fulfillment = {
    cancelFulfillment: () =>
      Effect.sync(() => {
        calls.push("fulfillment.cancelFulfillment");
        return { id: "fulf_1" };
      }),
    createFulfillment: () =>
      Effect.sync(() => {
        calls.push("fulfillment.createFulfillment");
        return {
          fulfillment: { id: "fulf_1" },
          shipments: [],
        };
      }),
    listShippingOptions: () =>
      Effect.sync(() => {
        calls.push("fulfillment.listShippingOptions");
        return [
          {
            id: "shipopt_1",
            isEnabled: true,
            priceAmount: 200,
          },
        ];
      }),
  };
  const inventory = {
    adjustInventory: () =>
      Effect.sync(() => {
        calls.push("inventory.adjustInventory");
        return {};
      }),
    checkAvailability: () =>
      Effect.sync(() => {
        calls.push("inventory.checkAvailability");
        return {
          availableQuantity: 10,
          scopedBy: { stockLocationId: "sloc_1" },
        };
      }),
    reserveInventory: (
      input: Parameters<InventoryServiceShape["reserveInventory"]>[0]
    ) =>
      Effect.sync(() => {
        calls.push("inventory.reserveInventory");
        inventoryReservationInputs.push(input);
        return {
          reservation: {
            inventoryItemId: input.inventoryItemId,
            quantity: input.quantity,
            stockLocationId: input.stockLocationId,
          },
        };
      }),
  };
  const notificationEvent = {
    publishEvent: (
      input: Parameters<NotificationEventServiceShape["publishEvent"]>[0]
    ) =>
      Effect.suspend(() => {
        calls.push(`notificationEvent.publishEvent:${input.name}`);
        if (input.name === CHECKOUT_COMPLETED_EVENT) {
          completionEventInputs.push(input);
        }
        if (
          remainingCompletionEventFailures > 0 &&
          input.name === CHECKOUT_COMPLETED_EVENT
        ) {
          remainingCompletionEventFailures -= 1;
          return Effect.die(new Error("completion event unavailable"));
        }
        publishedEvents.push(input.name);
        return Effect.succeed({});
      }),
  };
  const order = {
    createOrderFromCheckout: (
      input: Parameters<OrderServiceShape["createOrderFromCheckout"]>[0]
    ) =>
      Effect.suspend(() => {
        calls.push("order.createOrderFromCheckout");
        orderInputs.push(input);
        return overrides.orderFailure
          ? Effect.fail({
              _tag: "OrderUnavailable",
              message: overrides.orderFailure,
              retryable: true,
            })
          : Effect.succeed({ order: { id: "ord_1" } });
      }),
  };
  const payment = {
    authorizePaymentSession: () =>
      Effect.sync(() => {
        calls.push("payment.authorizePaymentSession");
        return {
          id: "pay_1",
          providerKey: "test-payments",
          status: "authorized",
        };
      }),
    cancelPayment: (
      input: Parameters<PaymentServiceShape["cancelPayment"]>[0]
    ) =>
      Effect.sync(() => {
        calls.push("payment.cancelPayment");
        paymentCancellationInputs.push(input);
        return {
          id: input.paymentId,
          providerKey: "test-payments",
          status: "canceled",
        };
      }),
    capturePayment: () =>
      Effect.sync(() => {
        calls.push("payment.capturePayment");
        return { status: "succeeded" };
      }),
    createCollection: () =>
      Effect.sync(() => {
        calls.push("payment.createCollection");
        return { id: "paycol_1" };
      }),
    createSession: () =>
      Effect.sync(() => {
        calls.push("payment.createSession");
        return { id: "payses_1" };
      }),
  };
  const pricing = {
    calculatePrice: () => {
      const calculatedSubtotal =
        overrides.priceSubtotals?.[priceCalculationIndex++] ?? priceSubtotal;

      return Effect.sync(() => calls.push("pricing.calculatePrice")).pipe(
        Effect.andThen(
          overrides.pricingStarted
            ? Deferred.succeed(overrides.pricingStarted, undefined).pipe(
                Effect.andThen(
                  overrides.pricingRelease
                    ? Deferred.await(overrides.pricingRelease).pipe(
                        Effect.as({ subtotal: calculatedSubtotal })
                      )
                    : Effect.never
                )
              )
            : Effect.succeed({ subtotal: calculatedSubtotal })
        )
      );
    },
  };
  const product = {
    validateProductVariant: () =>
      Effect.sync(() => {
        calls.push("product.validateProductVariant");
        return { valid: true };
      }),
  };
  const promotion = {
    calculateAdjustments: () =>
      Effect.sync(() => {
        calls.push("promotion.calculateAdjustments");
        return {
          totalDiscount:
            overrides.promotionDiscount ?? (overrides.priceSubtotal ? 0 : 100),
        };
      }),
  };
  const region = {
    validateRegionConstraints: () =>
      Effect.sync(() => {
        calls.push("region.validateRegionConstraints");
        return { allowed: true, reasons: [] };
      }),
  };
  const salesChannel = {
    checkProductPublishability: () =>
      Effect.sync(() => {
        calls.push("salesChannel.checkProductPublishability");
        return { publishable: true, reasons: [] };
      }),
  };
  const store = {
    getStoreDefaults: Effect.sync(() => {
      calls.push("store.getStoreDefaults");
      return {
        defaultCurrencyCode: "USD",
        defaultLocale: "en-US",
        defaultRegionId: "reg_1",
        defaultSalesChannelId: "sc_1",
        supportedCurrencyCodes: ["USD"],
        timezone: "UTC",
      };
    }),
  };
  const tax = {
    calculateTax: (input: Parameters<TaxServiceShape["calculateTax"]>[0]) =>
      Effect.sync(() => {
        calls.push("tax.calculateTax");
        taxInputs.push(input);
        return { totalTax: overrides.priceSubtotal ? 0 : 90 };
      }),
  };
  const dependencies = Layer.mergeAll(
    partialMockLayer(CartService, cart),
    partialMockLayer(CustomerService, customer),
    partialMockLayer(FulfillmentService, fulfillment),
    partialMockLayer(InventoryService, inventory),
    partialMockLayer(NotificationEventService, notificationEvent),
    partialMockLayer(OrderService, order),
    partialMockLayer(PaymentService, payment),
    partialMockLayer(PricingService, pricing),
    partialMockLayer(ProductService, product),
    partialMockLayer(PromotionService, promotion),
    partialMockLayer(RegionService, region),
    partialMockLayer(SalesChannelService, salesChannel),
    partialMockLayer(StoreService, store),
    partialMockLayer(TaxService, tax),
    clockLayer({ now: () => timestamp }),
    idGeneratorLayer({ nextId: () => "checkout-run-1" }),
    createCheckoutCompletionStoreLayer(
      overrides.completionStore ?? createInMemoryCheckoutCompletionStore()
    )
  );

  return {
    layer: CheckoutServiceLive.pipe(Layer.provide(dependencies)),
    inventoryReservationInputs,
    orderInputs,
    paymentCancellationInputs,
    publishedEvents,
    completionEventInputs,
    taxInputs,
  };
};

const runCheckout = (
  layer: ReturnType<typeof createCheckoutTestLayer>["layer"],
  input = checkoutInput
) =>
  Effect.runPromise(
    CheckoutService.use((service) => service.completeCheckout(input)).pipe(
      Effect.provide(layer)
    )
  );

describe("checkout workflow orchestration", () => {
  it("declares dependencies, workflow, events, API, admin metadata, and permissions", () => {
    expect(checkoutModule.key).toBe("checkout");
    expect(checkoutModule.dependencies).toContain("payment");
    expect(checkoutModule.dependencies).toContain("fulfillment");
    expect(checkoutModule.contributions?.eventTypes).toEqual([
      CHECKOUT_COMPLETED_EVENT,
      CHECKOUT_FAILED_EVENT,
    ]);
    expect(checkoutModule.contributions?.workflows?.[0]?.key).toBe(
      "checkout.complete"
    );
    expect(checkoutAdminMetadata.surfaces[0]?.operations?.complete?.key).toBe(
      "checkoutComplete"
    );
  });

  it("coordinates one Effect through public module service Layers", async () => {
    const calls: string[] = [];
    const testRuntime = createCheckoutTestLayer(calls);

    const result = await runCheckout(testRuntime.layer);

    expect(result).toMatchObject({
      fulfillmentIds: ["fulf_1"],
      orderId: "ord_1",
      paymentId: "pay_1",
      status: "completed",
    });
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
    expect(testRuntime.publishedEvents).toEqual([CHECKOUT_COMPLETED_EVENT]);
  });

  it("passes repriced line totals into the order snapshot", async () => {
    const testRuntime = createCheckoutTestLayer([], { priceSubtotal: 900 });

    await runCheckout(testRuntime.layer);

    expect(testRuntime.orderInputs[0]).toMatchObject({
      lineItems: [{ total: 900, unitPrice: 900 }],
      totals: { itemSubtotal: 900, total: 1100 },
    });
  });

  it("stores an integer unit price and explicit remainder for an inexact line total", async () => {
    const baseLineItem = cartAggregate.lineItems[0];
    if (!baseLineItem) {
      throw new Error("Checkout test fixture requires a cart line.");
    }
    const lineItem = { ...baseLineItem, quantity: 3 };
    const testRuntime = createCheckoutTestLayer([], {
      lineItems: [lineItem],
      priceSubtotal: 100,
    });

    await runCheckout(testRuntime.layer);

    expect(testRuntime.orderInputs[0]).toMatchObject({
      lineItems: [
        {
          metadata: { unitPriceRemainderMinorUnits: 1 },
          quantity: 3,
          total: 100,
          unitPrice: 33,
        },
      ],
    });
  });

  it("allocates a promotion discount across tax lines without changing line relationships", async () => {
    const firstLine = cartAggregate.lineItems[0];
    if (!firstLine) {
      throw new Error("Checkout test fixture requires a cart line.");
    }
    const secondLine = { ...firstLine, id: "clitem_2" };
    const testRuntime = createCheckoutTestLayer([], {
      lineItems: [firstLine, secondLine],
      priceSubtotals: [600, 400],
      promotionDiscount: -250,
    });

    await runCheckout(testRuntime.layer);

    expect(testRuntime.taxInputs).toMatchObject([
      {
        items: [
          { id: "clitem_1", quantity: 1, subtotal: 450 },
          { id: "clitem_2", quantity: 1, subtotal: 300 },
        ],
      },
    ]);
    expect(testRuntime.orderInputs[0]).toMatchObject({
      lineItems: [{ total: 600 }, { total: 400 }],
      totals: { discountTotal: 250, itemSubtotal: 1000, subtotal: 750 },
    });
  });

  it("rejects a missing shipping country instead of substituting a default", async () => {
    const calls: string[] = [];
    const testRuntime = createCheckoutTestLayer(calls, {
      withoutShippingAddress: true,
    });

    await expect(runCheckout(testRuntime.layer)).rejects.toMatchObject({
      _tag: "CheckoutCompletionFailure",
      message: 'Cart "cart_1" has no shipping country for tax calculation.',
    });
    expect(calls).not.toContain("tax.calculateTax");
  });

  it("derives inventory idempotency from each stable cart line", async () => {
    const firstLine = cartAggregate.lineItems[0];
    if (!firstLine) {
      throw new Error("Checkout test fixture requires a cart line.");
    }
    const secondLine = {
      ...firstLine,
      id: "clitem_2",
    };
    const testRuntime = createCheckoutTestLayer([], {
      lineItems: [firstLine, secondLine],
    });

    await runCheckout(testRuntime.layer);

    expect(testRuntime.inventoryReservationInputs).toMatchObject([
      { idempotencyKey: "checkout_1:inventory:reserve:clitem_1" },
      { idempotencyKey: "checkout_1:inventory:reserve:clitem_2" },
    ]);
  });

  it("deduplicates checkout completion at the Effect completion-store seam", async () => {
    const calls: string[] = [];
    const testRuntime = createCheckoutTestLayer(calls);

    const first = await runCheckout(testRuntime.layer);
    const duplicate = await runCheckout(testRuntime.layer);

    expect(duplicate).toEqual(first);
    expect(
      calls.filter((call) => call === "order.createOrderFromCheckout")
    ).toHaveLength(1);
  });

  it("releases only a pre-orchestration completion claim", async () => {
    const completionStore = createInMemoryCheckoutCompletionStore();
    const claim = await Effect.runPromise(
      completionStore.claim(checkoutInput, "workflow_claim-1")
    );

    expect(claim).toEqual({
      status: "pre-orchestration",
      workflowRunId: "workflow_claim-1",
    });
    await Effect.runPromise(
      completionStore.beginOrchestration(checkoutInput, "workflow_claim-1")
    );
    await Effect.runPromise(completionStore.release(checkoutInput));

    await expect(
      Effect.runPromise(
        completionStore.claim(checkoutInput, "workflow_claim-2")
      )
    ).rejects.toMatchObject({
      _tag: "CheckoutCompletionFailure",
      message: 'Checkout "checkout_1" is already running.',
      workflowRunId: "workflow_claim-1",
    });
  });

  it("atomically rejects a concurrent duplicate before provider work", async () => {
    const calls: string[] = [];
    const pricingStarted = Effect.runSync(Deferred.make<void>());
    const pricingRelease = Effect.runSync(Deferred.make<void>());
    const testRuntime = createCheckoutTestLayer(calls, {
      pricingRelease,
      pricingStarted,
    });
    const first = Effect.runFork(
      CheckoutService.use((service) =>
        service.completeCheckout(checkoutInput)
      ).pipe(Effect.provide(testRuntime.layer))
    );
    await Effect.runPromise(Deferred.await(pricingStarted));

    await expect(runCheckout(testRuntime.layer)).rejects.toMatchObject({
      _tag: "CheckoutCompletionFailure",
      message: 'Checkout "checkout_1" is already running.',
    });
    await Effect.runPromise(Deferred.succeed(pricingRelease, undefined));
    await Effect.runPromise(Fiber.join(first));

    expect(
      calls.filter((call) => call === "payment.createCollection")
    ).toHaveLength(1);
  });

  it("releases a claim when interrupted at the post-acquisition checkpoint", async () => {
    const calls: string[] = [];
    const claimAcquired = Effect.runSync(Deferred.make<void>());
    const completionStore = createInMemoryCheckoutCompletionStore();
    let orchestrationStarts = 0;
    const testRuntime = createCheckoutTestLayer(calls, {
      completionStore: {
        ...completionStore,
        beginOrchestration: (input, workflowRunId) =>
          Effect.sync(() => {
            orchestrationStarts += 1;
          }).pipe(
            Effect.andThen(
              completionStore.beginOrchestration(input, workflowRunId)
            )
          ),
        claim: (input, workflowRunId) =>
          completionStore
            .claim(input, workflowRunId)
            .pipe(Effect.tap(() => Deferred.succeed(claimAcquired, undefined))),
      },
    });
    const fiber = Effect.runFork(
      CheckoutService.use((service) =>
        service.completeCheckout(checkoutInput)
      ).pipe(Effect.provide(testRuntime.layer))
    );

    await Effect.runPromise(Deferred.await(claimAcquired));
    await Effect.runPromise(Fiber.interrupt(fiber));

    await expect(runCheckout(testRuntime.layer)).resolves.toMatchObject({
      status: "completed",
    });
    expect(
      calls.filter((call) => call === "payment.createCollection")
    ).toHaveLength(1);
    expect(orchestrationStarts).toBe(1);
  });

  it("releases the atomic claim when branded input decoding fails", async () => {
    const testRuntime = createCheckoutTestLayer([]);

    await expect(
      runCheckout(testRuntime.layer, { ...checkoutInput, cartId: "invalid" })
    ).rejects.toMatchObject({ _tag: "CheckoutCompletionFailure" });
    await expect(runCheckout(testRuntime.layer)).resolves.toMatchObject({
      status: "completed",
    });
  });

  it("recovers an uncertain claim without repeating commerce side effects", async () => {
    const calls: string[] = [];
    let storedClaim: CheckoutCompletionClaim | undefined;
    let completeAttempts = 0;
    let releaseCalls = 0;
    const testRuntime = createCheckoutTestLayer(calls, {
      completionStore: {
        claim: (_, workflowRunId) =>
          Effect.succeed(
            storedClaim ?? { status: "pre-orchestration", workflowRunId }
          ),
        beginOrchestration: () => Effect.void,
        complete: (_, result, completionEvent) =>
          Effect.suspend(() => {
            completeAttempts += 1;
            if (completeAttempts === 1) {
              return Effect.fail(
                new CheckoutCompletionFailure({
                  message: "completion store unavailable",
                  workflowRunId: "checkout_1",
                })
              );
            }
            storedClaim = {
              completionEvent,
              result,
              status: "completed",
            };
            return Effect.void;
          }),
        markUncertain: (_, result, completionEvent) =>
          Effect.sync(() => {
            storedClaim = {
              completionEvent,
              result,
              status: "uncertain",
            };
          }),
        markCompletionEventPersisted: () => Effect.void,
        release: () =>
          Effect.sync(() => {
            releaseCalls += 1;
          }),
      },
    });

    await expect(runCheckout(testRuntime.layer)).rejects.toMatchObject({
      _tag: "CheckoutCompletionFailure",
      message: "completion store unavailable",
    });
    await expect(runCheckout(testRuntime.layer)).resolves.toMatchObject({
      status: "completed",
    });
    expect(releaseCalls).toBe(0);
    expect(
      calls.filter((call) => call === "payment.createCollection")
    ).toHaveLength(1);
    expect(
      calls.filter((call) => call === "order.createOrderFromCheckout")
    ).toHaveLength(1);
    expect(testRuntime.publishedEvents).toEqual([CHECKOUT_COMPLETED_EVENT]);
    expect(testRuntime.completionEventInputs).toEqual([
      expect.objectContaining({
        eventId: "evt_checkout_completed_workflow_checkout-run-1",
        payload: expect.objectContaining({
          orderId: "ord_1",
          workflowRunId: "workflow_checkout-run-1",
        }),
      }),
    ]);
  });

  it("replays a pending completion event without repeating provider work", async () => {
    const calls: string[] = [];
    const testRuntime = createCheckoutTestLayer(calls, {
      completionEventFailures: 1,
    });

    await expect(
      runCheckout(testRuntime.layer, {
        ...checkoutInput,
        correlationId: "corr_original",
      })
    ).resolves.toMatchObject({ status: "completed" });
    await expect(
      runCheckout(testRuntime.layer, {
        ...checkoutInput,
        correlationId: "corr_retry",
      })
    ).resolves.toMatchObject({ status: "completed" });
    expect(
      calls.filter((call) => call === "payment.createCollection")
    ).toHaveLength(1);
    expect(
      calls.filter(
        (call) =>
          call === `notificationEvent.publishEvent:${CHECKOUT_COMPLETED_EVENT}`
      )
    ).toHaveLength(2);
    expect(testRuntime.publishedEvents).toEqual([CHECKOUT_COMPLETED_EVENT]);
    expect(testRuntime.completionEventInputs).toEqual([
      expect.objectContaining({
        correlationId: "corr_original",
        eventId: "evt_checkout_completed_workflow_checkout-run-1",
      }),
      expect.objectContaining({
        correlationId: "corr_original",
        eventId: "evt_checkout_completed_workflow_checkout-run-1",
      }),
    ]);
  });

  it("translates expected module failure and compensates completed inventory work", async () => {
    const calls: string[] = [];
    const testRuntime = createCheckoutTestLayer(calls, {
      orderFailure: "order unavailable",
    });

    await expect(runCheckout(testRuntime.layer)).rejects.toMatchObject({
      _tag: "CheckoutCompletionFailure",
      message: "order unavailable",
      retryable: true,
      sourceTag: "OrderUnavailable",
    });
    expect(calls).toContain("inventory.adjustInventory");
    expect(
      testRuntime.paymentCancellationInputs.map((input) => ({
        idempotencyKey: input.idempotencyKey,
        paymentId: String(input.paymentId),
      }))
    ).toEqual([
      {
        idempotencyKey: "checkout_1:payment:cancel-authorization",
        paymentId: "pay_1",
      },
    ]);
    expect(calls.indexOf("payment.cancelPayment")).toBeLessThan(
      calls.indexOf("inventory.adjustInventory")
    );
    expect(calls).not.toContain("payment.capturePayment");
    expect(testRuntime.publishedEvents).toEqual([CHECKOUT_FAILED_EVENT]);
  });

  it("stops downstream side effects when the checkout Effect is interrupted", async () => {
    const calls: string[] = [];
    const pricingStarted = Effect.runSync(Deferred.make<void>());
    const testRuntime = createCheckoutTestLayer(calls, { pricingStarted });
    const fiber = Effect.runFork(
      CheckoutService.use((service) =>
        service.completeCheckout(checkoutInput)
      ).pipe(Effect.provide(testRuntime.layer))
    );

    await Effect.runPromise(Deferred.await(pricingStarted));
    await Effect.runPromise(Fiber.interrupt(fiber));

    expect(calls).toContain("pricing.calculatePrice");
    expect(calls).not.toContain("payment.createCollection");
    expect(calls).not.toContain("order.createOrderFromCheckout");
  });
});

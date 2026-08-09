import { CartService, createCartIdEffect } from "@ecommerce/cart";
import type { CartServiceShape } from "@ecommerce/cart";
import {
  ClockService,
  IdGeneratorService,
  createCorrelationContext,
  operationOutcomeFromCause,
  withOperationTelemetry,
} from "@ecommerce/core";
import type {
  ClockServiceShape,
  IdGeneratorServiceShape,
} from "@ecommerce/core";
import { CustomerService, createCustomerIdEffect } from "@ecommerce/customer";
import type { CustomerServiceShape } from "@ecommerce/customer";
import {
  FulfillmentService,
  createShippingOptionIdEffect,
} from "@ecommerce/fulfillment";
import type {
  FulfillmentId,
  FulfillmentServiceShape,
} from "@ecommerce/fulfillment";
import {
  InventoryService,
  createInventoryItemIdEffect,
  createStockLocationIdEffect,
} from "@ecommerce/inventory";
import type {
  InventoryItemId,
  InventoryServiceShape,
  StockLocationId,
} from "@ecommerce/inventory";
import { NotificationEventService } from "@ecommerce/notification-event";
import type { NotificationEventServiceShape } from "@ecommerce/notification-event";
import { OrderService } from "@ecommerce/order";
import type { OrderServiceShape } from "@ecommerce/order";
import {
  PaymentService,
  createPaymentMethodIdEffect,
} from "@ecommerce/payment";
import type { PaymentServiceShape } from "@ecommerce/payment";
import { PricingService, createPriceSetIdEffect } from "@ecommerce/pricing";
import type { PricingServiceShape } from "@ecommerce/pricing";
import { ProductService, createProductIdEffect } from "@ecommerce/product";
import type { ProductServiceShape } from "@ecommerce/product";
import { PromotionService } from "@ecommerce/promotion";
import type { PromotionServiceShape } from "@ecommerce/promotion";
import {
  RegionService,
  SalesChannelService,
  createRegionIdEffect,
  createSalesChannelIdEffect,
} from "@ecommerce/region-sales-channel";
import type {
  RegionServiceShape,
  SalesChannelServiceShape,
} from "@ecommerce/region-sales-channel";
import { StoreService } from "@ecommerce/store";
import type { StoreServiceShape } from "@ecommerce/store";
import {
  TaxService,
  createTaxCategoryIdEffect,
  createTaxRegionIdEffect,
} from "@ecommerce/tax";
import type { TaxServiceShape } from "@ecommerce/tax";
import { Cause, Context, Effect, Exit, Layer, Ref } from "effect";
import type { Effect as EffectValue } from "effect/Effect";

import type {
  CheckoutCompletionResult,
  CheckoutExpectedError,
  CompleteCheckoutInput,
} from "../domain";
import { CheckoutCompletionFailure } from "../domain";

export const CHECKOUT_COMPLETED_EVENT = "checkout.completed" as const;
export const CHECKOUT_FAILED_EVENT = "checkout.failed" as const;

export interface CheckoutServiceShape {
  readonly completeCheckout: (
    input: CompleteCheckoutInput
  ) => EffectValue<CheckoutCompletionResult, CheckoutExpectedError>;
}

export type CheckoutCompletionClaim =
  | { readonly status: "acquired"; readonly workflowRunId: string }
  | {
      readonly completionEvent: CheckoutCompletionEvent;
      readonly result: CheckoutCompletionResult;
      readonly status: "completed";
    }
  | {
      readonly completionEvent: CheckoutCompletionEvent;
      readonly result: CheckoutCompletionResult;
      readonly status: "uncertain";
    };

/** Durable publication progress for Checkout's terminal completion event. */
export interface CheckoutCompletionEvent {
  readonly causationId?: string;
  readonly correlationId?: string;
  readonly eventId: string;
  readonly status: "pending" | "persisted";
}

/**
 * Persists Checkout's idempotency state. `complete` must atomically record the
 * terminal result with its pending completion-event record so a later retry can
 * replay durable outbox publication without replaying commerce side effects.
 */
export interface CheckoutCompletionStoreShape {
  readonly claim: (
    input: {
      readonly cartId: string;
      readonly idempotencyKey: string;
    },
    workflowRunId: string
  ) => EffectValue<CheckoutCompletionClaim, CheckoutExpectedError>;
  readonly complete: (
    input: {
      readonly cartId: string;
      readonly idempotencyKey: string;
    },
    result: CheckoutCompletionResult,
    completionEvent: CheckoutCompletionEvent
  ) => EffectValue<void, CheckoutExpectedError>;
  /**
   * Records that terminal completion persistence could not be confirmed after
   * commerce side effects completed. Adapters must retain this claim for
   * recovery instead of allowing a new checkout run to acquire the key.
   */
  readonly markUncertain: (
    input: {
      readonly cartId: string;
      readonly idempotencyKey: string;
    },
    result: CheckoutCompletionResult,
    completionEvent: CheckoutCompletionEvent
  ) => EffectValue<void, CheckoutExpectedError>;
  /** Marks the stable completion event as durably accepted by the event outbox. */
  readonly markCompletionEventPersisted: (
    input: {
      readonly cartId: string;
      readonly idempotencyKey: string;
    },
    eventId: string
  ) => EffectValue<void, CheckoutExpectedError>;
  readonly release: (input: {
    readonly cartId: string;
    readonly idempotencyKey: string;
  }) => EffectValue<void, CheckoutExpectedError>;
}

/** Checkout's durable idempotency seam; runtime adapters own its persistence. */
export const CheckoutCompletionStore =
  Context.Service<CheckoutCompletionStoreShape>(
    "@ecommerce/checkout/CheckoutCompletionStore"
  );

/** The single public checkout behavior consumed by transports and workflows. */
export const CheckoutService = Context.Service<CheckoutServiceShape>(
  "@ecommerce/checkout/CheckoutService"
);

interface CheckoutRunState {
  readonly fulfillmentIds: readonly FulfillmentId[];
  readonly inventoryReservations: readonly {
    readonly inventoryItemId: InventoryItemId;
    readonly quantity: number;
    readonly reservationKey: string;
    readonly stockLocationId: StockLocationId;
  }[];
}

const getMetadataString = (
  metadata: Readonly<Record<string, unknown>>,
  key: string
): string | undefined => {
  const value = metadata[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

const toCheckoutFailure = (
  error: unknown,
  workflowRunId: string
): CheckoutCompletionFailure => {
  if (error instanceof CheckoutCompletionFailure) {
    return error;
  }

  const taggedError =
    typeof error === "object" && error !== null && "_tag" in error
      ? String(error._tag)
      : undefined;
  const retryable =
    typeof error === "object" &&
    error !== null &&
    "retryable" in error &&
    typeof error.retryable === "boolean"
      ? error.retryable
      : undefined;
  const structuredMessage =
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
      ? error.message
      : undefined;
  const message =
    error instanceof Error && error.message.length > 0
      ? error.message
      : (structuredMessage ?? taggedError ?? String(error)) ||
        "Checkout dependency failed.";

  return new CheckoutCompletionFailure({
    message,
    retryable,
    sourceTag: taggedError,
    workflowRunId,
  });
};

const asCheckoutEffect = <Success, Failure, Requirements>(
  effect: EffectValue<Success, Failure, Requirements>,
  workflowRunId: string
): EffectValue<Success, CheckoutCompletionFailure, Requirements> => {
  const mapCheckoutFailure = (failure: Failure) =>
    toCheckoutFailure(failure, workflowRunId);

  return effect.pipe(Effect.mapError(mapCheckoutFailure));
};

const failCheckout = (
  message: string,
  workflowRunId: string
): EffectValue<never, CheckoutCompletionFailure> =>
  Effect.fail(new CheckoutCompletionFailure({ message, workflowRunId }));

const preserveCompensationProgress = <Success, Failure, Requirements>(
  effect: EffectValue<Success, Failure, Requirements>,
  operation: string
): EffectValue<void, never, Requirements> =>
  effect.pipe(
    Effect.asVoid,
    Effect.catchCause((cause) =>
      Effect.logWarning("checkout.compensation.failed", {
        cause: Cause.pretty(cause),
        operation,
      })
    )
  );

const buildMetadata = (
  input: CompleteCheckoutInput,
  workflowRunId: string
) => ({
  causationId: input.causationId,
  correlationId: input.correlationId,
  idempotencyKey: input.idempotencyKey,
  workflowRunId,
});

const createWorkflowRunId = (idGenerator: IdGeneratorServiceShape): string => {
  const id = idGenerator.nextId();
  return id.startsWith("workflow_") ? id : `workflow_${id}`;
};

const createCompletionEventId = (workflowRunId: string): string =>
  `evt_checkout_completed_${workflowRunId}`;

const allocateDiscountedLineSubtotals = <Line>(
  calculatedLines: readonly {
    readonly lineItem: Line;
    readonly subtotal: number;
  }[],
  totalDiscount: number
) => {
  const itemSubtotal = calculatedLines.reduce(
    (total, line) => total + Math.max(line.subtotal, 0),
    0
  );
  let remainingDiscount = Math.min(Math.abs(totalDiscount), itemSubtotal);
  let remainingSubtotal = itemSubtotal;

  return calculatedLines.map((line, index) => {
    const subtotal = Math.max(line.subtotal, 0);
    const isFinalLine = index === calculatedLines.length - 1;
    let lineDiscount = 0;
    if (isFinalLine) {
      lineDiscount = Math.min(remainingDiscount, subtotal);
    } else if (remainingSubtotal > 0) {
      lineDiscount = Math.min(
        subtotal,
        Math.floor((remainingDiscount * subtotal) / remainingSubtotal)
      );
    }

    remainingDiscount -= lineDiscount;
    remainingSubtotal -= subtotal;
    return { ...line, subtotal: subtotal - lineDiscount };
  });
};

const createCheckoutService = ({
  cart,
  clock,
  completionStore,
  customer,
  fulfillment,
  inventory,
  idGenerator,
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
}: {
  readonly cart: CartServiceShape;
  readonly clock: ClockServiceShape;
  readonly completionStore: CheckoutCompletionStoreShape;
  readonly customer: CustomerServiceShape;
  readonly fulfillment: FulfillmentServiceShape;
  readonly inventory: InventoryServiceShape;
  readonly idGenerator: IdGeneratorServiceShape;
  readonly notificationEvent: NotificationEventServiceShape;
  readonly order: OrderServiceShape;
  readonly payment: PaymentServiceShape;
  readonly pricing: PricingServiceShape;
  readonly product: ProductServiceShape;
  readonly promotion: PromotionServiceShape;
  readonly region: RegionServiceShape;
  readonly salesChannel: SalesChannelServiceShape;
  readonly store: StoreServiceShape;
  readonly tax: TaxServiceShape;
}): CheckoutServiceShape => {
  const publishEvent = (
    name: typeof CHECKOUT_COMPLETED_EVENT | typeof CHECKOUT_FAILED_EVENT,
    payload: unknown,
    metadata: {
      readonly cartId: string;
      readonly causationId?: string;
      readonly correlationId?: string;
    },
    workflowRunId: string,
    eventId?: string
  ) =>
    asCheckoutEffect(
      notificationEvent.publishEvent({
        causationId: metadata.causationId,
        correlationId: metadata.correlationId,
        ...(eventId ? { eventId } : {}),
        name,
        payload,
        sourceModule: "checkout",
        subject: { id: metadata.cartId, type: "cart" },
        workflowRunId,
      }),
      workflowRunId
    ).pipe(Effect.asVoid);

  const persistCompletionEvent = (
    input: CompleteCheckoutInput,
    completionEvent: CheckoutCompletionEvent,
    result: CheckoutCompletionResult
  ) =>
    publishEvent(
      CHECKOUT_COMPLETED_EVENT,
      result,
      {
        cartId: result.cartId,
        causationId: completionEvent.causationId,
        correlationId: completionEvent.correlationId,
      },
      result.workflowRunId,
      completionEvent.eventId
    ).pipe(
      Effect.andThen(
        completionStore.markCompletionEventPersisted(
          input,
          completionEvent.eventId
        )
      ),
      Effect.catchCause((cause) =>
        Effect.logError("checkout.completion-event.pending", {
          cause: Cause.pretty(cause),
          eventId: completionEvent.eventId,
          workflowRunId: result.workflowRunId,
        })
      )
    );

  return {
    completeCheckout: (input) => {
      const correlation = createCorrelationContext({
        causationId: input.causationId,
        correlationId: input.correlationId,
        requestId: input.correlationId ?? input.idempotencyKey,
      });

      return Effect.gen(function* completeCheckoutEffect() {
        const terminalPersistenceUncertain = yield* Ref.make(false);
        const proposedWorkflowRunId = createWorkflowRunId(idGenerator);
        const claim = yield* Effect.acquireRelease(
          completionStore.claim(input, proposedWorkflowRunId),
          (acquiredClaim, exit) => {
            if (acquiredClaim.status !== "acquired" || Exit.isSuccess(exit)) {
              return Effect.void;
            }

            return Ref.get(terminalPersistenceUncertain).pipe(
              Effect.flatMap((uncertain) =>
                uncertain
                  ? Effect.void
                  : preserveCompensationProgress(
                      completionStore.release(input),
                      "completion-store.release"
                    ).pipe(
                      Effect.annotateLogs({
                        idempotencyKey: input.idempotencyKey,
                        workflowRunId: acquiredClaim.workflowRunId,
                      })
                    )
              )
            );
          }
        );
        yield* Effect.yieldNow;

        if (claim.status === "completed") {
          yield* Effect.annotateCurrentSpan({
            "commerce.checkout.workflow_run_id": claim.result.workflowRunId,
          });
          if (claim.completionEvent.status === "pending") {
            yield* persistCompletionEvent(
              input,
              claim.completionEvent,
              claim.result
            );
          }
          return claim.result;
        }

        if (claim.status === "uncertain") {
          yield* Effect.annotateCurrentSpan({
            "commerce.checkout.workflow_run_id": claim.result.workflowRunId,
          });
          return yield* new CheckoutCompletionFailure({
            message: "Checkout completion persistence is uncertain.",
            retryable: true,
            sourceTag: "CheckoutCompletionUncertain",
            workflowRunId: claim.result.workflowRunId,
          });
        }

        const { workflowRunId } = claim;
        yield* Effect.annotateCurrentSpan({
          "commerce.checkout.workflow_run_id": workflowRunId,
        });
        const metadata = buildMetadata(input, workflowRunId);
        const state = yield* Ref.make<CheckoutRunState>({
          fulfillmentIds: [],
          inventoryReservations: [],
        });
        const program = Effect.gen(
          // oxlint-disable-next-line eslint/complexity -- the ordered commerce policy remains local to Checkout
          function* orchestrateCheckoutEffect() {
            const startedAt = clock.now();
            yield* Effect.annotateCurrentSpan({
              "commerce.checkout.started_at": startedAt.toISOString(),
              "commerce.checkout.workflow_run_id": workflowRunId,
            });
            const cartId = yield* asCheckoutEffect(
              createCartIdEffect(input.cartId),
              workflowRunId
            );
            const shippingOptionId = yield* asCheckoutEffect(
              createShippingOptionIdEffect(input.shippingOptionId),
              workflowRunId
            );
            const aggregate = yield* asCheckoutEffect(
              cart.getCart(cartId),
              workflowRunId
            );

            if (!aggregate) {
              return yield* failCheckout(
                `Cart "${input.cartId}" was not found.`,
                workflowRunId
              );
            }
            if (aggregate.cart.status !== "active") {
              return yield* failCheckout(
                `Cart "${input.cartId}" is not active.`,
                workflowRunId
              );
            }
            if (aggregate.lineItems.length === 0) {
              return yield* failCheckout(
                `Cart "${input.cartId}" has no line items.`,
                workflowRunId
              );
            }

            const defaults = yield* asCheckoutEffect(
              store.getStoreDefaults,
              workflowRunId
            );

            if (aggregate.cart.customerId) {
              const customerId = yield* asCheckoutEffect(
                createCustomerIdEffect(aggregate.cart.customerId),
                workflowRunId
              );
              yield* asCheckoutEffect(
                customer.getPaymentIdentity(customerId),
                workflowRunId
              );
            }

            const selectedSalesChannelId =
              aggregate.cart.salesChannelId ?? defaults.defaultSalesChannelId;
            const decodedSalesChannelId = selectedSalesChannelId
              ? yield* asCheckoutEffect(
                  createSalesChannelIdEffect(selectedSalesChannelId),
                  workflowRunId
                )
              : undefined;

            for (const lineItem of aggregate.lineItems) {
              const productId = yield* asCheckoutEffect(
                createProductIdEffect(lineItem.productId),
                workflowRunId
              );
              const variantValidation = yield* asCheckoutEffect(
                product.validateProductVariant({
                  productId,
                  variantId: lineItem.variantId,
                }),
                workflowRunId
              );

              if (!variantValidation.valid) {
                return yield* failCheckout(
                  `Product variant "${lineItem.variantId}" is not valid for checkout.`,
                  workflowRunId
                );
              }

              if (decodedSalesChannelId) {
                const publishability = yield* asCheckoutEffect(
                  salesChannel.checkProductPublishability({
                    productId: lineItem.productId,
                    salesChannelId: decodedSalesChannelId,
                  }),
                  workflowRunId
                );

                if (!publishability.publishable) {
                  return yield* failCheckout(
                    `Product "${lineItem.productId}" is not publishable for sales channel "${selectedSalesChannelId}".`,
                    workflowRunId
                  );
                }
              }
            }

            const selectedRegionId =
              aggregate.cart.regionId ?? defaults.defaultRegionId;
            if (!selectedRegionId) {
              return yield* failCheckout(
                `Cart "${input.cartId}" has no checkout region.`,
                workflowRunId
              );
            }
            const regionId = yield* asCheckoutEffect(
              createRegionIdEffect(selectedRegionId),
              workflowRunId
            );
            const regionValidation = yield* asCheckoutEffect(
              region.validateRegionConstraints({
                countryCode: aggregate.cart.shippingAddress?.countryCode,
                currencyCode: aggregate.cart.currencyCode,
                fulfillmentOptionId: input.shippingOptionId,
                paymentProviderId: input.payment.providerKey,
                regionId,
              }),
              workflowRunId
            );

            if (!regionValidation.allowed) {
              return yield* failCheckout(
                `Region constraints rejected checkout: ${regionValidation.reasons.join(", ")}.`,
                workflowRunId
              );
            }

            const calculatedLines: {
              readonly lineItem: (typeof aggregate.lineItems)[number];
              readonly subtotal: number;
            }[] = [];
            for (const lineItem of aggregate.lineItems) {
              const rawPriceSetId = getMetadataString(
                lineItem.metadata,
                "priceSetId"
              );
              if (!rawPriceSetId) {
                return yield* failCheckout(
                  `Line item "${lineItem.id}" is missing priceSetId.`,
                  workflowRunId
                );
              }
              const priceSetId = yield* asCheckoutEffect(
                createPriceSetIdEffect(rawPriceSetId),
                workflowRunId
              );
              const calculatedPrice = yield* asCheckoutEffect(
                pricing.calculatePrice({
                  context: {
                    ...(selectedSalesChannelId
                      ? { salesChannelId: selectedSalesChannelId }
                      : {}),
                    regionId: selectedRegionId,
                  },
                  currencyCode: aggregate.cart.currencyCode,
                  priceSetId,
                  quantity: lineItem.quantity,
                }),
                workflowRunId
              );
              calculatedLines.push({
                lineItem,
                subtotal: calculatedPrice.subtotal,
              });
            }

            const itemSubtotal = calculatedLines.reduce(
              (sum, calculated) => sum + calculated.subtotal,
              0
            );
            const promotionResult = yield* asCheckoutEffect(
              promotion.calculateAdjustments({
                cart: {
                  currencyCode: aggregate.cart.currencyCode,
                  id: aggregate.cart.id,
                  lines: calculatedLines.map(({ lineItem, subtotal }) => ({
                    id: lineItem.id,
                    quantity: lineItem.quantity,
                    subtotal,
                  })),
                  subtotal: itemSubtotal,
                },
                context: {},
              }),
              workflowRunId
            );
            const discountedLines = allocateDiscountedLineSubtotals(
              calculatedLines,
              promotionResult.totalDiscount
            );
            const discountedSubtotal = discountedLines.reduce(
              (sum, calculated) => sum + calculated.subtotal,
              0
            );
            const discountTotal = itemSubtotal - discountedSubtotal;
            const taxRegionValue = getMetadataString(
              aggregate.cart.metadata,
              "taxRegionId"
            );
            if (!taxRegionValue) {
              return yield* failCheckout(
                `Cart "${input.cartId}" is missing taxRegionId metadata.`,
                workflowRunId
              );
            }
            const taxRegionId = yield* asCheckoutEffect(
              createTaxRegionIdEffect(taxRegionValue),
              workflowRunId
            );
            const shippingCountryCode =
              aggregate.cart.shippingAddress?.countryCode;
            if (!shippingCountryCode) {
              return yield* failCheckout(
                `Cart "${input.cartId}" has no shipping country for tax calculation.`,
                workflowRunId
              );
            }
            // oxlint-disable unicorn/no-array-method-this-argument -- Effect.forEach is not Array.forEach
            const taxItems = yield* Effect.forEach(
              discountedLines,
              ({ lineItem, subtotal }) =>
                Effect.gen(function* createTaxLineEffect() {
                  const taxCategoryValue = getMetadataString(
                    lineItem.metadata,
                    "taxCategoryId"
                  );
                  const taxCategoryId = taxCategoryValue
                    ? yield* asCheckoutEffect(
                        createTaxCategoryIdEffect(taxCategoryValue),
                        workflowRunId
                      )
                    : undefined;

                  return {
                    id: lineItem.id,
                    quantity: lineItem.quantity,
                    subtotal: Math.max(subtotal, 0),
                    ...(taxCategoryId ? { taxCategoryId } : {}),
                  };
                })
            );
            // oxlint-enable unicorn/no-array-method-this-argument
            const [firstTaxItem, ...remainingTaxItems] = taxItems;
            if (!firstTaxItem) {
              return yield* failCheckout(
                `Cart "${input.cartId}" has no taxable line items.`,
                workflowRunId
              );
            }
            const taxResult = yield* asCheckoutEffect(
              tax.calculateTax({
                address: {
                  countryCode: shippingCountryCode,
                },
                currencyCode: aggregate.cart.currencyCode,
                items: [firstTaxItem, ...remainingTaxItems],
                policy: { pricesIncludeTax: false },
                regionId: taxRegionId,
              }),
              workflowRunId
            );
            const shippingOptions = yield* asCheckoutEffect(
              fulfillment.listShippingOptions({
                countryCode: aggregate.cart.shippingAddress?.countryCode,
                regionId: selectedRegionId,
                salesChannelId: selectedSalesChannelId ?? undefined,
              }),
              workflowRunId
            );
            const shippingOption = shippingOptions.find(
              (option) => option.id === shippingOptionId
            );
            if (!shippingOption || !shippingOption.isEnabled) {
              return yield* failCheckout(
                `Shipping option "${input.shippingOptionId}" is not available.`,
                workflowRunId
              );
            }

            const shippingTotal = shippingOption.priceAmount ?? 0;
            const totals = {
              adjustmentTotal: -discountTotal,
              currencyCode: aggregate.cart.currencyCode,
              discountTotal,
              giftCardTotal: aggregate.cart.totals.giftCardTotal,
              itemSubtotal,
              shippingTotal,
              subtotal: discountedSubtotal,
              taxTotal: taxResult.totalTax,
              total: discountedSubtotal + taxResult.totalTax + shippingTotal,
            };

            yield* asCheckoutEffect(
              cart.updateTotals({ ...metadata, cartId, totals }),
              workflowRunId
            );

            for (const lineItem of aggregate.lineItems) {
              const inventoryItemValue = getMetadataString(
                lineItem.metadata,
                "inventoryItemId"
              );
              if (!inventoryItemValue) {
                continue;
              }
              const inventoryItemId = yield* asCheckoutEffect(
                createInventoryItemIdEffect(inventoryItemValue),
                workflowRunId
              );
              const stockLocationValue = getMetadataString(
                lineItem.metadata,
                "stockLocationId"
              );
              const requestedStockLocationId = stockLocationValue
                ? yield* asCheckoutEffect(
                    createStockLocationIdEffect(stockLocationValue),
                    workflowRunId
                  )
                : undefined;
              const availability = yield* asCheckoutEffect(
                inventory.checkAvailability({
                  inventoryItemId,
                  salesChannelId: selectedSalesChannelId ?? undefined,
                  stockLocationId: requestedStockLocationId,
                }),
                workflowRunId
              );
              if (availability.availableQuantity < lineItem.quantity) {
                return yield* failCheckout(
                  `Insufficient inventory for line item "${lineItem.id}".`,
                  workflowRunId
                );
              }
              const stockLocationId =
                requestedStockLocationId ??
                availability.scopedBy.stockLocationId;
              if (!stockLocationId) {
                return yield* failCheckout(
                  `Line item "${lineItem.id}" requires a stock location for reservation.`,
                  workflowRunId
                );
              }
              const reservationResult = yield* asCheckoutEffect(
                inventory.reserveInventory({
                  ...metadata,
                  idempotencyKey: `${input.idempotencyKey}:inventory:reserve:${lineItem.id}`,
                  inventoryItemId,
                  quantity: lineItem.quantity,
                  salesChannelId: selectedSalesChannelId ?? undefined,
                  stockLocationId,
                }),
                workflowRunId
              );
              yield* Ref.update(state, (current) => ({
                ...current,
                inventoryReservations: [
                  ...current.inventoryReservations,
                  {
                    inventoryItemId:
                      reservationResult.reservation.inventoryItemId,
                    quantity: reservationResult.reservation.quantity,
                    reservationKey: lineItem.id,
                    stockLocationId:
                      reservationResult.reservation.stockLocationId,
                  },
                ],
              }));
            }

            const collection = yield* asCheckoutEffect(
              payment.createCollection({
                amount: totals.total,
                cartId: aggregate.cart.id,
                currencyCode: totals.currencyCode,
                metadata: input.metadata,
              }),
              workflowRunId
            );
            const session = yield* asCheckoutEffect(
              payment.createSession({
                collectionId: collection.id,
                idempotencyKey: `${input.idempotencyKey}:payment:session`,
                metadata: input.metadata,
                providerKey: input.payment.providerKey,
              }),
              workflowRunId
            );
            yield* asCheckoutEffect(
              cart.setCheckoutReferences({
                ...metadata,
                cartId,
                paymentCollectionId: collection.id,
                shippingOptionId,
              }),
              workflowRunId
            );
            const paymentMethodId = input.payment.paymentMethodId
              ? yield* asCheckoutEffect(
                  createPaymentMethodIdEffect(input.payment.paymentMethodId),
                  workflowRunId
                )
              : undefined;
            const authorizedPayment = yield* asCheckoutEffect(
              payment.authorizePaymentSession({
                idempotencyKey: `${input.idempotencyKey}:payment:authorize`,
                paymentMethodId,
                sessionId: session.id,
              }),
              workflowRunId
            );

            const toOrderLine = (
              calculated: (typeof calculatedLines)[number]
            ) => {
              const unitPrice = Math.round(
                calculated.subtotal / calculated.lineItem.quantity
              );
              const unitPriceRemainderMinorUnits =
                calculated.subtotal - unitPrice * calculated.lineItem.quantity;

              return {
                itemSnapshot: {
                  metadata: calculated.lineItem.metadata,
                  productId: calculated.lineItem.productId,
                  productTitle: calculated.lineItem.title,
                  sku: getMetadataString(calculated.lineItem.metadata, "sku"),
                  variantId: calculated.lineItem.variantId,
                  variantTitle: calculated.lineItem.title,
                },
                ...(unitPriceRemainderMinorUnits === 0
                  ? {}
                  : {
                      // The line total remains authoritative when equal unit pricing is inexact.
                      metadata: { unitPriceRemainderMinorUnits },
                    }),
                quantity: calculated.lineItem.quantity,
                title: calculated.lineItem.title,
                total: calculated.subtotal,
                unitPrice,
              };
            };
            const [firstCalculatedLine, ...remainingCalculatedLines] =
              calculatedLines;
            if (!firstCalculatedLine) {
              return yield* failCheckout(
                `Cart "${input.cartId}" has no priced line items.`,
                workflowRunId
              );
            }
            const orderAggregate = yield* asCheckoutEffect(
              order.createOrderFromCheckout({
                ...metadata,
                billingAddress: aggregate.cart.billingAddress,
                cartId: aggregate.cart.id,
                customerId: aggregate.cart.customerId ?? undefined,
                email: aggregate.cart.email ?? undefined,
                lineItems: [
                  toOrderLine(firstCalculatedLine),
                  ...remainingCalculatedLines.map(toOrderLine),
                ],
                metadata: input.metadata,
                paymentReferences: [
                  {
                    amount: totals.total,
                    currencyCode: totals.currencyCode,
                    paymentCollectionId: collection.id,
                    paymentId: authorizedPayment.id,
                    providerId: authorizedPayment.providerKey,
                    status: authorizedPayment.status,
                  },
                ],
                shippingAddress: aggregate.cart.shippingAddress,
                totals,
              }),
              workflowRunId
            );
            const fulfillmentDetail = yield* asCheckoutEffect(
              fulfillment.createFulfillment({
                address: aggregate.cart.shippingAddress
                  ? {
                      city: aggregate.cart.shippingAddress.city,
                      countryCode: aggregate.cart.shippingAddress.countryCode,
                      line1: aggregate.cart.shippingAddress.address1,
                      postalCode: aggregate.cart.shippingAddress.postalCode,
                      provinceCode: aggregate.cart.shippingAddress.province,
                    }
                  : undefined,
                idempotencyKey: `${input.idempotencyKey}:fulfillment:create`,
                items: aggregate.lineItems.map((lineItem) => ({
                  lineItemId: lineItem.id,
                  quantity: lineItem.quantity,
                  sku: getMetadataString(lineItem.metadata, "sku"),
                })),
                metadata: input.metadata,
                orderId: orderAggregate.order.id,
                shippingOptionId,
              }),
              workflowRunId
            );
            yield* Ref.update(state, (current) => ({
              ...current,
              fulfillmentIds: [
                ...current.fulfillmentIds,
                fulfillmentDetail.fulfillment.id,
              ],
            }));

            if (input.payment.capture) {
              yield* asCheckoutEffect(
                payment.capturePayment({
                  amount: totals.total,
                  idempotencyKey: `${input.idempotencyKey}:payment:capture`,
                  paymentId: authorizedPayment.id,
                }),
                workflowRunId
              );
            }

            const completedState = yield* Ref.get(state);
            const result: CheckoutCompletionResult = {
              cartId: aggregate.cart.id,
              fulfillmentIds: completedState.fulfillmentIds,
              orderId: orderAggregate.order.id,
              paymentId: authorizedPayment.id,
              status: "completed",
              workflowRunId,
            };
            const completionEvent: CheckoutCompletionEvent = {
              causationId: input.causationId,
              correlationId: input.correlationId,
              eventId: createCompletionEventId(workflowRunId),
              status: "pending",
            };
            yield* completionStore
              .complete(input, result, completionEvent)
              .pipe(
                Effect.catchCause((cause) =>
                  Effect.gen(function* markUncertainCompletionEffect() {
                    yield* Ref.set(terminalPersistenceUncertain, true);
                    yield* completionStore
                      .markUncertain(input, result, completionEvent)
                      .pipe(
                        Effect.catchCause((markCause) =>
                          Effect.logError(
                            "checkout.completion-persistence.uncertain-mark.failed",
                            {
                              cause: Cause.pretty(markCause),
                              workflowRunId,
                            }
                          )
                        )
                      );
                    return yield* Effect.failCause(cause);
                  })
                )
              );

            return { completionEvent, result };
          }
        );

        const compensatedProgram = program.pipe(
          Effect.onError((cause) =>
            Ref.get(terminalPersistenceUncertain).pipe(
              Effect.flatMap((uncertain) => {
                if (uncertain) {
                  return Effect.logWarning(
                    "checkout.completion-persistence.uncertain",
                    { workflowRunId }
                  );
                }

                return Ref.get(state).pipe(
                  Effect.flatMap((failedState) =>
                    Effect.all(
                      [
                        ...failedState.fulfillmentIds
                          .toReversed()
                          .map((fulfillmentId) =>
                            preserveCompensationProgress(
                              asCheckoutEffect(
                                fulfillment.cancelFulfillment({
                                  fulfillmentId,
                                  reason: "checkout-compensation",
                                }),
                                workflowRunId
                              ),
                              "fulfillment.cancel"
                            )
                          ),
                        ...failedState.inventoryReservations
                          .toReversed()
                          .map((reservation) =>
                            preserveCompensationProgress(
                              asCheckoutEffect(
                                inventory.adjustInventory({
                                  ...metadata,
                                  adjustment: reservation.quantity,
                                  idempotencyKey: `${input.idempotencyKey}:inventory:release:${reservation.reservationKey}`,
                                  inventoryItemId: reservation.inventoryItemId,
                                  reason: "restock",
                                  stockLocationId: reservation.stockLocationId,
                                }),
                                workflowRunId
                              ),
                              "inventory.release"
                            )
                          ),
                        preserveCompensationProgress(
                          (() => {
                            const squashedCause = Cause.squash(cause);
                            const checkoutFailure =
                              squashedCause instanceof CheckoutCompletionFailure
                                ? squashedCause
                                : undefined;

                            return publishEvent(
                              CHECKOUT_FAILED_EVENT,
                              {
                                cartId: input.cartId,
                                error: Cause.pretty(cause),
                                outcome: operationOutcomeFromCause(cause),
                                retryable: checkoutFailure?.retryable,
                                sourceTag: checkoutFailure?.sourceTag,
                                workflowRunId,
                              },
                              input,
                              workflowRunId
                            );
                          })(),
                          "event.publish-failed"
                        ),
                      ],
                      { concurrency: 1, discard: true }
                    )
                  )
                );
              }),
              Effect.catchCause(() => Effect.void)
            )
          )
        );

        const completed = yield* compensatedProgram;
        yield* persistCompletionEvent(
          input,
          completed.completionEvent,
          completed.result
        );
        return completed.result;
      }).pipe(Effect.scoped, (checkoutEffect) =>
        withOperationTelemetry(checkoutEffect, {
          attributes: {
            cartId: input.cartId,
            idempotencyKey: input.idempotencyKey,
          },
          correlation,
          name: "checkout.complete",
        })
      );
    },
  };
};

/** Builds Checkout from public module services supplied by runtime composition. */
export const CheckoutServiceLive = Layer.effect(
  CheckoutService,
  Effect.gen(function* createCheckoutServiceEffect() {
    return createCheckoutService({
      cart: yield* CartService,
      clock: yield* ClockService,
      completionStore: yield* CheckoutCompletionStore,
      customer: yield* CustomerService,
      fulfillment: yield* FulfillmentService,
      inventory: yield* InventoryService,
      idGenerator: yield* IdGeneratorService,
      notificationEvent: yield* NotificationEventService,
      order: yield* OrderService,
      payment: yield* PaymentService,
      pricing: yield* PricingService,
      product: yield* ProductService,
      promotion: yield* PromotionService,
      region: yield* RegionService,
      salesChannel: yield* SalesChannelService,
      store: yield* StoreService,
      tax: yield* TaxService,
    });
  })
);

export const createCheckoutServiceLayer = (service: CheckoutServiceShape) =>
  Layer.succeed(CheckoutService, service);

export const createCheckoutCompletionStoreLayer = (
  store: CheckoutCompletionStoreShape
) => Layer.succeed(CheckoutCompletionStore, store);

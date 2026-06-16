import type {
  EventPublisherServiceShape,
  IdGeneratorServiceShape,
} from "@ecommerce/core";
import { createEventEnvelope } from "@ecommerce/core/events";
import { Context, Layer } from "effect";

import type {
  CheckoutCompletionResult,
  CompleteCheckoutInput,
} from "../domain";

export const CHECKOUT_COMPLETED_EVENT = "checkout.completed" as const;
export const CHECKOUT_FAILED_EVENT = "checkout.failed" as const;

export interface CheckoutServiceShape {
  completeCheckout(
    input: CompleteCheckoutInput
  ): Promise<CheckoutCompletionResult>;
}

export const CheckoutService = Context.Service<CheckoutServiceShape>(
  "@ecommerce/checkout/CheckoutService"
);

export interface CheckoutServiceDependencies {
  readonly cart: CheckoutCartContract;
  readonly customer: CheckoutCustomerContract;
  readonly fulfillment: CheckoutFulfillmentContract;
  readonly inventory: CheckoutInventoryContract;
  readonly notificationEvent?: CheckoutNotificationEventContract;
  readonly order: CheckoutOrderContract;
  readonly payment: CheckoutPaymentContract;
  readonly pricing: CheckoutPricingContract;
  readonly product: CheckoutProductContract;
  readonly promotion: CheckoutPromotionContract;
  readonly region: CheckoutRegionContract;
  readonly salesChannel: CheckoutSalesChannelContract;
  readonly store: CheckoutStoreContract;
  readonly tax: CheckoutTaxContract;
}

export interface CreateCheckoutServiceOptions extends CheckoutServiceDependencies {
  readonly eventPublisher?: EventPublisherServiceShape;
  readonly idGenerator?: IdGeneratorServiceShape;
}

interface CheckoutRunState {
  readonly fulfillmentIds: string[];
  readonly inventoryReservations: {
    readonly inventoryItemId: string;
    readonly quantity: number;
    readonly stockLocationId: string;
  }[];
}

interface CheckoutCartAddress {
  readonly address1: string;
  readonly city: string;
  readonly countryCode: string;
  readonly postalCode: string;
  readonly address2?: string;
  readonly company?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly phone?: string;
  readonly province?: string;
}

interface CheckoutCartAggregate {
  readonly adjustments: readonly unknown[];
  readonly cart: {
    readonly billingAddress: CheckoutCartAddress | null;
    readonly completedAt: Date | null;
    readonly createdAt: Date;
    readonly currencyCode: string;
    readonly customerId: string | null;
    readonly email: string | null;
    readonly id: string;
    readonly metadata: Readonly<Record<string, unknown>>;
    readonly paymentCollectionId: string | null;
    readonly regionId: string | null;
    readonly salesChannelId: string | null;
    readonly shippingAddress: CheckoutCartAddress | null;
    readonly shippingOptionId: string | null;
    readonly status: "active" | "completed" | "canceled";
    readonly totals: CheckoutTotals;
    readonly updatedAt: Date;
  };
  readonly lineItems: readonly {
    readonly cartId: string;
    readonly createdAt: Date;
    readonly id: string;
    readonly metadata: Readonly<Record<string, unknown>>;
    readonly productId: string;
    readonly quantity: number;
    readonly title: string;
    readonly unitPrice: number;
    readonly updatedAt: Date;
    readonly variantId: string;
  }[];
}

interface CheckoutTotals {
  readonly adjustmentTotal: number;
  readonly currencyCode: string;
  readonly discountTotal: number;
  readonly giftCardTotal: number;
  readonly itemSubtotal: number;
  readonly shippingTotal: number;
  readonly subtotal: number;
  readonly taxTotal: number;
  readonly total: number;
}

interface CheckoutCartContract {
  getCart(id: string): Promise<CheckoutCartAggregate | null>;
  setCheckoutReferences(
    input: Record<string, unknown>
  ): Promise<CheckoutCartAggregate>;
  updateTotals(input: Record<string, unknown>): Promise<CheckoutCartAggregate>;
}

interface CheckoutCustomerContract {
  getPaymentIdentity(customerId: string): Promise<unknown>;
}

interface CheckoutFulfillmentContract {
  cancelFulfillment(input: Record<string, unknown>): Promise<unknown>;
  createFulfillment(input: Record<string, unknown>): Promise<{
    readonly fulfillment: { readonly id: string };
  }>;
  listShippingOptions(input?: Record<string, unknown>): Promise<
    readonly {
      readonly id: string;
      readonly isEnabled: boolean;
      readonly priceAmount?: number;
    }[]
  >;
}

interface CheckoutInventoryContract {
  adjustInventory(input: Record<string, unknown>): Promise<unknown>;
  checkAvailability(input: Record<string, unknown>): Promise<{
    readonly availableQuantity: number;
    readonly scopedBy?: {
      readonly stockLocationId?: string;
    };
  }>;
  reserveInventory(input: Record<string, unknown>): Promise<{
    readonly reservation?: {
      readonly inventoryItemId: string;
      readonly quantity: number;
      readonly stockLocationId: string;
    };
    readonly reservations?: readonly {
      readonly inventoryItemId: string;
      readonly quantity: number;
      readonly stockLocationId: string;
    }[];
  }>;
}

interface CheckoutNotificationEventContract {
  publishEvent(input: {
    readonly name: string;
    readonly payload: unknown;
    readonly sourceModule: string;
    readonly causationId?: string;
    readonly correlationId?: string;
    readonly subject?: { readonly id: string; readonly type: string };
    readonly workflowRunId?: string;
  }): Promise<unknown>;
}

interface CheckoutOrderContract {
  createOrderFromCheckout(input: Record<string, unknown>): Promise<{
    readonly order: { readonly id: string };
  }>;
}

interface CheckoutPaymentContract {
  authorizePaymentSession(input: Record<string, unknown>): Promise<{
    readonly id: string;
    readonly providerKey: string;
    readonly status: string;
  }>;
  capturePayment(
    input: Record<string, unknown>
  ): Promise<{ readonly status: string }>;
  createCollection(
    input: Record<string, unknown>
  ): Promise<{ readonly id: string }>;
  createSession(
    input: Record<string, unknown>
  ): Promise<{ readonly id: string }>;
}

interface CheckoutPricingContract {
  calculatePrice(input: Record<string, unknown>): Promise<{
    readonly subtotal: number;
  }>;
}

interface CheckoutProductContract {
  validateProductVariant(input: Record<string, unknown>): Promise<{
    readonly valid: boolean;
  }>;
}

interface CheckoutPromotionContract {
  calculateAdjustments(input: Record<string, unknown>): Promise<{
    readonly totalDiscount: number;
  }>;
}

interface CheckoutRegionContract {
  validateRegionConstraints(input: Record<string, unknown>): Promise<{
    readonly allowed: boolean;
    readonly reasons: readonly string[];
  }>;
}

interface CheckoutSalesChannelContract {
  checkProductPublishability(input: Record<string, unknown>): Promise<{
    readonly publishable: boolean;
    readonly reasons: readonly string[];
  }>;
}

interface CheckoutStoreDefaults {
  readonly defaultCurrencyCode: string;
  readonly defaultLocale: string;
  readonly defaultRegionId: string | null;
  readonly defaultSalesChannelId: string | null;
  readonly supportedCurrencyCodes: readonly string[];
  readonly timezone: string;
}

interface CheckoutStoreContract {
  getStoreDefaults(): Promise<CheckoutStoreDefaults>;
}

interface CheckoutTaxContract {
  calculateTax(
    input: Record<string, unknown>
  ): Promise<{ readonly totalTax: number }>;
}

const createDefaultIdGenerator = (): IdGeneratorServiceShape => ({
  nextId: () => crypto.randomUUID(),
});

const createNoopEventPublisher = (): EventPublisherServiceShape => ({
  publish: () => {
    // Checkout events are emitted when a runtime event bus is composed.
  },
});

const createEventId = (idGenerator: IdGeneratorServiceShape): string => {
  const nextId = idGenerator.nextId();
  return nextId.startsWith("evt_") ? nextId : `evt_${nextId}`;
};

const getLineMetadataValue = (
  metadata: Readonly<Record<string, unknown>>,
  key: string
): string | undefined => {
  const value = metadata[key];
  return typeof value === "string" && value ? value : undefined;
};

const requireReservationStockLocationId = ({
  availability,
  lineItemId,
  metadataStockLocationId,
}: {
  readonly availability: {
    readonly scopedBy?: { readonly stockLocationId?: string };
  };
  readonly lineItemId: string;
  readonly metadataStockLocationId?: string;
}): string => {
  const stockLocationId =
    metadataStockLocationId ?? availability.scopedBy?.stockLocationId;

  if (!stockLocationId) {
    throw new Error(
      `Line item "${lineItemId}" requires a stockLocationId for inventory reservation.`
    );
  }

  return stockLocationId;
};

const assertCartReady = (aggregate: CheckoutCartAggregate): void => {
  if (aggregate.cart.status !== "active") {
    throw new Error(`Cart "${aggregate.cart.id}" is not active.`);
  }

  if (aggregate.lineItems.length === 0) {
    throw new Error(`Cart "${aggregate.cart.id}" has no line items.`);
  }
};

const createWorkflowRunId = (input: CompleteCheckoutInput): string =>
  input.idempotencyKey;

const buildMetadata = ({
  input,
  workflowRunId,
}: {
  readonly input: CompleteCheckoutInput;
  readonly workflowRunId: string;
}) => ({
  causationId: input.causationId,
  correlationId: input.correlationId,
  idempotencyKey: input.idempotencyKey,
  workflowRunId,
});

const toFulfillmentAddress = (
  address: CheckoutCartAggregate["cart"]["shippingAddress"]
) =>
  address
    ? {
        city: address.city,
        countryCode: address.countryCode,
        line1: address.address1,
        postalCode: address.postalCode,
        provinceCode: address.province,
      }
    : undefined;

export const createCheckoutService = ({
  cart,
  customer,
  eventPublisher = createNoopEventPublisher(),
  fulfillment,
  idGenerator = createDefaultIdGenerator(),
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
}: CreateCheckoutServiceOptions): CheckoutServiceShape => {
  const completedRuns = new Map<string, CheckoutCompletionResult>();

  const publishEvent = async (
    name: typeof CHECKOUT_COMPLETED_EVENT | typeof CHECKOUT_FAILED_EVENT,
    payload: Record<string, unknown>,
    input: CompleteCheckoutInput,
    workflowRunId: string
  ): Promise<void> => {
    const envelope = createEventEnvelope({
      causationId: input.causationId,
      correlationId: input.correlationId,
      id: createEventId(idGenerator),
      name,
      payload,
      sourceModule: "checkout",
      subject: {
        id: input.cartId,
        type: "cart",
      },
      workflowRunId,
    });

    await eventPublisher.publish(envelope);
    await notificationEvent?.publishEvent({
      causationId: envelope.causationId,
      correlationId: envelope.correlationId,
      name: envelope.name,
      payload: envelope.payload,
      sourceModule: "checkout",
      subject: envelope.subject,
      workflowRunId: envelope.workflowRunId,
    });
  };

  return {
    // eslint-disable-next-line complexity
    completeCheckout: async (input) => {
      const duplicate = completedRuns.get(input.idempotencyKey);

      if (duplicate) {
        return duplicate;
      }

      const workflowRunId = createWorkflowRunId(input);
      const metadata = buildMetadata({ input, workflowRunId });
      const state: CheckoutRunState = {
        fulfillmentIds: [],
        inventoryReservations: [],
      };

      try {
        const aggregate = await cart.getCart(input.cartId);

        if (!aggregate) {
          throw new Error(`Cart "${input.cartId}" was not found.`);
        }

        assertCartReady(aggregate);

        const defaults = await store.getStoreDefaults();

        if (aggregate.cart.customerId) {
          await customer.getPaymentIdentity(aggregate.cart.customerId);
        }

        for (const lineItem of aggregate.lineItems) {
          const variantValidation = await product.validateProductVariant({
            productId: lineItem.productId,
            variantId: lineItem.variantId,
          });

          if (!variantValidation.valid) {
            throw new Error(
              `Product variant "${lineItem.variantId}" is not valid for checkout.`
            );
          }

          const salesChannelId =
            aggregate.cart.salesChannelId ?? defaults.defaultSalesChannelId;

          if (salesChannelId) {
            const publishability =
              await salesChannel.checkProductPublishability({
                productId: lineItem.productId,
                salesChannelId,
              });

            if (!publishability.publishable) {
              throw new Error(
                `Product "${lineItem.productId}" is not publishable for sales channel "${salesChannelId}".`
              );
            }
          }
        }

        const regionId = aggregate.cart.regionId ?? defaults.defaultRegionId;
        const validation = await region.validateRegionConstraints({
          countryCode: aggregate.cart.shippingAddress?.countryCode,
          currencyCode: aggregate.cart.currencyCode,
          fulfillmentOptionId: input.shippingOptionId,
          paymentProviderId: input.payment.providerKey,
          regionId: regionId ?? "",
        });

        if (!validation.allowed) {
          throw new Error(
            `Region constraints rejected checkout: ${validation.reasons.join(", ")}.`
          );
        }

        const calculatedLines: {
          readonly lineItem: CheckoutCartAggregate["lineItems"][number];
          readonly price: { readonly subtotal: number };
        }[] = [];

        for (const lineItem of aggregate.lineItems) {
          const priceSetId = getLineMetadataValue(
            lineItem.metadata,
            "priceSetId"
          );

          if (!priceSetId) {
            throw new Error(
              `Line item "${lineItem.id}" is missing priceSetId.`
            );
          }

          const calculatedPrice = await pricing.calculatePrice({
            context: {
              ...(aggregate.cart.salesChannelId
                ? { salesChannelId: aggregate.cart.salesChannelId }
                : {}),
              ...(regionId ? { regionId } : {}),
            },
            currencyCode: aggregate.cart.currencyCode,
            priceSetId,
            quantity: lineItem.quantity,
          });
          calculatedLines.push({
            lineItem,
            price: calculatedPrice,
          });
        }

        const promotionResult = await promotion.calculateAdjustments({
          cart: {
            currencyCode: aggregate.cart.currencyCode,
            id: aggregate.cart.id,
            lines: aggregate.lineItems.map((lineItem) => ({
              id: lineItem.id,
              quantity: lineItem.quantity,
              subtotal:
                calculatedLines.find(
                  (calculated) => calculated.lineItem.id === lineItem.id
                )?.price.subtotal ?? lineItem.unitPrice * lineItem.quantity,
            })),
            subtotal: calculatedLines.reduce(
              (sum, calculated) => sum + calculated.price.subtotal,
              0
            ),
          },
          context: {},
        });
        const discountedSubtotal =
          calculatedLines.reduce(
            (sum, calculated) => sum + calculated.price.subtotal,
            0
          ) - promotionResult.totalDiscount;
        const taxResult = await tax.calculateTax({
          currencyCode: aggregate.cart.currencyCode,
          address: {
            countryCode: aggregate.cart.shippingAddress?.countryCode ?? "US",
          },
          items: calculatedLines.map(({ lineItem, price }) => ({
            id: lineItem.id,
            quantity: lineItem.quantity,
            taxCategoryId:
              getLineMetadataValue(lineItem.metadata, "taxCategoryId") ??
              "default",
            subtotal: Math.max(price.subtotal, 0),
          })),
          policy: {
            pricesIncludeTax: false,
          },
          regionId: regionId ?? "",
        });
        const shippingOptions = await fulfillment.listShippingOptions({
          countryCode: aggregate.cart.shippingAddress?.countryCode,
          regionId: regionId ?? undefined,
          salesChannelId: aggregate.cart.salesChannelId ?? undefined,
        });
        const shippingOption = shippingOptions.find(
          (option) => option.id === input.shippingOptionId
        );

        if (!shippingOption || !shippingOption.isEnabled) {
          throw new Error(
            `Shipping option "${input.shippingOptionId}" is not available.`
          );
        }

        const shippingTotal = shippingOption.priceAmount ?? 0;
        const totals = {
          adjustmentTotal: -promotionResult.totalDiscount,
          currencyCode: aggregate.cart.currencyCode,
          discountTotal: promotionResult.totalDiscount,
          giftCardTotal: aggregate.cart.totals.giftCardTotal,
          itemSubtotal: calculatedLines.reduce(
            (sum, calculated) => sum + calculated.price.subtotal,
            0
          ),
          shippingTotal,
          subtotal: Math.max(discountedSubtotal, 0),
          taxTotal: taxResult.totalTax,
          total:
            Math.max(discountedSubtotal, 0) +
            taxResult.totalTax +
            shippingTotal,
        };

        await cart.updateTotals({
          ...metadata,
          cartId: aggregate.cart.id,
          totals,
        });

        for (const lineItem of aggregate.lineItems) {
          const inventoryItemId = getLineMetadataValue(
            lineItem.metadata,
            "inventoryItemId"
          );

          if (!inventoryItemId) {
            continue;
          }

          const metadataStockLocationId = getLineMetadataValue(
            lineItem.metadata,
            "stockLocationId"
          );
          const availability = await inventory.checkAvailability({
            inventoryItemId,
            salesChannelId: aggregate.cart.salesChannelId ?? undefined,
            stockLocationId: metadataStockLocationId,
          });

          if (availability.availableQuantity < lineItem.quantity) {
            throw new Error(
              `Insufficient inventory for line item "${lineItem.id}".`
            );
          }

          const stockLocationId = requireReservationStockLocationId({
            availability,
            lineItemId: lineItem.id,
            metadataStockLocationId,
          });
          const reservationResult = await inventory.reserveInventory({
            ...metadata,
            inventoryItemId,
            quantity: lineItem.quantity,
            salesChannelId: aggregate.cart.salesChannelId ?? undefined,
            stockLocationId,
          });

          const reservations =
            reservationResult.reservations ??
            (reservationResult.reservation
              ? [reservationResult.reservation]
              : []);

          for (const reservation of reservations) {
            state.inventoryReservations.push({
              inventoryItemId: reservation.inventoryItemId,
              quantity: reservation.quantity,
              stockLocationId: reservation.stockLocationId,
            });
          }
        }

        const collection = await payment.createCollection({
          amount: totals.total,
          cartId: aggregate.cart.id,
          currencyCode: totals.currencyCode,
          metadata: input.metadata,
        });
        const session = await payment.createSession({
          collectionId: collection.id,
          idempotencyKey: `${input.idempotencyKey}:payment:session`,
          metadata: input.metadata,
          providerKey: input.payment.providerKey,
        });

        await cart.setCheckoutReferences({
          ...metadata,
          cartId: aggregate.cart.id,
          paymentCollectionId: collection.id,
          shippingOptionId: input.shippingOptionId,
        });

        const authorizedPayment = await payment.authorizePaymentSession({
          idempotencyKey: `${input.idempotencyKey}:payment:authorize`,
          paymentMethodId: input.payment.paymentMethodId,
          sessionId: session.id,
        });

        const orderAggregate = await order.createOrderFromCheckout({
          ...metadata,
          billingAddress: aggregate.cart.billingAddress,
          cartId: aggregate.cart.id,
          customerId: aggregate.cart.customerId ?? undefined,
          email: aggregate.cart.email ?? undefined,
          lineItems: aggregate.lineItems.map((lineItem) => ({
            itemSnapshot: {
              metadata: lineItem.metadata,
              productId: lineItem.productId,
              productTitle: lineItem.title,
              sku: getLineMetadataValue(lineItem.metadata, "sku"),
              variantId: lineItem.variantId,
              variantTitle: lineItem.title,
            },
            quantity: lineItem.quantity,
            title: lineItem.title,
            total: lineItem.unitPrice * lineItem.quantity,
            unitPrice: lineItem.unitPrice,
          })),
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
        });

        const fulfillmentDetail = await fulfillment.createFulfillment({
          address: toFulfillmentAddress(aggregate.cart.shippingAddress),
          idempotencyKey: `${input.idempotencyKey}:fulfillment:create`,
          items: aggregate.lineItems.map((lineItem) => ({
            lineItemId: lineItem.id,
            quantity: lineItem.quantity,
            sku: getLineMetadataValue(lineItem.metadata, "sku"),
          })),
          metadata: input.metadata,
          orderId: orderAggregate.order.id,
          shippingOptionId: input.shippingOptionId,
        });
        const fulfillmentId = fulfillmentDetail.fulfillment.id;
        state.fulfillmentIds.push(fulfillmentId);

        if (input.payment.capture) {
          await payment.capturePayment({
            amount: totals.total,
            idempotencyKey: `${input.idempotencyKey}:payment:capture`,
            paymentId: authorizedPayment.id,
          });
        }

        const result: CheckoutCompletionResult = {
          cartId: aggregate.cart.id,
          fulfillmentIds: [...state.fulfillmentIds],
          orderId: orderAggregate.order.id,
          paymentId: authorizedPayment.id,
          status: "completed",
          workflowRunId,
        };

        await publishEvent(
          CHECKOUT_COMPLETED_EVENT,
          result,
          input,
          workflowRunId
        );

        completedRuns.set(input.idempotencyKey, result);

        return result;
      } catch (error) {
        for (const fulfillmentId of state.fulfillmentIds) {
          await fulfillment.cancelFulfillment({
            fulfillmentId,
            reason: "checkout-compensation",
          });
        }

        for (const reservation of state.inventoryReservations) {
          await inventory.adjustInventory({
            adjustment: reservation.quantity,
            idempotencyKey: `${input.idempotencyKey}:inventory:release:${reservation.inventoryItemId}`,
            inventoryItemId: reservation.inventoryItemId,
            reason: "restock",
            stockLocationId: reservation.stockLocationId,
          });
        }

        await publishEvent(
          CHECKOUT_FAILED_EVENT,
          {
            cartId: input.cartId,
            error: error instanceof Error ? error.message : String(error),
            workflowRunId,
          },
          input,
          workflowRunId
        );

        throw error;
      }
    },
  };
};

export const createCheckoutServiceLayer = (service: CheckoutServiceShape) =>
  Layer.succeed(CheckoutService, service);

import type {
  ClockServiceShape,
  EventPublisherServiceShape,
  IdGeneratorServiceShape,
} from "@ecommerce/core";
import { createEventEnvelope } from "@ecommerce/core/events";
import type { StatefulCoordinator } from "@ecommerce/core/stateful";
import { defineStatefulCoordinationRequest } from "@ecommerce/core/stateful";
import { Context, Layer } from "effect";
import { nanoid } from "nanoid";

import { createInMemoryCartCoordinator } from "../coordination";
import type {
  AddCartLineItemInput,
  ApplyCartAdjustmentInput,
  AssociateCartCustomerInput,
  CartAggregate,
  CartId,
  CartLineItemRecord,
  CartRecord,
  CartRepository,
  CartTotalsSnapshot,
  CreateCartInput,
  SetCartAddressesInput,
  SetCartCheckoutReferencesInput,
  SetCartRegionChannelInput,
  UpdateCartLineItemInput,
  UpdateCartTotalsInput,
} from "../domain";
import {
  CART_ADJUSTMENT_ID_PREFIX,
  CART_ID_PREFIX,
  CART_LINE_ITEM_ID_PREFIX,
  createCartAdjustmentId,
  createCartId,
  createCartLineItemId,
} from "../domain";
import { defaultCartRepository } from "../repositories";

export const CART_CREATED_EVENT = "cart.created" as const;
export const CART_LINE_ITEM_ADDED_EVENT = "cart.line-item-added" as const;
export const CART_LINE_ITEM_UPDATED_EVENT = "cart.line-item-updated" as const;
export const CART_CUSTOMER_ASSOCIATED_EVENT =
  "cart.customer-associated" as const;
export const CART_CHECKOUT_REFERENCE_SET_EVENT =
  "cart.checkout-reference-set" as const;
export const CART_ADJUSTMENT_APPLIED_EVENT = "cart.adjustment-applied" as const;
export const CART_TOTALS_UPDATED_EVENT = "cart.totals-updated" as const;

export interface CartServiceShape {
  addLineItem(input: AddCartLineItemInput): Promise<CartAggregate>;
  applyAdjustment(input: ApplyCartAdjustmentInput): Promise<CartAggregate>;
  associateCustomer(input: AssociateCartCustomerInput): Promise<CartAggregate>;
  createCart(input: CreateCartInput): Promise<CartRecord>;
  getCart(id: CartId): Promise<CartAggregate | null>;
  listCarts(): Promise<readonly CartRecord[]>;
  setAddresses(input: SetCartAddressesInput): Promise<CartAggregate>;
  setCheckoutReferences(
    input: SetCartCheckoutReferencesInput
  ): Promise<CartAggregate>;
  setRegionChannel(input: SetCartRegionChannelInput): Promise<CartAggregate>;
  updateLineItem(input: UpdateCartLineItemInput): Promise<CartAggregate>;
  updateTotals(input: UpdateCartTotalsInput): Promise<CartAggregate>;
}

export const CartService = Context.Service<CartServiceShape>(
  "@ecommerce/cart/CartService"
);

export interface CreateCartServiceOptions {
  readonly clock?: ClockServiceShape;
  readonly coordinator?: StatefulCoordinator;
  readonly eventPublisher?: EventPublisherServiceShape;
  readonly idGenerator?: IdGeneratorServiceShape;
  readonly repository?: CartRepository;
}

const createDefaultClock = (): ClockServiceShape => ({
  now: () => new Date(),
});

const createDefaultIdGenerator = (): IdGeneratorServiceShape => ({
  nextId: () => nanoid(),
});

const createNoopEventPublisher = (): EventPublisherServiceShape => ({
  publish: () => {
    // Cart events are emitted when a runtime event bus is composed.
  },
});

const createEmptyTotals = (currencyCode: string): CartTotalsSnapshot => ({
  adjustmentTotal: 0,
  currencyCode: currencyCode.trim().toUpperCase(),
  discountTotal: 0,
  giftCardTotal: 0,
  itemSubtotal: 0,
  shippingTotal: 0,
  subtotal: 0,
  taxTotal: 0,
  total: 0,
});

const createPrefixedId = (
  idGenerator: IdGeneratorServiceShape,
  prefix: string
): string => {
  const nextId = idGenerator.nextId();
  return nextId.startsWith(prefix) ? nextId : `${prefix}${nextId}`;
};

const normalizeCurrencyCode = (currencyCode: string): string =>
  currencyCode.trim().toUpperCase();

const requireCart = async (
  repository: CartRepository,
  id: CartId
): Promise<CartRecord> => {
  const cart = await repository.findCartById(id);

  if (!cart) {
    throw new Error(`Cart "${id}" was not found.`);
  }

  if (cart.status !== "active") {
    throw new Error(`Cart "${id}" is not active.`);
  }

  return cart;
};

const requireAggregate = async (
  repository: CartRepository,
  id: CartId
): Promise<CartAggregate> => {
  const aggregate = await repository.getCartAggregate(id);

  if (!aggregate) {
    throw new Error(`Cart "${id}" was not found.`);
  }

  return aggregate;
};

const publishCartEvent = async ({
  cartId,
  causationId,
  correlationId,
  eventPublisher,
  idGenerator,
  name,
  payload,
  workflowRunId,
}: {
  readonly cartId: CartId;
  readonly causationId?: string;
  readonly correlationId: string;
  readonly eventPublisher: EventPublisherServiceShape;
  readonly idGenerator: IdGeneratorServiceShape;
  readonly name: string;
  readonly payload: unknown;
  readonly workflowRunId?: string;
}): Promise<void> => {
  await eventPublisher.publish(
    createEventEnvelope({
      causationId,
      correlationId,
      id: createPrefixedId(idGenerator, "evt_"),
      name,
      payload,
      sourceModule: "cart",
      subject: {
        id: cartId,
        type: "cart",
      },
      workflowRunId,
    })
  );
};

export const createCartService = ({
  clock = createDefaultClock(),
  coordinator = createInMemoryCartCoordinator(),
  eventPublisher = createNoopEventPublisher(),
  idGenerator = createDefaultIdGenerator(),
  repository = defaultCartRepository,
}: CreateCartServiceOptions = {}): CartServiceShape => {
  const service: CartServiceShape = {
    addLineItem: async (input) => {
      const cartId = createCartId(input.cartId);
      const duplicate = await repository.findLineItemByIdempotencyKey(
        input.idempotencyKey
      );

      if (duplicate) {
        return requireAggregate(repository, cartId);
      }

      const coordination = await coordinator.coordinate(
        defineStatefulCoordinationRequest({
          causationId: input.causationId,
          coordinatorKey: "cart.aggregate",
          correlationId: input.correlationId,
          idempotencyKey: input.idempotencyKey,
          operationName: "cart.addLineItem",
          payload: input,
          subject: {
            id: cartId,
            type: "cart",
          },
          workflowRunId: input.workflowRunId,
        })
      );

      if (coordination.duplicate) {
        return requireAggregate(repository, cartId);
      }

      await requireCart(repository, cartId);

      const now = clock.now();
      const lineItem: CartLineItemRecord = {
        cartId,
        createdAt: now,
        id: createCartLineItemId(
          createPrefixedId(idGenerator, CART_LINE_ITEM_ID_PREFIX)
        ),
        metadata: input.metadata ?? {},
        productId: input.productId,
        quantity: input.quantity,
        title: input.title.trim(),
        unitPrice: input.unitPrice,
        updatedAt: now,
        variantId: input.variantId,
      };

      await repository.saveLineItem(lineItem, input.idempotencyKey);
      await publishCartEvent({
        cartId,
        causationId: input.causationId,
        correlationId: input.correlationId,
        eventPublisher,
        idGenerator,
        name: CART_LINE_ITEM_ADDED_EVENT,
        payload: {
          cartId,
          lineItemId: lineItem.id,
          quantity: lineItem.quantity,
          variantId: lineItem.variantId,
        },
        workflowRunId: input.workflowRunId,
      });

      return requireAggregate(repository, cartId);
    },
    applyAdjustment: async (input) => {
      const cartId = createCartId(input.cartId);
      const duplicate = await repository.findAdjustmentByIdempotencyKey(
        input.idempotencyKey
      );

      if (duplicate) {
        return requireAggregate(repository, cartId);
      }

      const coordination = await coordinator.coordinate(
        defineStatefulCoordinationRequest({
          causationId: input.causationId,
          coordinatorKey: "cart.aggregate",
          correlationId: input.correlationId,
          idempotencyKey: input.idempotencyKey,
          operationName: "cart.applyAdjustment",
          payload: input,
          subject: {
            id: cartId,
            type: "cart",
          },
          workflowRunId: input.workflowRunId,
        })
      );

      if (coordination.duplicate) {
        return requireAggregate(repository, cartId);
      }

      await requireCart(repository, cartId);
      const lineItemId = input.lineItemId
        ? createCartLineItemId(input.lineItemId)
        : null;

      if (lineItemId) {
        const lineItem = await repository.findLineItemById(lineItemId);

        if (!lineItem || lineItem.cartId !== cartId) {
          throw new Error(
            `Cart line item "${input.lineItemId}" was not found.`
          );
        }
      }

      const now = clock.now();
      const adjustment = await repository.saveAdjustment(
        {
          amount: input.amount,
          cartId,
          createdAt: now,
          id: createCartAdjustmentId(
            createPrefixedId(idGenerator, CART_ADJUSTMENT_ID_PREFIX)
          ),
          lineItemId,
          metadata: input.metadata ?? {},
          source: input.source,
          type: input.type,
          updatedAt: now,
        },
        input.idempotencyKey
      );

      await publishCartEvent({
        cartId,
        causationId: input.causationId,
        correlationId: input.correlationId,
        eventPublisher,
        idGenerator,
        name: CART_ADJUSTMENT_APPLIED_EVENT,
        payload: {
          adjustmentId: adjustment.id,
          amount: adjustment.amount,
          cartId,
          type: adjustment.type,
        },
        workflowRunId: input.workflowRunId,
      });

      return requireAggregate(repository, cartId);
    },
    associateCustomer: async (input) => {
      const cartId = createCartId(input.cartId);
      const cart = await requireCart(repository, cartId);
      const now = clock.now();

      await repository.saveCart({
        ...cart,
        customerId: input.customerId ?? cart.customerId,
        email: input.email ?? cart.email,
        updatedAt: now,
      });
      await publishCartEvent({
        cartId,
        causationId: input.causationId,
        correlationId: input.correlationId,
        eventPublisher,
        idGenerator,
        name: CART_CUSTOMER_ASSOCIATED_EVENT,
        payload: {
          cartId,
          customerId: input.customerId ?? cart.customerId,
          email: input.email ?? cart.email,
        },
        workflowRunId: input.workflowRunId,
      });

      return requireAggregate(repository, cartId);
    },
    createCart: async (input) => {
      const now = clock.now();
      const currencyCode = normalizeCurrencyCode(input.currencyCode);
      const cart: CartRecord = {
        billingAddress: null,
        completedAt: null,
        createdAt: now,
        currencyCode,
        customerId: input.customerId ?? null,
        email: input.email ?? null,
        id: createCartId(createPrefixedId(idGenerator, CART_ID_PREFIX)),
        metadata: input.metadata ?? {},
        paymentCollectionId: null,
        regionId: input.regionId ?? null,
        salesChannelId: input.salesChannelId ?? null,
        shippingAddress: null,
        shippingOptionId: null,
        status: "active",
        totals: createEmptyTotals(currencyCode),
        updatedAt: now,
      };

      const saved = await repository.saveCart(cart);
      await publishCartEvent({
        cartId: saved.id,
        correlationId: saved.id,
        eventPublisher,
        idGenerator,
        name: CART_CREATED_EVENT,
        payload: {
          cartId: saved.id,
          currencyCode: saved.currencyCode,
        },
      });

      return saved;
    },
    getCart: (id) => repository.getCartAggregate(id),
    listCarts: () => repository.listCarts(),
    setAddresses: async (input) => {
      const cartId = createCartId(input.cartId);
      const cart = await requireCart(repository, cartId);
      await repository.saveCart({
        ...cart,
        billingAddress: input.billingAddress ?? cart.billingAddress,
        shippingAddress: input.shippingAddress ?? cart.shippingAddress,
        updatedAt: clock.now(),
      });

      return requireAggregate(repository, cartId);
    },
    setCheckoutReferences: async (input) => {
      const cartId = createCartId(input.cartId);
      const cart = await requireCart(repository, cartId);
      await repository.saveCart({
        ...cart,
        paymentCollectionId:
          input.paymentCollectionId ?? cart.paymentCollectionId,
        shippingOptionId: input.shippingOptionId ?? cart.shippingOptionId,
        updatedAt: clock.now(),
      });
      await publishCartEvent({
        cartId,
        causationId: input.causationId,
        correlationId: input.correlationId,
        eventPublisher,
        idGenerator,
        name: CART_CHECKOUT_REFERENCE_SET_EVENT,
        payload: {
          cartId,
          paymentCollectionId:
            input.paymentCollectionId ?? cart.paymentCollectionId,
          shippingOptionId: input.shippingOptionId ?? cart.shippingOptionId,
        },
        workflowRunId: input.workflowRunId,
      });

      return requireAggregate(repository, cartId);
    },
    setRegionChannel: async (input) => {
      const cartId = createCartId(input.cartId);
      const cart = await requireCart(repository, cartId);
      await repository.saveCart({
        ...cart,
        currencyCode: input.currencyCode
          ? normalizeCurrencyCode(input.currencyCode)
          : cart.currencyCode,
        regionId: input.regionId ?? cart.regionId,
        salesChannelId: input.salesChannelId ?? cart.salesChannelId,
        updatedAt: clock.now(),
      });

      return requireAggregate(repository, cartId);
    },
    updateLineItem: async (input) => {
      const cartId = createCartId(input.cartId);
      await requireCart(repository, cartId);
      const lineItemId = createCartLineItemId(input.lineItemId);
      const lineItem = await repository.findLineItemById(lineItemId);

      if (!lineItem || lineItem.cartId !== cartId) {
        throw new Error(`Cart line item "${input.lineItemId}" was not found.`);
      }

      await (input.quantity === 0
        ? repository.removeLineItem(lineItemId)
        : repository.saveLineItem({
            ...lineItem,
            quantity: input.quantity,
            updatedAt: clock.now(),
          }));

      await publishCartEvent({
        cartId,
        causationId: input.causationId,
        correlationId: input.correlationId,
        eventPublisher,
        idGenerator,
        name: CART_LINE_ITEM_UPDATED_EVENT,
        payload: {
          cartId,
          lineItemId,
          quantity: input.quantity,
        },
        workflowRunId: input.workflowRunId,
      });

      return requireAggregate(repository, cartId);
    },
    updateTotals: async (input) => {
      const cartId = createCartId(input.cartId);
      const cart = await requireCart(repository, cartId);
      const totals = {
        ...input.totals,
        currencyCode: normalizeCurrencyCode(input.totals.currencyCode),
      };

      await repository.saveCart({
        ...cart,
        currencyCode: totals.currencyCode,
        totals,
        updatedAt: clock.now(),
      });
      await publishCartEvent({
        cartId,
        causationId: input.causationId,
        correlationId: input.correlationId,
        eventPublisher,
        idGenerator,
        name: CART_TOTALS_UPDATED_EVENT,
        payload: {
          cartId,
          total: totals.total,
        },
        workflowRunId: input.workflowRunId,
      });

      return requireAggregate(repository, cartId);
    },
  };

  return service;
};

export const createCartServiceLayer = (service: CartServiceShape) =>
  Layer.succeed(CartService, service);

export const defaultCartService = createCartService({
  repository: defaultCartRepository,
});

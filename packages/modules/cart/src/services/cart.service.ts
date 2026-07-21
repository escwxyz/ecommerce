import type {
  ClockServiceShape,
  EventPublisherServiceShape,
  IdGeneratorServiceShape,
} from "@ecommerce/core";
import {
  ClockService,
  EventPublisherService,
  IdGeneratorService,
} from "@ecommerce/core";
import { createEventEnvelope } from "@ecommerce/core/events";
import type { StatefulCoordinator } from "@ecommerce/core/stateful";
import { defineStatefulCoordinationRequest } from "@ecommerce/core/stateful";
import { Context, Effect, Layer } from "effect";
import type { Effect as EffectValue } from "effect/Effect";
import { nanoid } from "nanoid";

import { createInMemoryCartCoordinator } from "../coordination";
import type {
  AddCartLineItemInput,
  ApplyCartAdjustmentInput,
  AssociateCartCustomerInput,
  CartAggregate,
  CartExpectedError,
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
  CartLineItemNotFound,
  CartNotActive,
  CartNotFound,
  CartRepositoryService,
  CartValidationFailure,
  createCartAdjustmentIdEffect,
  createCartIdEffect,
  createCartLineItemIdEffect,
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

export type CartServiceFailure = CartExpectedError;

export interface CartServiceShape {
  readonly addLineItem: (
    input: AddCartLineItemInput
  ) => EffectValue<CartAggregate, CartServiceFailure>;
  readonly applyAdjustment: (
    input: ApplyCartAdjustmentInput
  ) => EffectValue<CartAggregate, CartServiceFailure>;
  readonly associateCustomer: (
    input: AssociateCartCustomerInput
  ) => EffectValue<CartAggregate, CartServiceFailure>;
  readonly createCart: (
    input: CreateCartInput
  ) => EffectValue<CartRecord, CartServiceFailure>;
  readonly getCart: (
    id: CartId
  ) => EffectValue<CartAggregate | null, CartServiceFailure>;
  readonly listCarts: EffectValue<readonly CartRecord[], CartServiceFailure>;
  readonly setAddresses: (
    input: SetCartAddressesInput
  ) => EffectValue<CartAggregate, CartServiceFailure>;
  readonly setCheckoutReferences: (
    input: SetCartCheckoutReferencesInput
  ) => EffectValue<CartAggregate, CartServiceFailure>;
  readonly setRegionChannel: (
    input: SetCartRegionChannelInput
  ) => EffectValue<CartAggregate, CartServiceFailure>;
  readonly updateLineItem: (
    input: UpdateCartLineItemInput
  ) => EffectValue<CartAggregate, CartServiceFailure>;
  readonly updateTotals: (
    input: UpdateCartTotalsInput
  ) => EffectValue<CartAggregate, CartServiceFailure>;
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
    // Cart events are optional until a runtime event bus is composed.
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

const requireCart = (
  repository: CartRepository,
  id: CartId
): EffectValue<CartRecord, CartServiceFailure> =>
  Effect.gen(function* requireCartEffect() {
    const cart = yield* repository.findCartById(id);

    if (!cart) {
      return yield* new CartNotFound({ cartId: id });
    }

    if (cart.status !== "active") {
      return yield* new CartNotActive({ cartId: id });
    }

    return cart;
  });

const requireAggregate = (
  repository: CartRepository,
  id: CartId
): EffectValue<CartAggregate, CartServiceFailure> =>
  repository
    .getCartAggregate(id)
    .pipe(
      Effect.flatMap((aggregate) =>
        aggregate ? Effect.succeed(aggregate) : new CartNotFound({ cartId: id })
      )
    );

const publishCartEvent = ({
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
}): EffectValue<void, CartValidationFailure> =>
  Effect.tryPromise({
    catch: () =>
      new CartValidationFailure({
        message: "Cart event publication failed.",
      }),
    try: () =>
      Promise.resolve(
        eventPublisher.publish(
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
        )
      ),
  }).pipe(Effect.asVoid);

const coordinateCart = (
  coordinator: StatefulCoordinator,
  input:
    | AddCartLineItemInput
    | ApplyCartAdjustmentInput
    | AssociateCartCustomerInput
    | SetCartAddressesInput
    | SetCartCheckoutReferencesInput
    | SetCartRegionChannelInput
    | UpdateCartLineItemInput
    | UpdateCartTotalsInput,
  operationName: string
) =>
  Effect.tryPromise({
    catch: () =>
      new CartValidationFailure({ message: "Cart coordination failed." }),
    try: () =>
      coordinator.coordinate(
        defineStatefulCoordinationRequest({
          causationId: input.causationId,
          coordinatorKey: "cart.aggregate",
          correlationId: input.correlationId,
          idempotencyKey: input.idempotencyKey,
          operationName,
          payload: input,
          subject: {
            id: input.cartId,
            type: "cart",
          },
          workflowRunId: input.workflowRunId,
        })
      ),
  });

export const createCartService = ({
  clock = createDefaultClock(),
  coordinator = createInMemoryCartCoordinator(),
  eventPublisher = createNoopEventPublisher(),
  idGenerator = createDefaultIdGenerator(),
  repository = defaultCartRepository,
}: CreateCartServiceOptions = {}): CartServiceShape => {
  const service: CartServiceShape = {
    addLineItem: (input) =>
      Effect.gen(function* addCartLineItemEffect() {
        const cartId = yield* createCartIdEffect(input.cartId);
        const duplicate = yield* repository.findLineItemByIdempotencyKey(
          input.idempotencyKey
        );

        if (duplicate) {
          return yield* requireAggregate(repository, cartId);
        }

        const coordination = yield* coordinateCart(
          coordinator,
          input,
          "cart.addLineItem"
        );

        if (coordination.duplicate) {
          return yield* requireAggregate(repository, cartId);
        }

        yield* requireCart(repository, cartId);

        const now = clock.now();
        const lineItem: CartLineItemRecord = {
          cartId,
          createdAt: now,
          id: yield* createCartLineItemIdEffect(
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

        yield* repository.saveLineItem(lineItem, input.idempotencyKey);
        yield* publishCartEvent({
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

        return yield* requireAggregate(repository, cartId);
      }),
    applyAdjustment: (input) =>
      Effect.gen(function* applyCartAdjustmentEffect() {
        const cartId = yield* createCartIdEffect(input.cartId);
        const duplicate = yield* repository.findAdjustmentByIdempotencyKey(
          input.idempotencyKey
        );

        if (duplicate) {
          return yield* requireAggregate(repository, cartId);
        }

        const coordination = yield* coordinateCart(
          coordinator,
          input,
          "cart.applyAdjustment"
        );

        if (coordination.duplicate) {
          return yield* requireAggregate(repository, cartId);
        }

        yield* requireCart(repository, cartId);
        const lineItemId = input.lineItemId
          ? yield* createCartLineItemIdEffect(input.lineItemId)
          : null;

        if (lineItemId) {
          const lineItem = yield* repository.findLineItemById(
            lineItemId,
            cartId
          );

          if (!lineItem || lineItem.cartId !== cartId) {
            return yield* new CartLineItemNotFound({
              cartId,
              lineItemId,
            });
          }
        }

        const now = clock.now();
        const adjustment = yield* repository.saveAdjustment(
          {
            amount: input.amount,
            cartId,
            createdAt: now,
            id: yield* createCartAdjustmentIdEffect(
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

        yield* publishCartEvent({
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

        return yield* requireAggregate(repository, cartId);
      }),
    associateCustomer: (input) =>
      Effect.gen(function* associateCartCustomerEffect() {
        const cartId = yield* createCartIdEffect(input.cartId);
        const cart = yield* requireCart(repository, cartId);
        const now = clock.now();

        yield* repository.saveCart({
          ...cart,
          customerId: input.customerId ?? cart.customerId,
          email: input.email ?? cart.email,
          updatedAt: now,
        });
        yield* publishCartEvent({
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

        return yield* requireAggregate(repository, cartId);
      }),
    createCart: (input) =>
      Effect.gen(function* createCartEffect() {
        const now = clock.now();
        const currencyCode = normalizeCurrencyCode(input.currencyCode);
        const cart: CartRecord = {
          billingAddress: null,
          completedAt: null,
          createdAt: now,
          currencyCode,
          customerId: input.customerId ?? null,
          email: input.email ?? null,
          id: yield* createCartIdEffect(
            createPrefixedId(idGenerator, CART_ID_PREFIX)
          ),
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

        const saved = yield* repository.saveCart(cart);
        yield* publishCartEvent({
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
      }),
    getCart: (id) => repository.getCartAggregate(id),
    listCarts: repository.listCarts,
    setAddresses: (input) =>
      Effect.gen(function* setCartAddressesEffect() {
        const cartId = yield* createCartIdEffect(input.cartId);
        const cart = yield* requireCart(repository, cartId);
        yield* repository.saveCart({
          ...cart,
          billingAddress: input.billingAddress ?? cart.billingAddress,
          shippingAddress: input.shippingAddress ?? cart.shippingAddress,
          updatedAt: clock.now(),
        });

        return yield* requireAggregate(repository, cartId);
      }),
    setCheckoutReferences: (input) =>
      Effect.gen(function* setCartCheckoutReferencesEffect() {
        const cartId = yield* createCartIdEffect(input.cartId);
        const cart = yield* requireCart(repository, cartId);
        yield* repository.saveCart({
          ...cart,
          paymentCollectionId:
            input.paymentCollectionId ?? cart.paymentCollectionId,
          shippingOptionId: input.shippingOptionId ?? cart.shippingOptionId,
          updatedAt: clock.now(),
        });
        yield* publishCartEvent({
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

        return yield* requireAggregate(repository, cartId);
      }),
    setRegionChannel: (input) =>
      Effect.gen(function* setCartRegionChannelEffect() {
        const cartId = yield* createCartIdEffect(input.cartId);
        const cart = yield* requireCart(repository, cartId);
        const currencyCode = input.currencyCode
          ? normalizeCurrencyCode(input.currencyCode)
          : cart.currencyCode;

        yield* repository.saveCart({
          ...cart,
          currencyCode,
          regionId: input.regionId ?? cart.regionId,
          salesChannelId: input.salesChannelId ?? cart.salesChannelId,
          totals:
            currencyCode === cart.currencyCode
              ? cart.totals
              : createEmptyTotals(currencyCode),
          updatedAt: clock.now(),
        });

        return yield* requireAggregate(repository, cartId);
      }),
    updateLineItem: (input) =>
      Effect.gen(function* updateCartLineItemEffect() {
        const cartId = yield* createCartIdEffect(input.cartId);
        yield* requireCart(repository, cartId);
        const lineItemId = yield* createCartLineItemIdEffect(input.lineItemId);
        const lineItem = yield* repository.findLineItemById(lineItemId, cartId);

        if (!lineItem || lineItem.cartId !== cartId) {
          return yield* new CartLineItemNotFound({ cartId, lineItemId });
        }

        yield* input.quantity === 0
          ? repository.removeLineItem(lineItemId, cartId)
          : repository
              .saveLineItem({
                ...lineItem,
                quantity: input.quantity,
                updatedAt: clock.now(),
              })
              .pipe(Effect.asVoid);

        yield* publishCartEvent({
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

        return yield* requireAggregate(repository, cartId);
      }),
    updateTotals: (input) =>
      Effect.gen(function* updateCartTotalsEffect() {
        const cartId = yield* createCartIdEffect(input.cartId);
        const cart = yield* requireCart(repository, cartId);
        const totals = {
          ...input.totals,
          currencyCode: normalizeCurrencyCode(input.totals.currencyCode),
        };

        yield* repository.saveCart({
          ...cart,
          currencyCode: totals.currencyCode,
          totals,
          updatedAt: clock.now(),
        });
        yield* publishCartEvent({
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

        return yield* requireAggregate(repository, cartId);
      }),
  };

  return service;
};

export const createCartServiceLayer = (service: CartServiceShape) =>
  Layer.succeed(CartService, service);

export const createCartRepositoryLayer = (repository: CartRepository) =>
  Layer.succeed(CartRepositoryService, repository);

export const createCartServiceFromDependenciesLayer = ({
  coordinator,
}: {
  readonly coordinator?: StatefulCoordinator;
} = {}) =>
  Layer.effect(
    CartService,
    Effect.gen(function* createCartServiceFromDependencies() {
      const clock = yield* ClockService;
      const eventPublisher = yield* EventPublisherService;
      const idGenerator = yield* IdGeneratorService;
      const repository = yield* CartRepositoryService;

      return createCartService({
        clock,
        coordinator,
        eventPublisher,
        idGenerator,
        repository,
      });
    })
  );

export const defaultCartService = createCartService({
  repository: defaultCartRepository,
});

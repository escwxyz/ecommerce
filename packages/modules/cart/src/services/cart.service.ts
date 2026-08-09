import type {
  ClockServiceShape,
  IdGeneratorServiceShape,
  OutboxWriterServiceShape,
  TransactionBoundaryServiceShape,
  CurrentTransactionService,
} from "@ecommerce/core";
import {
  COMMERCE_EVENTS_OUTBOX_TOPIC,
  ClockService,
  IdGeneratorService,
  OutboxWriterService,
  TransactionBoundaryService,
  executeTransactionalMutation,
} from "@ecommerce/core";
import type { CommerceEventEnvelope } from "@ecommerce/core/events";
import { createEventEnvelope } from "@ecommerce/core/events";
import {
  KeyedActorCommandSchema,
  KeyedActorService,
} from "@ecommerce/core/stateful";
import { Context, Effect, Layer, Schema } from "effect";
import type { Effect as EffectValue } from "effect/Effect";
import { nanoid } from "nanoid";

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
  readonly actorService: KeyedActorService;
  readonly clock?: ClockServiceShape;
  readonly idGenerator?: IdGeneratorServiceShape;
  readonly outboxWriter: OutboxWriterServiceShape;
  readonly repository: CartRepository;
  readonly transactionBoundary: TransactionBoundaryServiceShape;
}

const createDefaultClock = (): ClockServiceShape => ({
  now: () => new Date(),
});

const createDefaultIdGenerator = (): IdGeneratorServiceShape => ({
  nextId: () => nanoid(),
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
  idGenerator,
  idempotencyKey,
  name,
  outboxWriter,
  payload,
  workflowRunId,
}: {
  readonly cartId: CartId;
  readonly causationId?: string;
  readonly correlationId: string;
  readonly idGenerator: IdGeneratorServiceShape;
  readonly idempotencyKey: string;
  readonly name: string;
  readonly outboxWriter: OutboxWriterServiceShape;
  readonly payload: unknown;
  readonly workflowRunId?: string;
}) => {
  const event: CommerceEventEnvelope = createEventEnvelope({
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
  });

  return outboxWriter
    .enqueue({
      event,
      idempotencyKey: `${event.name}:${idempotencyKey}`,
      topic: COMMERCE_EVENTS_OUTBOX_TOPIC,
    })
    .pipe(Effect.asVoid);
};

const coordinateCart = (
  actorService: KeyedActorService,
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
): EffectValue<{ readonly duplicate: boolean }, CartValidationFailure> =>
  Effect.gen(function* coordinateCartThroughActor() {
    const command = yield* Schema.decodeUnknownEffect(KeyedActorCommandSchema)({
      actor: {
        key: input.cartId,
        type: "cart",
      },
      causationId: input.causationId,
      commandId: input.idempotencyKey,
      commandName: operationName,
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey,
      issuedAt: new Date().toISOString(),
      payload: input,
      schemaVersion: 1,
      subject: {
        id: input.cartId,
        type: "cart",
      },
      workflowRunId: input.workflowRunId,
    }).pipe(
      Effect.mapError(
        () =>
          new CartValidationFailure({ message: "Cart coordination failed." })
      )
    );

    return yield* actorService
      .dispatch(command)
      .pipe(
        Effect.mapError(
          () =>
            new CartValidationFailure({ message: "Cart coordination failed." })
        )
      );
  });

export const createCartService = ({
  actorService,
  clock = createDefaultClock(),
  idGenerator = createDefaultIdGenerator(),
  outboxWriter,
  repository,
  transactionBoundary,
}: CreateCartServiceOptions): CartServiceShape => {
  const service = {
    addLineItem: (input: AddCartLineItemInput) =>
      Effect.gen(function* addCartLineItemEffect() {
        const cartId = yield* createCartIdEffect(input.cartId);
        const duplicate = yield* repository.findLineItemByIdempotencyKey(
          input.idempotencyKey
        );

        if (duplicate) {
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
          idGenerator,
          idempotencyKey: input.idempotencyKey,
          name: CART_LINE_ITEM_ADDED_EVENT,
          outboxWriter,
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
    applyAdjustment: (input: ApplyCartAdjustmentInput) =>
      Effect.gen(function* applyCartAdjustmentEffect() {
        const cartId = yield* createCartIdEffect(input.cartId);
        const duplicate = yield* repository.findAdjustmentByIdempotencyKey(
          input.idempotencyKey
        );

        if (duplicate) {
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
          idGenerator,
          idempotencyKey: input.idempotencyKey,
          name: CART_ADJUSTMENT_APPLIED_EVENT,
          outboxWriter,
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
    associateCustomer: (input: AssociateCartCustomerInput) =>
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
          idGenerator,
          idempotencyKey: input.idempotencyKey,
          name: CART_CUSTOMER_ASSOCIATED_EVENT,
          outboxWriter,
          payload: {
            cartId,
            customerId: input.customerId ?? cart.customerId,
            email: input.email ?? cart.email,
          },
          workflowRunId: input.workflowRunId,
        });

        return yield* requireAggregate(repository, cartId);
      }),
    createCart: (input: CreateCartInput) =>
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
          idGenerator,
          idempotencyKey: `${CART_CREATED_EVENT}:${saved.id}`,
          name: CART_CREATED_EVENT,
          outboxWriter,
          payload: {
            cartId: saved.id,
            currencyCode: saved.currencyCode,
          },
        });

        return saved;
      }),
    getCart: (id: CartId) => repository.getCartAggregate(id),
    listCarts: repository.listCarts,
    setAddresses: (input: SetCartAddressesInput) =>
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
    setCheckoutReferences: (input: SetCartCheckoutReferencesInput) =>
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
          idGenerator,
          idempotencyKey: input.idempotencyKey,
          name: CART_CHECKOUT_REFERENCE_SET_EVENT,
          outboxWriter,
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
    setRegionChannel: (input: SetCartRegionChannelInput) =>
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
    updateLineItem: (input: UpdateCartLineItemInput) =>
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
          idGenerator,
          idempotencyKey: input.idempotencyKey,
          name: CART_LINE_ITEM_UPDATED_EVENT,
          outboxWriter,
          payload: {
            cartId,
            lineItemId,
            quantity: input.quantity,
          },
          workflowRunId: input.workflowRunId,
        });

        return yield* requireAggregate(repository, cartId);
      }),
    updateTotals: (input: UpdateCartTotalsInput) =>
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
          idGenerator,
          idempotencyKey: input.idempotencyKey,
          name: CART_TOTALS_UPDATED_EVENT,
          outboxWriter,
          payload: {
            cartId,
            total: totals.total,
          },
          workflowRunId: input.workflowRunId,
        });

        return yield* requireAggregate(repository, cartId);
      }),
  };

  const transactionalCartMutation = <A, E>(
    operation: string,
    effect: EffectValue<A, E, CurrentTransactionService>
  ) =>
    executeTransactionalMutation<A, E, never>({
      effect,
      moduleName: "cart",
      operation,
      outboxMessages: () => [],
      outboxWriter,
      transactionBoundary,
    });

  return {
    ...service,
    addLineItem: (input) =>
      transactionalCartMutation("addLineItem", service.addLineItem(input)).pipe(
        Effect.tap(() =>
          coordinateCart(actorService, input, "cart.addLineItem").pipe(
            Effect.ignore
          )
        )
      ),
    applyAdjustment: (input) =>
      transactionalCartMutation(
        "applyAdjustment",
        service.applyAdjustment(input)
      ).pipe(
        Effect.tap(() =>
          coordinateCart(actorService, input, "cart.applyAdjustment").pipe(
            Effect.ignore
          )
        )
      ),
    associateCustomer: (input) =>
      transactionalCartMutation(
        "associateCustomer",
        service.associateCustomer(input)
      ),
    createCart: (input) =>
      transactionalCartMutation("createCart", service.createCart(input)),
    setAddresses: (input) =>
      transactionalCartMutation("setAddresses", service.setAddresses(input)),
    setCheckoutReferences: (input) =>
      transactionalCartMutation(
        "setCheckoutReferences",
        service.setCheckoutReferences(input)
      ),
    setRegionChannel: (input) =>
      transactionalCartMutation(
        "setRegionChannel",
        service.setRegionChannel(input)
      ),
    updateLineItem: (input) =>
      transactionalCartMutation(
        "updateLineItem",
        service.updateLineItem(input)
      ),
    updateTotals: (input) =>
      transactionalCartMutation("updateTotals", service.updateTotals(input)),
  };
};

export const createCartServiceLayer = (service: CartServiceShape) =>
  Layer.succeed(CartService, service);

export const createCartRepositoryLayer = (repository: CartRepository) =>
  Layer.succeed(CartRepositoryService, repository);

export const createCartServiceFromDependenciesLayer = () =>
  Layer.effect(
    CartService,
    Effect.gen(function* createCartServiceFromDependencies() {
      const actorService = yield* KeyedActorService;
      const clock = yield* ClockService;
      const idGenerator = yield* IdGeneratorService;
      const outboxWriter = yield* OutboxWriterService;
      const repository = yield* CartRepositoryService;
      const transactionBoundary = yield* TransactionBoundaryService;

      return createCartService({
        actorService,
        clock,
        idGenerator,
        outboxWriter,
        repository,
        transactionBoundary,
      });
    })
  );

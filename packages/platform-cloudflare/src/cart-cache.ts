import {
  CartCacheOwnershipError,
  createCachedCartRepository,
} from "@ecommerce/cart/cache";
import type {
  CartActiveCache,
  CartOwnershipScope,
  CartProjectionSyncFailure,
} from "@ecommerce/cart/cache";
import type {
  CartAdjustmentRecord,
  CartAggregate,
  CartExpectedError,
  CartId,
  CartLineItemRecord,
  CartRecord,
  CartRepository,
} from "@ecommerce/cart/domain";
import {
  CartValidationFailure,
  createCartAdjustmentId,
  createCartId,
  createCartLineItemId,
} from "@ecommerce/cart/domain";
import { Effect } from "effect";
import type { Effect as EffectValue } from "effect/Effect";

type StoredCartRecord = Omit<
  CartRecord,
  "completedAt" | "createdAt" | "updatedAt"
> & {
  readonly completedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

type StoredLineItemRecord = Omit<
  CartLineItemRecord,
  "createdAt" | "updatedAt"
> & {
  readonly createdAt: string;
  readonly updatedAt: string;
};

type StoredAdjustmentRecord = Omit<
  CartAdjustmentRecord,
  "createdAt" | "updatedAt"
> & {
  readonly createdAt: string;
  readonly updatedAt: string;
};

interface StoredCartAggregate {
  readonly adjustments: readonly StoredAdjustmentRecord[];
  readonly cart: StoredCartRecord;
  readonly lineItems: readonly StoredLineItemRecord[];
}

interface CloudflareCartCacheResponse<Output> {
  readonly error?: string;
  readonly output: Output;
}

export interface CloudflareCartCacheOptions {
  readonly namespace: DurableObjectNamespace;
}

export interface CloudflareCartCacheRepositoryOptions extends CloudflareCartCacheOptions {
  readonly onProjectionSyncFailure?: (
    failure: CartProjectionSyncFailure
  ) => EffectValue<void, CartExpectedError> | void;
  readonly projectionSyncFailureMode?: "fail-write" | "record-only";
  readonly projectionRepository: CartRepository;
  readonly scope?: CartOwnershipScope | (() => CartOwnershipScope);
}

export const createCartCacheDurableObjectName = (cartId: CartId): string =>
  `cart:${cartId}`;

const serializeCart = (cart: CartRecord): StoredCartRecord => ({
  ...cart,
  completedAt: cart.completedAt?.toISOString() ?? null,
  createdAt: cart.createdAt.toISOString(),
  updatedAt: cart.updatedAt.toISOString(),
});

const serializeLineItem = (item: CartLineItemRecord): StoredLineItemRecord => ({
  ...item,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
});

const serializeAdjustment = (
  adjustment: CartAdjustmentRecord
): StoredAdjustmentRecord => ({
  ...adjustment,
  createdAt: adjustment.createdAt.toISOString(),
  updatedAt: adjustment.updatedAt.toISOString(),
});

const serializeAggregate = (aggregate: CartAggregate): StoredCartAggregate => ({
  adjustments: aggregate.adjustments.map(serializeAdjustment),
  cart: serializeCart(aggregate.cart),
  lineItems: aggregate.lineItems.map(serializeLineItem),
});

const deserializeCart = (cart: StoredCartRecord): CartRecord => ({
  ...cart,
  completedAt: cart.completedAt ? new Date(cart.completedAt) : null,
  createdAt: new Date(cart.createdAt),
  id: createCartId(cart.id),
  updatedAt: new Date(cart.updatedAt),
});

const deserializeLineItem = (
  item: StoredLineItemRecord
): CartLineItemRecord => ({
  ...item,
  cartId: createCartId(item.cartId),
  createdAt: new Date(item.createdAt),
  id: createCartLineItemId(item.id),
  updatedAt: new Date(item.updatedAt),
});

const deserializeAdjustment = (
  adjustment: StoredAdjustmentRecord
): CartAdjustmentRecord => ({
  ...adjustment,
  cartId: createCartId(adjustment.cartId),
  createdAt: new Date(adjustment.createdAt),
  id: createCartAdjustmentId(adjustment.id),
  lineItemId: adjustment.lineItemId
    ? createCartLineItemId(adjustment.lineItemId)
    : null,
  updatedAt: new Date(adjustment.updatedAt),
});

const deserializeAggregate = (
  aggregate: StoredCartAggregate
): CartAggregate => ({
  adjustments: aggregate.adjustments.map(deserializeAdjustment),
  cart: deserializeCart(aggregate.cart),
  lineItems: aggregate.lineItems.map(deserializeLineItem),
});

const requestCartCache = async <Output>({
  cartId,
  namespace,
  operation,
}: {
  readonly cartId: CartId;
  readonly namespace: DurableObjectNamespace;
  readonly operation: unknown;
}): Promise<Output> => {
  const stub = namespace.getByName(createCartCacheDurableObjectName(cartId));
  const response = await stub.fetch(
    new Request("https://cart-cache.internal/cache", {
      body: JSON.stringify(operation),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    })
  );
  const body = (await response.json()) as CloudflareCartCacheResponse<Output>;

  if (response.status === 403) {
    throw new CartCacheOwnershipError({
      message: body.error ?? "Cart cache access denied.",
    });
  }

  if (!response.ok) {
    throw new Error(`Cart cache rejected operation with ${response.status}.`);
  }

  return body.output;
};

const toCartCacheFailure = (error: unknown) =>
  error instanceof CartCacheOwnershipError
    ? error
    : new CartValidationFailure({
        message:
          error instanceof Error
            ? error.message
            : "Cart cache operation failed.",
      });

const requestCartCacheEffect = <Output>(
  input: Parameters<typeof requestCartCache<Output>>[0]
) =>
  Effect.tryPromise({
    catch: toCartCacheFailure,
    try: () => requestCartCache<Output>(input),
  });

export const createCloudflareCartActiveCache = ({
  namespace,
}: CloudflareCartCacheOptions): CartActiveCache => ({
  findAdjustmentByIdempotencyKey: () => Effect.succeed(null),
  findCartById: ({ id, scope }) =>
    requestCartCacheEffect<StoredCartRecord | null>({
      cartId: id,
      namespace,
      operation: {
        cartId: id,
        scope,
        type: "findCartById",
      },
    }).pipe(Effect.map((cart) => (cart ? deserializeCart(cart) : null))),
  findLineItemById: ({ id, cartId, scope }) => {
    if (!cartId) {
      return Effect.succeed(null);
    }

    return requestCartCacheEffect<StoredLineItemRecord | null>({
      cartId,
      namespace,
      operation: {
        cartId,
        id,
        scope,
        type: "findLineItemById",
      },
    }).pipe(Effect.map((item) => (item ? deserializeLineItem(item) : null)));
  },
  findLineItemByIdempotencyKey: () => Effect.succeed(null),
  getCartAggregate: ({ id, scope }) =>
    requestCartCacheEffect<StoredCartAggregate | null>({
      cartId: id,
      namespace,
      operation: {
        cartId: id,
        scope,
        type: "getCartAggregate",
      },
    }).pipe(
      Effect.map((aggregate) =>
        aggregate ? deserializeAggregate(aggregate) : null
      )
    ),
  hydrateCartAggregate: ({ aggregate, scope }) =>
    requestCartCacheEffect<null>({
      cartId: aggregate.cart.id,
      namespace,
      operation: {
        aggregate: serializeAggregate(aggregate),
        scope,
        type: "hydrateCartAggregate",
      },
    }).pipe(Effect.asVoid),
  recordProjectionSyncFailure: (failure) =>
    requestCartCacheEffect<null>({
      cartId: failure.cartId,
      namespace,
      operation: {
        cartId: failure.cartId,
        failedAt: failure.failedAt.toISOString(),
        reason: failure.reason,
        scope: failure.scope,
        type: "recordProjectionSyncFailure",
      },
    }).pipe(Effect.asVoid),
  removeLineItem: ({ cartId, id, scope }) => {
    if (!cartId) {
      return Effect.succeed(null);
    }

    return requestCartCacheEffect<StoredCartAggregate | null>({
      cartId,
      namespace,
      operation: {
        cartId,
        id,
        scope,
        type: "removeLineItem",
      },
    }).pipe(
      Effect.map((aggregate) =>
        aggregate ? deserializeAggregate(aggregate) : null
      )
    );
  },
  saveAdjustment: ({ adjustment, idempotencyKey, scope }) =>
    requestCartCacheEffect<StoredAdjustmentRecord>({
      cartId: adjustment.cartId,
      namespace,
      operation: {
        adjustment: serializeAdjustment(adjustment),
        idempotencyKey,
        scope,
        type: "saveAdjustment",
      },
    }).pipe(Effect.map(deserializeAdjustment)),
  saveCart: ({ cart, scope }) =>
    requestCartCacheEffect<StoredCartRecord>({
      cartId: cart.id,
      namespace,
      operation: {
        cart: serializeCart(cart),
        scope,
        type: "saveCart",
      },
    }).pipe(Effect.map(deserializeCart)),
  saveLineItem: ({ idempotencyKey, item, scope }) =>
    requestCartCacheEffect<StoredLineItemRecord>({
      cartId: item.cartId,
      namespace,
      operation: {
        idempotencyKey,
        item: serializeLineItem(item),
        scope,
        type: "saveLineItem",
      },
    }).pipe(Effect.map(deserializeLineItem)),
});

export const createCloudflareCartCacheRepository = ({
  namespace,
  onProjectionSyncFailure,
  projectionSyncFailureMode,
  projectionRepository,
  scope,
}: CloudflareCartCacheRepositoryOptions): CartRepository =>
  createCachedCartRepository({
    cache: createCloudflareCartActiveCache({ namespace }),
    onProjectionSyncFailure,
    projectionSyncFailureMode,
    projectionRepository,
    scope,
  });

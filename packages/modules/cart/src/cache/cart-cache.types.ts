import type { Effect as EffectValue } from "effect/Effect";

import type {
  CartAdjustmentRecord,
  CartAggregate,
  CartId,
  CartExpectedError,
  CartLineItemId,
  CartLineItemRecord,
  CartRecord,
  CartRepository,
} from "../domain";
import { CartCacheOwnershipError } from "../domain/cart.errors";

export type CartOwnershipScope =
  | {
      readonly id: string;
      readonly type: "customer";
    }
  | {
      readonly id: string;
      readonly type: "system";
    }
  | {
      readonly id: string;
      readonly type: "visitor";
    };

export interface CartScopedCacheInput {
  readonly scope: CartOwnershipScope;
}

export interface CartProjectionSyncFailure {
  readonly cartId: CartId;
  readonly failedAt: Date;
  readonly reason: string;
  readonly scope: CartOwnershipScope;
}

export interface CartProjectionSyncPort {
  readonly syncCartProjection: (input: {
    readonly aggregate: CartAggregate;
    readonly repository: CartRepository;
  }) => EffectValue<void, CartExpectedError>;
}

export const isCartCacheOwnershipError = (
  error: unknown
): error is CartCacheOwnershipError =>
  error instanceof CartCacheOwnershipError ||
  (typeof error === "object" &&
    error !== null &&
    "_tag" in error &&
    error._tag === "CartCacheOwnershipError");

/**
 * Runtime-neutral active cart cache port. Cloudflare Durable Objects implement
 * this from `packages/platform-cloudflare`; tests can use the in-memory adapter.
 */
export interface CartActiveCache {
  /**
   * Marks a cart mutation as active for the ownership scope and makes cached
   * aggregate reads stale until a committed projection is hydrated again.
   */
  readonly beginMutation: (input: {
    readonly cartId: CartId;
    readonly mutationId: string;
    readonly scope: CartOwnershipScope;
  }) => EffectValue<void, CartExpectedError>;
  /**
   * Clears the mutation marker for this `mutationId`. The cart remains stale
   * while other mutations are active; after the final mutation completes,
   * aggregate reads may use the cache again and hydration may resume.
   */
  readonly completeMutation: (input: {
    readonly cartId: CartId;
    readonly mutationId: string;
    readonly scope: CartOwnershipScope;
  }) => EffectValue<void, CartExpectedError>;
  /**
   * Looks up an adjustment idempotency record visible to `scope`. When `cartId`
   * is provided, a cached hit is valid only for that cart; omitting it treats
   * the idempotency key as the lookup scope.
   */
  readonly findAdjustmentByIdempotencyKey: (input: {
    readonly cartId?: CartId;
    readonly idempotencyKey: string;
    readonly scope: CartOwnershipScope;
  }) => EffectValue<CartAdjustmentRecord | null, CartExpectedError>;
  readonly findCartById: (input: {
    readonly id: CartId;
    readonly scope: CartOwnershipScope;
  }) => EffectValue<CartRecord | null, CartExpectedError>;
  readonly findLineItemById: (input: {
    readonly id: CartLineItemId;
    readonly cartId?: CartId;
    readonly scope: CartOwnershipScope;
  }) => EffectValue<CartLineItemRecord | null, CartExpectedError>;
  /**
   * Looks up a line-item idempotency record visible to `scope`. When `cartId` is
   * provided, a cached hit is valid only for that cart; omitting it treats the
   * idempotency key as the lookup scope.
   */
  readonly findLineItemByIdempotencyKey: (input: {
    readonly cartId?: CartId;
    readonly idempotencyKey: string;
    readonly scope: CartOwnershipScope;
  }) => EffectValue<CartLineItemRecord | null, CartExpectedError>;
  readonly getCartAggregate: (input: {
    readonly id: CartId;
    readonly scope: CartOwnershipScope;
  }) => EffectValue<CartAggregate | null, CartExpectedError>;
  readonly hydrateCartAggregate: (input: {
    readonly aggregate: CartAggregate;
    readonly scope: CartOwnershipScope;
  }) => EffectValue<void, CartExpectedError>;
  readonly recordProjectionSyncFailure?: (
    failure: CartProjectionSyncFailure
  ) => EffectValue<void, CartExpectedError>;
  readonly removeLineItem: (input: {
    readonly cartId?: CartId;
    readonly id: CartLineItemId;
    readonly scope: CartOwnershipScope;
  }) => EffectValue<CartAggregate | null, CartExpectedError>;
  readonly saveAdjustment: (input: {
    readonly adjustment: CartAdjustmentRecord;
    readonly idempotencyKey: string;
    readonly scope: CartOwnershipScope;
  }) => EffectValue<CartAdjustmentRecord, CartExpectedError>;
  readonly saveCart: (input: {
    readonly cart: CartRecord;
    readonly scope: CartOwnershipScope;
  }) => EffectValue<CartRecord, CartExpectedError>;
  readonly saveLineItem: (input: {
    readonly idempotencyKey?: string;
    readonly item: CartLineItemRecord;
    readonly scope: CartOwnershipScope;
  }) => EffectValue<CartLineItemRecord, CartExpectedError>;
}

export const createCustomerCartScope = (id: string): CartOwnershipScope => ({
  id,
  type: "customer",
});

export const createSystemCartScope = (
  id = "cart-runtime"
): CartOwnershipScope => ({
  id,
  type: "system",
});

export const createVisitorCartScope = (id: string): CartOwnershipScope => ({
  id,
  type: "visitor",
});

export const serializeCartOwnershipScope = (
  scope: CartOwnershipScope
): string => `${scope.type}:${scope.id}`;

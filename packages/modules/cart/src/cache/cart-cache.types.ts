import type {
  CartAdjustmentRecord,
  CartAggregate,
  CartId,
  CartLineItemId,
  CartLineItemRecord,
  CartRecord,
  CartRepository,
} from "../domain";

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
  syncCartProjection(input: {
    readonly aggregate: CartAggregate;
    readonly repository: CartRepository;
  }): Promise<void>;
}

export class CartCacheOwnershipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CartCacheOwnershipError";
  }
}

export const isCartCacheOwnershipError = (
  error: unknown
): error is CartCacheOwnershipError => error instanceof CartCacheOwnershipError;

/**
 * Runtime-neutral active cart cache port. Cloudflare Durable Objects implement
 * this from `packages/platform-cloudflare`; tests can use the in-memory adapter.
 */
export interface CartActiveCache {
  findAdjustmentByIdempotencyKey(input: {
    readonly idempotencyKey: string;
    readonly scope: CartOwnershipScope;
  }): Promise<CartAdjustmentRecord | null>;
  findCartById(input: {
    readonly id: CartId;
    readonly scope: CartOwnershipScope;
  }): Promise<CartRecord | null>;
  findLineItemById(input: {
    readonly id: CartLineItemId;
    readonly cartId?: CartId;
    readonly scope: CartOwnershipScope;
  }): Promise<CartLineItemRecord | null>;
  findLineItemByIdempotencyKey(input: {
    readonly idempotencyKey: string;
    readonly scope: CartOwnershipScope;
  }): Promise<CartLineItemRecord | null>;
  getCartAggregate(input: {
    readonly id: CartId;
    readonly scope: CartOwnershipScope;
  }): Promise<CartAggregate | null>;
  hydrateCartAggregate(input: {
    readonly aggregate: CartAggregate;
    readonly scope: CartOwnershipScope;
  }): Promise<void>;
  recordProjectionSyncFailure?(
    failure: CartProjectionSyncFailure
  ): Promise<void>;
  removeLineItem(input: {
    readonly cartId?: CartId;
    readonly id: CartLineItemId;
    readonly scope: CartOwnershipScope;
  }): Promise<CartAggregate | null>;
  saveAdjustment(input: {
    readonly adjustment: CartAdjustmentRecord;
    readonly idempotencyKey: string;
    readonly scope: CartOwnershipScope;
  }): Promise<CartAdjustmentRecord>;
  saveCart(input: {
    readonly cart: CartRecord;
    readonly scope: CartOwnershipScope;
  }): Promise<CartRecord>;
  saveLineItem(input: {
    readonly idempotencyKey?: string;
    readonly item: CartLineItemRecord;
    readonly scope: CartOwnershipScope;
  }): Promise<CartLineItemRecord>;
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

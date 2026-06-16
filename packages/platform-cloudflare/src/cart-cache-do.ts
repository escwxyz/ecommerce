import type { CartOwnershipScope } from "@ecommerce/cart/cache";
import {
  CartCacheOwnershipError,
  serializeCartOwnershipScope,
} from "@ecommerce/cart/cache";
import type {
  CartAdjustmentRecord,
  CartLineItemRecord,
  CartRecord,
} from "@ecommerce/cart/domain";
import { DurableObject } from "cloudflare:workers";

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

interface StoredAggregate {
  adjustments: Record<string, StoredAdjustmentRecord>;
  cart: StoredCartRecord | null;
  lineItems: Record<string, StoredLineItemRecord>;
}

type CartCacheOperation =
  | {
      readonly aggregate: StoredCartAggregate;
      readonly scope: CartOwnershipScope;
      readonly type: "hydrateCartAggregate";
    }
  | {
      readonly cart: StoredCartRecord;
      readonly scope: CartOwnershipScope;
      readonly type: "saveCart";
    }
  | {
      readonly cartId: string;
      readonly scope: CartOwnershipScope;
      readonly type: "findCartById" | "getCartAggregate";
    }
  | {
      readonly cartId: string;
      readonly id: string;
      readonly scope: CartOwnershipScope;
      readonly type: "removeLineItem";
    }
  | {
      readonly id: string;
      readonly scope: CartOwnershipScope;
      readonly type: "findLineItemById";
    }
  | {
      readonly idempotencyKey: string;
      readonly scope: CartOwnershipScope;
      readonly type:
        | "findAdjustmentByIdempotencyKey"
        | "findLineItemByIdempotencyKey";
    }
  | {
      readonly idempotencyKey?: string;
      readonly item: StoredLineItemRecord;
      readonly scope: CartOwnershipScope;
      readonly type: "saveLineItem";
    }
  | {
      readonly adjustment: StoredAdjustmentRecord;
      readonly idempotencyKey: string;
      readonly scope: CartOwnershipScope;
      readonly type: "saveAdjustment";
    }
  | {
      readonly cartId: string;
      readonly failedAt: string;
      readonly reason: string;
      readonly scope: CartOwnershipScope;
      readonly type: "recordProjectionSyncFailure";
    };

interface StoredCartAggregate {
  readonly adjustments: readonly StoredAdjustmentRecord[];
  readonly cart: StoredCartRecord;
  readonly lineItems: readonly StoredLineItemRecord[];
}

const aggregateStorageKey = "aggregate";
const ownerStorageKey = "owner";
const adjustmentIdempotencyStorageKey = "adjustment-idempotency";
const lineItemIdempotencyStorageKey = "line-item-idempotency";
const projectionFailuresStorageKey = "projection-failures";

const emptyAggregate = (): StoredAggregate => ({
  adjustments: {},
  cart: null,
  lineItems: {},
});

const isSameScope = (
  current: CartOwnershipScope,
  next: CartOwnershipScope
): boolean => current.type === next.type && current.id === next.id;

const canClaimScope = (
  current: CartOwnershipScope,
  next: CartOwnershipScope
): boolean => current.type === "visitor" && next.type === "customer";

const canAccessScope = (
  current: CartOwnershipScope,
  requested: CartOwnershipScope
): boolean => requested.type === "system" || isSameScope(current, requested);

const ownerFromCart = (
  cart: StoredCartRecord,
  fallback: CartOwnershipScope
): CartOwnershipScope =>
  fallback.type === "system" && cart.customerId
    ? { id: cart.customerId, type: "customer" }
    : fallback;

const toStoredCartAggregate = (
  aggregate: StoredAggregate
): StoredCartAggregate | null =>
  aggregate.cart
    ? {
        adjustments: Object.values(aggregate.adjustments),
        cart: aggregate.cart,
        lineItems: Object.values(aggregate.lineItems),
      }
    : null;

/**
 * Durable Object host for active cart cache state. D1 remains the projection
 * store; this object stores the hot cart aggregate, ownership scope, and retry
 * metadata needed when projection sync fails after a mutation is accepted.
 */
export class CartCacheDurableObject extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    try {
      const operation = (await request.json()) as CartCacheOperation;
      const output = await this.#handleOperation(operation);

      return Response.json({ output });
    } catch (error) {
      if (error instanceof CartCacheOwnershipError) {
        return Response.json({ error: error.message }, { status: 403 });
      }

      throw error;
    }
  }

  async #handleOperation(operation: CartCacheOperation): Promise<unknown> {
    switch (operation.type) {
      case "findAdjustmentByIdempotencyKey": {
        return this.#findAdjustmentByIdempotencyKey(operation);
      }
      case "findCartById": {
        const aggregate = await this.#getAccessibleAggregate(
          operation.cartId,
          operation.scope
        );

        return aggregate?.cart ?? null;
      }
      case "findLineItemById": {
        return this.#findLineItemById(operation);
      }
      case "findLineItemByIdempotencyKey": {
        return this.#findLineItemByIdempotencyKey(operation);
      }
      case "getCartAggregate": {
        return this.#getAccessibleAggregate(operation.cartId, operation.scope);
      }
      case "hydrateCartAggregate": {
        await this.#hydrateCartAggregate(operation);
        return null;
      }
      case "recordProjectionSyncFailure": {
        await this.#recordProjectionSyncFailure(operation);
        return null;
      }
      case "removeLineItem": {
        return this.#removeLineItem(operation);
      }
      case "saveAdjustment": {
        return this.#saveAdjustment(operation);
      }
      case "saveCart": {
        return this.#saveCart(operation);
      }
      case "saveLineItem": {
        return this.#saveLineItem(operation);
      }
      default: {
        throw new Error(`Unsupported cart cache operation.`);
      }
    }
  }

  async #assertAccess(scope: CartOwnershipScope): Promise<void> {
    const owner =
      await this.ctx.storage.get<CartOwnershipScope>(ownerStorageKey);

    if (owner && !canAccessScope(owner, scope)) {
      throw new CartCacheOwnershipError(
        `Cart is owned by ${serializeCartOwnershipScope(owner)}.`
      );
    }
  }

  async #assignOwner(
    cart: StoredCartRecord,
    scope: CartOwnershipScope
  ): Promise<void> {
    const current =
      await this.ctx.storage.get<CartOwnershipScope>(ownerStorageKey);
    const next = ownerFromCart(cart, scope);

    if (
      current &&
      !canAccessScope(current, next) &&
      !canClaimScope(current, next)
    ) {
      throw new CartCacheOwnershipError(
        `Cart is owned by ${serializeCartOwnershipScope(current)}.`
      );
    }

    await this.ctx.storage.put(ownerStorageKey, next);
  }

  async #findAdjustmentByIdempotencyKey({
    idempotencyKey,
    scope,
  }: {
    readonly idempotencyKey: string;
    readonly scope: CartOwnershipScope;
  }): Promise<StoredAdjustmentRecord | null> {
    await this.#assertAccess(scope);
    const idempotency =
      (await this.ctx.storage.get<Record<string, string>>(
        adjustmentIdempotencyStorageKey
      )) ?? {};
    const adjustmentId = idempotency[idempotencyKey];

    if (!adjustmentId) {
      return null;
    }

    const aggregate = await this.#readAggregate();

    return aggregate.adjustments[adjustmentId] ?? null;
  }

  async #findLineItemById({
    id,
    scope,
  }: Extract<
    CartCacheOperation,
    { readonly type: "findLineItemById" }
  >): Promise<StoredLineItemRecord | null> {
    await this.#assertAccess(scope);
    const aggregate = await this.#readAggregate();

    return aggregate.lineItems[id] ?? null;
  }

  async #findLineItemByIdempotencyKey({
    idempotencyKey,
    scope,
  }: {
    readonly idempotencyKey: string;
    readonly scope: CartOwnershipScope;
  }): Promise<StoredLineItemRecord | null> {
    await this.#assertAccess(scope);
    const idempotency =
      (await this.ctx.storage.get<Record<string, string>>(
        lineItemIdempotencyStorageKey
      )) ?? {};
    const itemId = idempotency[idempotencyKey];

    if (!itemId) {
      return null;
    }

    const aggregate = await this.#readAggregate();

    return aggregate.lineItems[itemId] ?? null;
  }

  async #getAccessibleAggregate(
    _cartId: string,
    scope: CartOwnershipScope
  ): Promise<StoredCartAggregate | null> {
    await this.#assertAccess(scope);

    return toStoredCartAggregate(await this.#readAggregate());
  }

  async #hydrateCartAggregate({
    aggregate,
    scope,
  }: Extract<
    CartCacheOperation,
    { readonly type: "hydrateCartAggregate" }
  >): Promise<void> {
    await this.#assignOwner(aggregate.cart, scope);
    await this.ctx.storage.put(aggregateStorageKey, {
      adjustments: Object.fromEntries(
        aggregate.adjustments.map((adjustment) => [adjustment.id, adjustment])
      ),
      cart: aggregate.cart,
      lineItems: Object.fromEntries(
        aggregate.lineItems.map((item) => [item.id, item])
      ),
    } satisfies StoredAggregate);
  }

  async #readAggregate(): Promise<StoredAggregate> {
    return (
      (await this.ctx.storage.get<StoredAggregate>(aggregateStorageKey)) ??
      emptyAggregate()
    );
  }

  async #recordProjectionSyncFailure({
    cartId,
    failedAt,
    reason,
    scope,
  }: Extract<
    CartCacheOperation,
    { readonly type: "recordProjectionSyncFailure" }
  >): Promise<void> {
    await this.#assertAccess(scope);
    const failures =
      (await this.ctx.storage.get<readonly unknown[]>(
        projectionFailuresStorageKey
      )) ?? [];
    await this.ctx.storage.put(projectionFailuresStorageKey, [
      ...failures,
      { cartId, failedAt, reason, scope },
    ]);
  }

  async #removeLineItem({
    id,
    scope,
  }: Extract<
    CartCacheOperation,
    { readonly type: "removeLineItem" }
  >): Promise<StoredCartAggregate | null> {
    await this.#assertAccess(scope);
    const aggregate = await this.#readAggregate();

    aggregate.lineItems = Object.fromEntries(
      Object.entries(aggregate.lineItems).filter(([itemId]) => itemId !== id)
    );
    await this.ctx.storage.put(aggregateStorageKey, aggregate);

    return toStoredCartAggregate(aggregate);
  }

  async #saveAdjustment({
    adjustment,
    idempotencyKey,
    scope,
  }: Extract<
    CartCacheOperation,
    { readonly type: "saveAdjustment" }
  >): Promise<StoredAdjustmentRecord> {
    await this.#assertAccess(scope);
    const aggregate = await this.#readAggregate();
    const idempotency =
      (await this.ctx.storage.get<Record<string, string>>(
        adjustmentIdempotencyStorageKey
      )) ?? {};
    const duplicateId = idempotency[idempotencyKey];

    if (duplicateId && aggregate.adjustments[duplicateId]) {
      return aggregate.adjustments[duplicateId];
    }

    aggregate.adjustments[adjustment.id] = adjustment;
    await this.ctx.storage.put(aggregateStorageKey, aggregate);
    await this.ctx.storage.put(adjustmentIdempotencyStorageKey, {
      ...idempotency,
      [idempotencyKey]: adjustment.id,
    });

    return adjustment;
  }

  async #saveCart({
    cart,
    scope,
  }: Extract<
    CartCacheOperation,
    { readonly type: "saveCart" }
  >): Promise<StoredCartRecord> {
    await this.#assignOwner(cart, scope);
    const aggregate = await this.#readAggregate();
    aggregate.cart = cart;
    await this.ctx.storage.put(aggregateStorageKey, aggregate);

    return cart;
  }

  async #saveLineItem({
    idempotencyKey,
    item,
    scope,
  }: Extract<
    CartCacheOperation,
    { readonly type: "saveLineItem" }
  >): Promise<StoredLineItemRecord> {
    await this.#assertAccess(scope);
    const aggregate = await this.#readAggregate();
    const idempotency =
      (await this.ctx.storage.get<Record<string, string>>(
        lineItemIdempotencyStorageKey
      )) ?? {};
    const duplicateId = idempotencyKey ? idempotency[idempotencyKey] : null;

    if (duplicateId && aggregate.lineItems[duplicateId]) {
      return aggregate.lineItems[duplicateId];
    }

    aggregate.lineItems[item.id] = item;
    await this.ctx.storage.put(aggregateStorageKey, aggregate);

    if (idempotencyKey) {
      await this.ctx.storage.put(lineItemIdempotencyStorageKey, {
        ...idempotency,
        [idempotencyKey]: item.id,
      });
    }

    return item;
  }
}

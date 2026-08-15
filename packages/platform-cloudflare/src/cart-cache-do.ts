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

import {
  createCartMutationLease,
  pruneCartMutationLeases,
} from "./cart-cache-lease";
import type { StoredCartMutationLeases } from "./cart-cache-lease";

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
      readonly cartId: string;
      readonly mutationId: string;
      readonly scope: CartOwnershipScope;
      readonly type: "beginMutation" | "completeMutation";
    }
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
const activeMutationsStorageKey = "active-mutations";
const aggregateStaleStorageKey = "aggregate-stale";

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

const resolveHydratedOwner = (
  cart: StoredCartRecord,
  scope: CartOwnershipScope
): CartOwnershipScope => {
  if (cart.customerId) {
    if (
      scope.type === "system" ||
      (scope.type === "customer" && scope.id === cart.customerId)
    ) {
      return { id: cart.customerId, type: "customer" };
    }

    throw new CartCacheOwnershipError({
      message: `Cart "${cart.id}" is owned by customer:${cart.customerId}.`,
    });
  }

  if (scope.type === "customer") {
    throw new CartCacheOwnershipError({
      message: `Cart "${cart.id}" is not assigned to an authenticated customer.`,
    });
  }

  return scope;
};

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
 * Durable Object host for active cart cache state. PostgreSQL remains the
 * authoritative projection store; this object owns only the hot aggregate,
 * ownership scope, idempotency indexes, and projection-sync coordination.
 * Actor-local state must remain disposable and recoverable from PostgreSQL.
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
      case "beginMutation": {
        await this.#beginMutation(operation);
        return null;
      }
      case "completeMutation": {
        await this.#completeMutation(operation);
        return null;
      }
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
      throw new CartCacheOwnershipError({
        message: `Cart is owned by ${serializeCartOwnershipScope(owner)}.`,
      });
    }
  }

  async #beginMutation({
    mutationId,
    scope,
  }: Extract<
    CartCacheOperation,
    { readonly type: "beginMutation" | "completeMutation" }
  >): Promise<void> {
    await this.#assertAccess(scope);
    const active = await this.#readActiveMutations();
    const now = Date.now();
    await this.ctx.storage.put(activeMutationsStorageKey, {
      ...active.entries,
      [mutationId]: createCartMutationLease(now),
    });
    await this.ctx.storage.put(aggregateStaleStorageKey, true);
  }

  async #completeMutation({
    mutationId,
    scope,
  }: Extract<
    CartCacheOperation,
    { readonly type: "beginMutation" | "completeMutation" }
  >): Promise<void> {
    await this.#assertAccess(scope);
    const active = await this.#readActiveMutations();
    const remaining = Object.fromEntries(
      Object.entries(active.entries).filter(
        ([activeId]) => activeId !== mutationId
      )
    );
    await this.ctx.storage.put(activeMutationsStorageKey, remaining);
    await this.ctx.storage.put(
      aggregateStaleStorageKey,
      Object.keys(remaining).length > 0
    );
  }

  async #assignOwner(
    cart: StoredCartRecord,
    scope: CartOwnershipScope
  ): Promise<void> {
    const current =
      await this.ctx.storage.get<CartOwnershipScope>(ownerStorageKey);
    const next = resolveHydratedOwner(cart, scope);

    if (
      current &&
      !canAccessScope(current, next) &&
      !canClaimScope(current, next)
    ) {
      throw new CartCacheOwnershipError({
        message: `Cart is owned by ${serializeCartOwnershipScope(current)}.`,
      });
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
    await this.#readActiveMutations();

    if (await this.ctx.storage.get<boolean>(aggregateStaleStorageKey)) {
      return null;
    }

    return toStoredCartAggregate(await this.#readAggregate());
  }

  async #hydrateCartAggregate({
    aggregate,
    scope,
  }: Extract<
    CartCacheOperation,
    { readonly type: "hydrateCartAggregate" }
  >): Promise<void> {
    const active = await this.#readActiveMutations();
    if (active.hasActive) {
      return;
    }

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
    await this.ctx.storage.put(aggregateStaleStorageKey, false);
  }

  async #readAggregate(): Promise<StoredAggregate> {
    return (
      (await this.ctx.storage.get<StoredAggregate>(aggregateStorageKey)) ??
      emptyAggregate()
    );
  }

  async #readActiveMutations(): Promise<
    ReturnType<typeof pruneCartMutationLeases>
  > {
    const stored =
      (await this.ctx.storage.get<StoredCartMutationLeases>(
        activeMutationsStorageKey
      )) ?? {};
    const active = pruneCartMutationLeases(stored, Date.now());

    if (active.expiredAny) {
      await this.ctx.storage.put(activeMutationsStorageKey, active.entries);

      if (!active.hasActive) {
        await this.ctx.storage.put(aggregateStaleStorageKey, false);
      }
    }

    return active;
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

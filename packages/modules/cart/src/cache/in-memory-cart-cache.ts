import type {
  CartAdjustmentRecord,
  CartAggregate,
  CartId,
  CartLineItemId,
  CartLineItemRecord,
  CartRecord,
} from "../domain";
import { createInMemoryCartRepository } from "../repositories";
import type { CartActiveCache, CartOwnershipScope } from "./cart-cache.types";
import {
  CartCacheOwnershipError,
  serializeCartOwnershipScope,
} from "./cart-cache.types";

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

const scopeFromCart = (
  cart: CartRecord,
  fallback: CartOwnershipScope
): CartOwnershipScope =>
  fallback.type === "system" && cart.customerId
    ? { id: cart.customerId, type: "customer" }
    : fallback;

export class InMemoryCartActiveCache implements CartActiveCache {
  readonly #adjustmentIdempotency = new Map<string, CartAdjustmentRecord>();
  readonly #lineItemIdempotency = new Map<string, CartLineItemRecord>();
  readonly #owners = new Map<string, CartOwnershipScope>();
  readonly #repository = createInMemoryCartRepository();

  findAdjustmentByIdempotencyKey({
    idempotencyKey,
    scope,
  }: {
    readonly idempotencyKey: string;
    readonly scope: CartOwnershipScope;
  }): Promise<CartAdjustmentRecord | null> {
    const adjustment = this.#adjustmentIdempotency.get(idempotencyKey) ?? null;

    if (!adjustment) {
      return Promise.resolve(null);
    }

    this.#assertCartAccess(adjustment.cartId, scope);

    return Promise.resolve(adjustment);
  }

  findCartById({
    id,
    scope,
  }: {
    readonly id: CartId;
    readonly scope: CartOwnershipScope;
  }): Promise<CartRecord | null> {
    this.#assertCartAccess(id, scope);

    return this.#repository.findCartById(id);
  }

  async findLineItemById({
    id,
    scope,
  }: {
    readonly id: CartLineItemId;
    readonly scope: CartOwnershipScope;
  }): Promise<CartLineItemRecord | null> {
    const item = await this.#repository.findLineItemById(id);

    if (!item) {
      return null;
    }

    this.#assertCartAccess(item.cartId, scope);

    return item;
  }

  findLineItemByIdempotencyKey({
    idempotencyKey,
    scope,
  }: {
    readonly idempotencyKey: string;
    readonly scope: CartOwnershipScope;
  }): Promise<CartLineItemRecord | null> {
    const item = this.#lineItemIdempotency.get(idempotencyKey) ?? null;

    if (!item) {
      return Promise.resolve(null);
    }

    this.#assertCartAccess(item.cartId, scope);

    return Promise.resolve(item);
  }

  getCartAggregate({
    id,
    scope,
  }: {
    readonly id: CartId;
    readonly scope: CartOwnershipScope;
  }): Promise<CartAggregate | null> {
    this.#assertCartAccess(id, scope);

    return this.#repository.getCartAggregate(id);
  }

  async hydrateCartAggregate({
    aggregate,
    scope,
  }: {
    readonly aggregate: CartAggregate;
    readonly scope: CartOwnershipScope;
  }): Promise<void> {
    await this.#upsertAggregate(aggregate, scope);
  }

  async removeLineItem({
    id,
    scope,
  }: {
    readonly id: CartLineItemId;
    readonly scope: CartOwnershipScope;
  }): Promise<CartAggregate | null> {
    const item = await this.findLineItemById({ id, scope });

    if (!item) {
      return null;
    }

    await this.#repository.removeLineItem(id);

    return this.#repository.getCartAggregate(item.cartId);
  }

  async saveAdjustment({
    adjustment,
    idempotencyKey,
    scope,
  }: {
    readonly adjustment: CartAdjustmentRecord;
    readonly idempotencyKey: string;
    readonly scope: CartOwnershipScope;
  }): Promise<CartAdjustmentRecord> {
    const duplicate = await this.findAdjustmentByIdempotencyKey({
      idempotencyKey,
      scope,
    });

    if (duplicate) {
      return duplicate;
    }

    this.#assertCartAccess(adjustment.cartId, scope);
    const saved = await this.#repository.saveAdjustment(
      adjustment,
      idempotencyKey
    );
    this.#adjustmentIdempotency.set(idempotencyKey, saved);

    return saved;
  }

  saveCart({
    cart,
    scope,
  }: {
    readonly cart: CartRecord;
    readonly scope: CartOwnershipScope;
  }): Promise<CartRecord> {
    this.#assignOwner(cart, scope);

    return this.#repository.saveCart(cart);
  }

  async saveLineItem({
    idempotencyKey,
    item,
    scope,
  }: {
    readonly idempotencyKey?: string;
    readonly item: CartLineItemRecord;
    readonly scope: CartOwnershipScope;
  }): Promise<CartLineItemRecord> {
    if (idempotencyKey) {
      const duplicate = await this.findLineItemByIdempotencyKey({
        idempotencyKey,
        scope,
      });

      if (duplicate) {
        return duplicate;
      }
    }

    this.#assertCartAccess(item.cartId, scope);
    const saved = await this.#repository.saveLineItem(item, idempotencyKey);

    if (idempotencyKey) {
      this.#lineItemIdempotency.set(idempotencyKey, saved);
    }

    return saved;
  }

  #assertCartAccess(cartId: CartId, scope: CartOwnershipScope): void {
    if (!this.#canAccessCart(cartId, scope)) {
      throw new CartCacheOwnershipError(
        `Cart "${cartId}" is not accessible for ${serializeCartOwnershipScope(
          scope
        )}.`
      );
    }
  }

  #assignOwner(cart: CartRecord, scope: CartOwnershipScope): void {
    const nextOwner = scopeFromCart(cart, scope);
    const currentOwner = this.#owners.get(cart.id);

    if (
      currentOwner &&
      !canAccessScope(currentOwner, nextOwner) &&
      !canClaimScope(currentOwner, nextOwner)
    ) {
      throw new CartCacheOwnershipError(
        `Cart "${cart.id}" is owned by ${serializeCartOwnershipScope(
          currentOwner
        )}.`
      );
    }

    this.#owners.set(cart.id, nextOwner);
  }

  #canAccessCart(cartId: CartId, scope: CartOwnershipScope): boolean {
    const owner = this.#owners.get(cartId);

    return !owner || canAccessScope(owner, scope);
  }

  async #upsertAggregate(
    aggregate: CartAggregate,
    scope: CartOwnershipScope
  ): Promise<void> {
    await this.saveCart({ cart: aggregate.cart, scope });

    for (const item of aggregate.lineItems) {
      await this.saveLineItem({ item, scope });
    }

    for (const adjustment of aggregate.adjustments) {
      await this.saveAdjustment({
        adjustment,
        idempotencyKey: `projection:${adjustment.id}`,
        scope,
      });
    }
  }
}

export const createInMemoryCartActiveCache = (): CartActiveCache =>
  new InMemoryCartActiveCache();

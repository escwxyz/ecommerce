import { Effect } from "effect";
import type { Effect as EffectValue } from "effect/Effect";

import { CartCacheOwnershipError } from "../domain";
import type {
  CartAdjustmentRecord,
  CartAggregate,
  CartExpectedError,
  CartId,
  CartLineItemId,
  CartLineItemRecord,
  CartRecord,
} from "../domain";
import { createInMemoryCartRepository } from "../repositories";
import type { CartActiveCache, CartOwnershipScope } from "./cart-cache.types";
import { serializeCartOwnershipScope } from "./cart-cache.types";

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

  readonly findAdjustmentByIdempotencyKey = ({
    idempotencyKey,
    scope,
  }: {
    readonly idempotencyKey: string;
    readonly scope: CartOwnershipScope;
  }): EffectValue<CartAdjustmentRecord | null, CartExpectedError> =>
    Effect.flatMap(
      Effect.succeed(this.#adjustmentIdempotency.get(idempotencyKey) ?? null),
      (adjustment) =>
        adjustment
          ? this.#assertCartAccess(adjustment.cartId, scope).pipe(
              Effect.as(adjustment)
            )
          : Effect.succeed(null)
    );

  readonly findCartById = ({
    id,
    scope,
  }: {
    readonly id: CartId;
    readonly scope: CartOwnershipScope;
  }): EffectValue<CartRecord | null, CartExpectedError> =>
    this.#assertCartAccess(id, scope).pipe(
      Effect.flatMap(() => this.#repository.findCartById(id))
    );

  readonly findLineItemById = ({
    id,
    cartId,
    scope,
  }: {
    readonly id: CartLineItemId;
    readonly cartId?: CartId;
    readonly scope: CartOwnershipScope;
  }): EffectValue<CartLineItemRecord | null, CartExpectedError> =>
    this.#repository.findLineItemById(id).pipe(
      Effect.flatMap((item) => {
        if (!item || (cartId && item.cartId !== cartId)) {
          return Effect.succeed(null);
        }

        return this.#assertCartAccess(item.cartId, scope).pipe(Effect.as(item));
      })
    );

  readonly findLineItemByIdempotencyKey = ({
    idempotencyKey,
    scope,
  }: {
    readonly idempotencyKey: string;
    readonly scope: CartOwnershipScope;
  }): EffectValue<CartLineItemRecord | null, CartExpectedError> =>
    Effect.flatMap(
      Effect.succeed(this.#lineItemIdempotency.get(idempotencyKey) ?? null),
      (item) =>
        item
          ? this.#assertCartAccess(item.cartId, scope).pipe(Effect.as(item))
          : Effect.succeed(null)
    );

  readonly getCartAggregate = ({
    id,
    scope,
  }: {
    readonly id: CartId;
    readonly scope: CartOwnershipScope;
  }): EffectValue<CartAggregate | null, CartExpectedError> =>
    this.#assertCartAccess(id, scope).pipe(
      Effect.flatMap(() => this.#repository.getCartAggregate(id))
    );

  readonly hydrateCartAggregate = ({
    aggregate,
    scope,
  }: {
    readonly aggregate: CartAggregate;
    readonly scope: CartOwnershipScope;
  }): EffectValue<void, CartExpectedError> =>
    this.#upsertAggregate(aggregate, scope);

  readonly removeLineItem = ({
    cartId,
    id,
    scope,
  }: {
    readonly cartId?: CartId;
    readonly id: CartLineItemId;
    readonly scope: CartOwnershipScope;
  }): EffectValue<CartAggregate | null, CartExpectedError> =>
    this.findLineItemById({ cartId, id, scope }).pipe(
      Effect.flatMap((item) => {
        if (!item) {
          return Effect.succeed(null);
        }

        return this.#repository
          .removeLineItem(id)
          .pipe(
            Effect.flatMap(() => this.#repository.getCartAggregate(item.cartId))
          );
      })
    );

  readonly saveAdjustment = ({
    adjustment,
    idempotencyKey,
    scope,
  }: {
    readonly adjustment: CartAdjustmentRecord;
    readonly idempotencyKey: string;
    readonly scope: CartOwnershipScope;
  }): EffectValue<CartAdjustmentRecord, CartExpectedError> =>
    this.findAdjustmentByIdempotencyKey({ idempotencyKey, scope }).pipe(
      Effect.flatMap((duplicate) => {
        if (duplicate) {
          return Effect.succeed(duplicate);
        }

        return this.#assertCartAccess(adjustment.cartId, scope).pipe(
          Effect.flatMap(() =>
            this.#repository.saveAdjustment(adjustment, idempotencyKey)
          ),
          Effect.tap((saved) =>
            Effect.sync(() => {
              this.#adjustmentIdempotency.set(idempotencyKey, saved);
            })
          )
        );
      })
    );

  readonly saveCart = ({
    cart,
    scope,
  }: {
    readonly cart: CartRecord;
    readonly scope: CartOwnershipScope;
  }): EffectValue<CartRecord, CartExpectedError> =>
    this.#assignOwner(cart, scope).pipe(
      Effect.flatMap(() => this.#repository.saveCart(cart))
    );

  readonly saveLineItem = ({
    idempotencyKey,
    item,
    scope,
  }: {
    readonly idempotencyKey?: string;
    readonly item: CartLineItemRecord;
    readonly scope: CartOwnershipScope;
  }): EffectValue<CartLineItemRecord, CartExpectedError> => {
    const duplicate = idempotencyKey
      ? this.findLineItemByIdempotencyKey({ idempotencyKey, scope })
      : Effect.succeed(null);

    return duplicate.pipe(
      Effect.flatMap((existing) => {
        if (existing) {
          return Effect.succeed(existing);
        }

        return this.#assertCartAccess(item.cartId, scope).pipe(
          Effect.flatMap(() =>
            this.#repository.saveLineItem(item, idempotencyKey)
          ),
          Effect.tap((saved) =>
            Effect.sync(() => {
              if (idempotencyKey) {
                this.#lineItemIdempotency.set(idempotencyKey, saved);
              }
            })
          )
        );
      })
    );
  };

  #assertCartAccess(
    cartId: CartId,
    scope: CartOwnershipScope
  ): EffectValue<void, CartCacheOwnershipError> {
    return this.#canAccessCart(cartId, scope)
      ? Effect.void
      : Effect.fail(
          new CartCacheOwnershipError({
            message: `Cart "${cartId}" is not accessible for ${serializeCartOwnershipScope(
              scope
            )}.`,
          })
        );
  }

  #assignOwner(
    cart: CartRecord,
    scope: CartOwnershipScope
  ): EffectValue<void, CartCacheOwnershipError> {
    const nextOwner = scopeFromCart(cart, scope);
    const currentOwner = this.#owners.get(cart.id);

    if (
      currentOwner &&
      !canAccessScope(currentOwner, nextOwner) &&
      !canClaimScope(currentOwner, nextOwner)
    ) {
      return Effect.fail(
        new CartCacheOwnershipError({
          message: `Cart "${cart.id}" is owned by ${serializeCartOwnershipScope(
            currentOwner
          )}.`,
        })
      );
    }

    return Effect.sync(() => {
      this.#owners.set(cart.id, nextOwner);
    });
  }

  #canAccessCart(cartId: CartId, scope: CartOwnershipScope): boolean {
    const owner = this.#owners.get(cartId);

    return !owner || canAccessScope(owner, scope);
  }

  #upsertAggregate(
    aggregate: CartAggregate,
    scope: CartOwnershipScope
  ): EffectValue<void, CartExpectedError> {
    return this.#assignOwner(aggregate.cart, scope).pipe(
      Effect.flatMap(() => this.#repository.saveCart(aggregate.cart)),
      Effect.flatMap(() =>
        Effect.all(
          aggregate.lineItems.map((item) => this.#repository.saveLineItem(item))
        )
      ),
      Effect.flatMap(() =>
        Effect.all(
          aggregate.adjustments.map((adjustment) =>
            this.#repository.saveAdjustment(
              adjustment,
              `hydrate:${adjustment.id}`
            )
          )
        )
      ),
      Effect.asVoid
    );
  }
}

export const createInMemoryCartActiveCache = (): CartActiveCache =>
  new InMemoryCartActiveCache();

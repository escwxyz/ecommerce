import type {
  CartAdjustmentRecord,
  CartId,
  CartLineItemId,
  CartLineItemRecord,
  CartRecord,
  CartRepository,
} from "../domain";
import type {
  CartActiveCache,
  CartOwnershipScope,
  CartProjectionSyncFailure,
} from "./cart-cache.types";
import {
  createSystemCartScope,
  isCartCacheOwnershipError,
} from "./cart-cache.types";
import { syncCartProjection } from "./cart-projection";

export interface CreateCachedCartRepositoryOptions {
  readonly cache: CartActiveCache;
  readonly onProjectionSyncFailure?: (
    failure: CartProjectionSyncFailure
  ) => Promise<void> | void;
  readonly projectionRepository: CartRepository;
  readonly scope?: CartOwnershipScope | (() => CartOwnershipScope);
}

const resolveScope = (
  scope: CreateCachedCartRepositoryOptions["scope"]
): CartOwnershipScope =>
  typeof scope === "function" ? scope() : (scope ?? createSystemCartScope());

export const createCachedCartRepository = ({
  cache,
  onProjectionSyncFailure,
  projectionRepository,
  scope,
}: CreateCachedCartRepositoryOptions): CartRepository => {
  const getScope = () => resolveScope(scope);

  const syncProjectionAfterCacheWrite = async (
    cartId: CartId
  ): Promise<void> => {
    const currentScope = getScope();
    const aggregate = await cache.getCartAggregate({
      id: cartId,
      scope: currentScope,
    });

    if (!aggregate) {
      return;
    }

    try {
      await syncCartProjection({
        aggregate,
        repository: projectionRepository,
      });
    } catch (error) {
      const failure = {
        cartId,
        failedAt: new Date(),
        reason: error instanceof Error ? error.message : String(error),
        scope: currentScope,
      };
      await cache.recordProjectionSyncFailure?.(failure);
      await onProjectionSyncFailure?.(failure);
    }
  };

  const hydrateAggregate = async (id: CartId) => {
    const currentScope = getScope();
    let cached = null;

    try {
      cached = await cache.getCartAggregate({
        id,
        scope: currentScope,
      });
    } catch (error) {
      if (isCartCacheOwnershipError(error)) {
        return null;
      }

      throw error;
    }

    if (cached) {
      return cached;
    }

    const projected = await projectionRepository.getCartAggregate(id);

    if (!projected) {
      return null;
    }

    await cache.hydrateCartAggregate({
      aggregate: projected,
      scope: currentScope,
    });

    return projected;
  };

  return {
    findAdjustmentByIdempotencyKey: async (idempotencyKey) => {
      const currentScope = getScope();
      let cached = null;

      try {
        cached = await cache.findAdjustmentByIdempotencyKey({
          idempotencyKey,
          scope: currentScope,
        });
      } catch (error) {
        if (isCartCacheOwnershipError(error)) {
          return null;
        }

        throw error;
      }

      return (
        cached ??
        (await projectionRepository.findAdjustmentByIdempotencyKey(
          idempotencyKey
        ))
      );
    },
    findCartById: async (id) => {
      const aggregate = await hydrateAggregate(id);

      return aggregate?.cart ?? null;
    },
    findLineItemById: async (id: CartLineItemId) => {
      const currentScope = getScope();
      let cached = null;

      try {
        cached = await cache.findLineItemById({
          id,
          scope: currentScope,
        });
      } catch (error) {
        if (isCartCacheOwnershipError(error)) {
          return null;
        }

        throw error;
      }

      return cached ?? (await projectionRepository.findLineItemById(id));
    },
    findLineItemByIdempotencyKey: async (idempotencyKey) => {
      const currentScope = getScope();
      let cached = null;

      try {
        cached = await cache.findLineItemByIdempotencyKey({
          idempotencyKey,
          scope: currentScope,
        });
      } catch (error) {
        if (isCartCacheOwnershipError(error)) {
          return null;
        }

        throw error;
      }

      return (
        cached ??
        (await projectionRepository.findLineItemByIdempotencyKey(
          idempotencyKey
        ))
      );
    },
    getCartAggregate: hydrateAggregate,
    listCarts: () => projectionRepository.listCarts(),
    removeLineItem: async (id) => {
      const currentScope = getScope();
      const item =
        (await cache
          .findLineItemById({
            id,
            scope: currentScope,
          })
          .catch((error: unknown) => {
            if (isCartCacheOwnershipError(error)) {
              return null;
            }

            throw error;
          })) ?? (await projectionRepository.findLineItemById(id));
      const aggregate = await cache.removeLineItem({
        cartId: item?.cartId,
        id,
        scope: currentScope,
      });

      await projectionRepository.removeLineItem(id);

      if (aggregate) {
        await syncProjectionAfterCacheWrite(aggregate.cart.id);
      }
    },
    saveAdjustment: async (
      adjustment: CartAdjustmentRecord,
      idempotencyKey: string
    ) => {
      const saved = await cache.saveAdjustment({
        adjustment,
        idempotencyKey,
        scope: getScope(),
      });

      await syncProjectionAfterCacheWrite(saved.cartId);

      return saved;
    },
    saveCart: async (cart: CartRecord) => {
      const saved = await cache.saveCart({
        cart,
        scope: getScope(),
      });

      await syncProjectionAfterCacheWrite(saved.id);

      return saved;
    },
    saveLineItem: async (item: CartLineItemRecord, idempotencyKey?: string) => {
      const saved = await cache.saveLineItem({
        idempotencyKey,
        item,
        scope: getScope(),
      });

      await syncProjectionAfterCacheWrite(saved.cartId);

      return saved;
    },
  };
};

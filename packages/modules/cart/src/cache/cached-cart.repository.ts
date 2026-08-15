import { Effect } from "effect";

import type {
  CartAdjustmentRecord,
  CartExpectedError,
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

const getFailureReason = (failure: unknown): string =>
  typeof failure === "object" &&
  failure !== null &&
  "message" in failure &&
  typeof failure.message === "string"
    ? failure.message
    : "Cart projection sync failed.";

export interface CreateCachedCartRepositoryOptions {
  readonly cache: CartActiveCache;
  readonly onProjectionSyncFailure?: (
    failure: CartProjectionSyncFailure
  ) => Effect.Effect<void, CartExpectedError> | void;
  readonly projectionSyncFailureMode?: "fail-write" | "record-only";
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
  projectionSyncFailureMode = "record-only",
  projectionRepository,
  scope,
}: CreateCachedCartRepositoryOptions): CartRepository => {
  const getScope = () => resolveScope(scope);

  const syncProjectionAfterCacheWrite = (cartId: CartId) =>
    Effect.gen(function* syncProjectionAfterCacheWriteEffect() {
      const currentScope = getScope();
      const aggregate = yield* cache.getCartAggregate({
        id: cartId,
        scope: currentScope,
      });

      if (!aggregate) {
        return;
      }

      const result = yield* Effect.result(
        syncCartProjection({
          aggregate,
          repository: projectionRepository,
        })
      );

      if (result._tag === "Success") {
        return;
      }

      const failure = {
        cartId,
        failedAt: new Date(),
        reason: getFailureReason(result.failure),
        scope: currentScope,
      };
      if (cache.recordProjectionSyncFailure) {
        yield* cache.recordProjectionSyncFailure(failure);
      }
      const observed = onProjectionSyncFailure?.(failure);

      if (observed) {
        yield* observed;
      }

      if (projectionSyncFailureMode === "fail-write") {
        yield* Effect.fail(result.failure);
      }
    });

  const hydrateAggregate = (id: CartId) =>
    Effect.gen(function* hydrateAggregateEffect() {
      const currentScope = getScope();
      let ownershipDenied = false;
      const cached = yield* cache
        .getCartAggregate({
          id,
          scope: currentScope,
        })
        .pipe(
          Effect.catchIf(isCartCacheOwnershipError, () => {
            ownershipDenied = true;
            return Effect.succeed(null);
          })
        );

      if (ownershipDenied) {
        return null;
      }

      if (cached) {
        return cached;
      }

      const projected = yield* projectionRepository.getCartAggregate(id);

      if (!projected) {
        return null;
      }

      yield* cache.hydrateCartAggregate({
        aggregate: projected,
        scope: currentScope,
      });

      return projected;
    });

  return {
    findAdjustmentByIdempotencyKey: (idempotencyKey, cartId) =>
      Effect.gen(function* findAdjustmentByIdempotencyKeyEffect() {
        const currentScope = getScope();
        const cached = yield* cache
          .findAdjustmentByIdempotencyKey({
            cartId,
            idempotencyKey,
            scope: currentScope,
          })
          .pipe(
            Effect.catchIf(isCartCacheOwnershipError, () =>
              Effect.succeed(null)
            )
          );

        return (
          cached ??
          (yield* projectionRepository.findAdjustmentByIdempotencyKey(
            idempotencyKey,
            cartId
          ))
        );
      }),
    findCartById: (id) =>
      hydrateAggregate(id).pipe(
        Effect.map((aggregate) => aggregate?.cart ?? null)
      ),
    findLineItemById: (id: CartLineItemId, cartId?: CartId) =>
      Effect.gen(function* findLineItemByIdEffect() {
        const currentScope = getScope();
        const cached = yield* cache
          .findLineItemById({
            id,
            cartId,
            scope: currentScope,
          })
          .pipe(
            Effect.catchIf(isCartCacheOwnershipError, () =>
              Effect.succeed(null)
            )
          );

        return (
          cached ?? (yield* projectionRepository.findLineItemById(id, cartId))
        );
      }),
    findLineItemByIdempotencyKey: (idempotencyKey, cartId) =>
      Effect.gen(function* findLineItemByIdempotencyKeyEffect() {
        const currentScope = getScope();
        const cached = yield* cache
          .findLineItemByIdempotencyKey({
            cartId,
            idempotencyKey,
            scope: currentScope,
          })
          .pipe(
            Effect.catchIf(isCartCacheOwnershipError, () =>
              Effect.succeed(null)
            )
          );

        return (
          cached ??
          (yield* projectionRepository.findLineItemByIdempotencyKey(
            idempotencyKey,
            cartId
          ))
        );
      }),
    getCartAggregate: hydrateAggregate,
    listCarts: projectionRepository.listCarts,
    removeLineItem: (id, cartId) =>
      Effect.gen(function* removeLineItemEffect() {
        const currentScope = getScope();
        let item: CartLineItemRecord | null = null;

        if (cartId) {
          item = yield* cache
            .findLineItemById({
              id,
              cartId,
              scope: currentScope,
            })
            .pipe(
              Effect.catchIf(isCartCacheOwnershipError, () =>
                Effect.succeed(null)
              )
            );
        }

        if (!item) {
          item = yield* projectionRepository.findLineItemById(id, cartId);
        }

        const aggregate = yield* cache.removeLineItem({
          cartId: cartId ?? item?.cartId,
          id,
          scope: currentScope,
        });

        yield* projectionRepository.removeLineItem(id, cartId ?? item?.cartId);

        if (aggregate) {
          yield* syncProjectionAfterCacheWrite(aggregate.cart.id);
        }
      }),
    saveAdjustment: (
      adjustment: CartAdjustmentRecord,
      idempotencyKey: string
    ) =>
      Effect.gen(function* saveAdjustmentEffect() {
        const saved = yield* cache.saveAdjustment({
          adjustment,
          idempotencyKey,
          scope: getScope(),
        });

        yield* syncProjectionAfterCacheWrite(saved.cartId);

        return saved;
      }),
    saveCart: (cart: CartRecord) =>
      Effect.gen(function* saveCartEffect() {
        const saved = yield* cache.saveCart({
          cart,
          scope: getScope(),
        });

        yield* syncProjectionAfterCacheWrite(saved.id);

        return saved;
      }),
    saveLineItem: (item: CartLineItemRecord, idempotencyKey?: string) =>
      Effect.gen(function* saveLineItemEffect() {
        const saved = yield* cache.saveLineItem({
          idempotencyKey,
          item,
          scope: getScope(),
        });

        yield* syncProjectionAfterCacheWrite(saved.cartId);

        return saved;
      }),
  };
};

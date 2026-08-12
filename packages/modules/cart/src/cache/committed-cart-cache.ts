import { Effect } from "effect";
import type { Effect as EffectValue } from "effect/Effect";

import type {
  CartExpectedError,
  CartId,
  CartLineItemId,
  CartRepository,
} from "../domain";
import { CartValidationFailure } from "../domain";
import type { CartActiveCache, CartOwnershipScope } from "./cart-cache.types";
import { createSystemCartScope } from "./cart-cache.types";

export type CartCommittedMutation =
  | {
      readonly cartId: CartId;
      readonly type: "aggregate";
    }
  | {
      readonly cartId: CartId;
      readonly idempotencyKey: string;
      readonly type: "adjustment" | "line-item";
    }
  | {
      readonly cartId: CartId;
      readonly lineItemId: CartLineItemId;
      readonly remove: boolean;
      readonly type: "line-item-update";
    };

export type CartCommittedMutationSynchronizer = (
  mutation: CartCommittedMutation
) => EffectValue<void>;

export interface CartMutationCacheGuardInput {
  readonly cartId: CartId;
  readonly mutationId: string;
}

export interface CartMutationCacheCoordinator {
  readonly begin: (
    input: CartMutationCacheGuardInput
  ) => EffectValue<void, CartExpectedError>;
  readonly complete: (input: CartMutationCacheGuardInput) => EffectValue<void>;
}

export interface CreateCommittedCartCacheSynchronizerOptions {
  readonly cache: CartActiveCache;
  readonly projectionRepository: CartRepository;
  readonly scope?: CartOwnershipScope | (() => CartOwnershipScope);
}

export type CreateCartMutationCacheCoordinatorOptions = Pick<
  CreateCommittedCartCacheSynchronizerOptions,
  "cache" | "scope"
>;

const resolveScope = (
  scope: CreateCommittedCartCacheSynchronizerOptions["scope"]
): CartOwnershipScope =>
  typeof scope === "function" ? scope() : (scope ?? createSystemCartScope());

const missingCommittedRecord = (recordType: string): CartValidationFailure =>
  new CartValidationFailure({
    message: `Committed cart ${recordType} could not be loaded for cache synchronization.`,
  });

const getFailureReason = (failure: unknown): string =>
  failure instanceof Error
    ? failure.message
    : "Committed cart cache synchronization failed.";

/** Keeps cache-first reads disabled while a relational cart mutation is open. */
export const createCartMutationCacheCoordinator = ({
  cache,
  scope,
}: CreateCartMutationCacheCoordinatorOptions): CartMutationCacheCoordinator => ({
  begin: (input) =>
    cache.beginMutation({ ...input, scope: resolveScope(scope) }),
  complete: (input) =>
    cache
      .completeMutation({ ...input, scope: resolveScope(scope) })
      .pipe(Effect.ignore),
});

/**
 * Builds the post-commit bridge from the authoritative relational projection to
 * the active cart cache. Only the entity changed by the commit is replayed, so
 * concurrent commits cannot overwrite the cache with an older full snapshot.
 * Cache failures are recorded when possible and never turn a committed database
 * mutation into an API failure.
 */
export const createCommittedCartCacheSynchronizer =
  ({
    cache,
    projectionRepository,
    scope,
  }: CreateCommittedCartCacheSynchronizerOptions): CartCommittedMutationSynchronizer =>
  (mutation) => {
    const currentScope = resolveScope(scope);
    const synchronize = Effect.gen(
      function* synchronizeCommittedCartMutation() {
        if (mutation.type === "aggregate") {
          const cart = yield* projectionRepository.findCartById(
            mutation.cartId
          );

          if (!cart) {
            return yield* missingCommittedRecord("record");
          }

          yield* cache.saveCart({ cart, scope: currentScope });
          return;
        }

        if (mutation.type === "line-item") {
          const item = yield* projectionRepository.findLineItemByIdempotencyKey(
            mutation.idempotencyKey,
            mutation.cartId
          );

          if (!item || item.cartId !== mutation.cartId) {
            return yield* missingCommittedRecord("line item");
          }

          yield* cache.saveLineItem({
            idempotencyKey: mutation.idempotencyKey,
            item,
            scope: currentScope,
          });
          return;
        }

        if (mutation.type === "adjustment") {
          const adjustment =
            yield* projectionRepository.findAdjustmentByIdempotencyKey(
              mutation.idempotencyKey,
              mutation.cartId
            );

          if (!adjustment || adjustment.cartId !== mutation.cartId) {
            return yield* missingCommittedRecord("adjustment");
          }

          yield* cache.saveAdjustment({
            adjustment,
            idempotencyKey: mutation.idempotencyKey,
            scope: currentScope,
          });
          return;
        }

        if (mutation.type !== "line-item-update") {
          return;
        }

        if (mutation.remove) {
          yield* cache.removeLineItem({
            cartId: mutation.cartId,
            id: mutation.lineItemId,
            scope: currentScope,
          });
          return;
        }

        const item = yield* projectionRepository.findLineItemById(
          mutation.lineItemId,
          mutation.cartId
        );

        if (!item) {
          return yield* missingCommittedRecord("line item");
        }

        yield* cache.saveLineItem({ item, scope: currentScope });
      }
    );

    return Effect.result(synchronize).pipe(
      Effect.flatMap((result) => {
        if (result._tag === "Success" || !cache.recordProjectionSyncFailure) {
          return Effect.void;
        }

        return cache
          .recordProjectionSyncFailure({
            cartId: mutation.cartId,
            failedAt: new Date(),
            reason: getFailureReason(result.failure),
            scope: currentScope,
          })
          .pipe(Effect.ignore);
      })
    );
  };

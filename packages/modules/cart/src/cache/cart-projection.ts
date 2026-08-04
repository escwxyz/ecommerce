import { Effect } from "effect";
import type { Effect as EffectValue } from "effect/Effect";

import type {
  CartAggregate,
  CartExpectedError,
  CartRepository,
} from "../domain";

export interface SyncCartProjectionInput {
  readonly aggregate: CartAggregate;
  readonly repository: CartRepository;
}

/**
 * Writes a full cart aggregate to a projection repository. The cart tables are
 * used as an admin analytics and recovery projection, so writes are keyed by
 * stable record ids rather than request-time mutation ordering.
 */
export const syncCartProjection = ({
  aggregate,
  repository,
}: SyncCartProjectionInput): EffectValue<void, CartExpectedError> =>
  Effect.gen(function* syncCartProjectionEffect() {
    yield* repository.saveCart(aggregate.cart);

    for (const item of aggregate.lineItems) {
      yield* repository.saveLineItem(item);
    }

    for (const adjustment of aggregate.adjustments) {
      yield* repository.saveAdjustment(
        adjustment,
        `projection:${adjustment.id}`
      );
    }
  });

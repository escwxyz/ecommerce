import type { CartAggregate, CartRepository } from "../domain";

export interface SyncCartProjectionInput {
  readonly aggregate: CartAggregate;
  readonly repository: CartRepository;
}

/**
 * Writes a full cart aggregate to a projection repository. The cart tables are
 * used as an admin analytics and recovery projection, so writes are keyed by
 * stable record ids rather than request-time mutation ordering.
 */
export const syncCartProjection = async ({
  aggregate,
  repository,
}: SyncCartProjectionInput): Promise<void> => {
  await repository.saveCart(aggregate.cart);

  for (const item of aggregate.lineItems) {
    await repository.saveLineItem(item);
  }

  for (const adjustment of aggregate.adjustments) {
    await repository.saveAdjustment(adjustment, `projection:${adjustment.id}`);
  }
};

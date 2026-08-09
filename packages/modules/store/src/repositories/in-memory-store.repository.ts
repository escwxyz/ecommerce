import type { InMemoryTransactionResource } from "@ecommerce/core/testing";
import { Effect, Layer, Ref } from "effect";

import type { StoreRepository, StoreSettings } from "../domain";
import { StoreRepositoryService } from "../domain";

export interface ResettableStoreRepository extends StoreRepository {
  readonly reset: Effect.Effect<void>;
  readonly snapshot: Effect.Effect<StoreSettings | null>;
  clear(): void;
}

export class InMemoryStoreRepository implements ResettableStoreRepository {
  readonly #settings = Ref.makeUnsafe<StoreSettings | null>(null);

  readonly getStoreSettings = Ref.get(this.#settings);

  readonly reset = Ref.set(this.#settings, null);

  readonly saveStoreSettings = (settings: StoreSettings) =>
    Ref.set(this.#settings, settings).pipe(Effect.as(settings));

  readonly snapshot = Ref.get(this.#settings);

  clear(): void {
    Effect.runSync(this.reset);
  }
}

export const createInMemoryStoreRepository = (): StoreRepository =>
  new InMemoryStoreRepository();

export const createResettableInMemoryStoreRepository =
  (): ResettableStoreRepository => new InMemoryStoreRepository();

export const createInMemoryStoreRepositoryLayer = () =>
  Layer.succeed(StoreRepositoryService, createInMemoryStoreRepository());

/** Captures and restores Store state for the deterministic transaction adapter. */
export const storeRepositoryTransactionResource = (
  repository: ResettableStoreRepository
): InMemoryTransactionResource => ({
  captureRollback: repository.snapshot.pipe(
    Effect.map((snapshot) =>
      snapshot === null
        ? repository.reset
        : repository
            .saveStoreSettings(snapshot)
            .pipe(Effect.orDie, Effect.asVoid)
    )
  ),
});

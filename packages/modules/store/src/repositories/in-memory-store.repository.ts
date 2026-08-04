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

export const defaultStoreRepository = new InMemoryStoreRepository();

export const createInMemoryStoreRepository = (): StoreRepository =>
  new InMemoryStoreRepository();

export const createResettableInMemoryStoreRepository =
  (): ResettableStoreRepository => new InMemoryStoreRepository();

export const createInMemoryStoreRepositoryLayer = () =>
  Layer.succeed(StoreRepositoryService, createInMemoryStoreRepository());

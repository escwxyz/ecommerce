import { RepositoryUnavailable } from "@ecommerce/core";
import { Effect, Layer, Ref } from "effect";

import type {
  StoreExpectedError,
  StoreLegacyRepository,
  StoreRepository,
  StoreSettings,
} from "../domain";
import {
  StoreCurrencyListEmpty,
  StoreDefaultCurrencyUnsupported,
  StoreInvalidIdentifier,
  StoreRepositoryService,
} from "../domain";

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

const storeRepositoryName = "StoreRepository";
const legacyStoreRepositoryAdapter = "legacy-store-repository";

const isStoreExpectedError = (cause: unknown): cause is StoreExpectedError =>
  cause instanceof RepositoryUnavailable ||
  cause instanceof StoreCurrencyListEmpty ||
  cause instanceof StoreDefaultCurrencyUnsupported ||
  cause instanceof StoreInvalidIdentifier;

const toLegacyRepositoryFailure =
  (operation: "read" | "write") =>
  (cause: unknown): StoreExpectedError =>
    isStoreExpectedError(cause)
      ? cause
      : new RepositoryUnavailable({
          adapter: legacyStoreRepositoryAdapter,
          operation,
          repository: storeRepositoryName,
        });

export const createStoreRepositoryFromLegacyRepository = (
  repository: StoreLegacyRepository
): StoreRepository => ({
  getStoreSettings: Effect.tryPromise({
    catch: toLegacyRepositoryFailure("read"),
    try: () => repository.getStoreSettings(),
  }),
  saveStoreSettings: (settings) =>
    Effect.tryPromise({
      catch: toLegacyRepositoryFailure("write"),
      try: () => repository.saveStoreSettings(settings),
    }),
});

export const createStoreLegacyRepositoryFromRepository = (
  repository: StoreRepository
): StoreLegacyRepository => ({
  getStoreSettings: () => Effect.runPromise(repository.getStoreSettings),
  saveStoreSettings: (settings) =>
    Effect.runPromise(repository.saveStoreSettings(settings)),
});

export const defaultStoreRepositoryLegacy =
  createStoreLegacyRepositoryFromRepository(defaultStoreRepository);

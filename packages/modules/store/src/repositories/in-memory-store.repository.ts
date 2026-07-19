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

/**
 * Temporary migration bridge from legacy Promise repositories into the
 * Effect-native store repository contract. Keep this adapter narrow: legacy
 * callers may still reject Promises, but those rejections must become supported
 * typed repository/domain failures before entering store service logic.
 */
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

/**
 * Temporary migration bridge from the Effect-native store repository back to
 * the legacy Promise shape used by older D1 and route code. Compatibility
 * depends on preserving the legacy method signatures while ensuring all writes
 * still execute through the Effect repository implementation.
 */
export const createStoreLegacyRepositoryFromRepository = (
  repository: StoreRepository
): StoreLegacyRepository => ({
  getStoreSettings: () => Effect.runPromise(repository.getStoreSettings),
  saveStoreSettings: (settings) =>
    Effect.runPromise(repository.saveStoreSettings(settings)),
});

export const defaultStoreRepositoryLegacy =
  createStoreLegacyRepositoryFromRepository(defaultStoreRepository);

import { describe, expect, it } from "bun:test";

import {
  createInMemoryRepositoryContractHarness,
  type RepositoryContractCase,
} from "@ecommerce/core/testing";
import { Effect, Ref } from "effect";

import { createStoreId, StoreRepositoryService } from "../domain";
import type { StoreRepository, StoreSettings } from "../domain";

const createStoreSettings = (name: string): StoreSettings => ({
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  defaultCurrencyCode: "USD",
  defaultLocale: "en-US",
  defaultRegionId: null,
  defaultSalesChannelId: null,
  id: createStoreId("store_effect_repository"),
  metadata: {},
  name,
  supportedCurrencyCodes: ["USD"],
  timezone: "UTC",
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
});

const storeRepositoryContractCases: readonly RepositoryContractCase<StoreRepository>[] =
  [
    {
      name: "saves and reads store settings",
      run: StoreRepositoryService.use((repository) =>
        Effect.gen(function* savesAndReadsStoreSettingsContract() {
          const settings = createStoreSettings("Contract Store");
          const empty = yield* repository.getStoreSettings;

          expect(empty).toBeNull();

          const saved = yield* repository.saveStoreSettings(settings);
          const loaded = yield* repository.getStoreSettings;

          expect(saved).toEqual(settings);
          expect(loaded).toEqual(settings);
        })
      ),
    },
    {
      name: "replaces the singleton store settings record",
      run: StoreRepositoryService.use((repository) =>
        Effect.gen(function* replacesSingletonStoreSettingsContract() {
          yield* repository.saveStoreSettings(createStoreSettings("First"));
          yield* repository.saveStoreSettings(createStoreSettings("Second"));

          const loaded = yield* repository.getStoreSettings;

          expect(loaded).toMatchObject({
            name: "Second",
          });
        })
      ),
    },
  ];

describe("store Effect repository contract", () => {
  it("runs against the in-memory repository Layer", async () => {
    const harness = createInMemoryRepositoryContractHarness({
      initialState: () => null as StoreSettings | null,
      makeRepository: (state): StoreRepository => ({
        getStoreSettings: Ref.get(state),
        saveStoreSettings: (settings) =>
          Ref.set(state, settings).pipe(Effect.as(settings)),
      }),
      repositoryName: "StoreRepository",
      service: StoreRepositoryService,
    });

    await Effect.runPromise(harness.runAll(storeRepositoryContractCases));

    expect(harness.adapter).toBe("in-memory");
    expect(harness.repositoryName).toBe("StoreRepository");

    if (!harness.snapshot) {
      throw new Error("Expected store repository snapshot.");
    }

    await expect(Effect.runPromise(harness.snapshot)).resolves.toMatchObject({
      name: "Second",
    });
  });
});

import { describe, expect, it } from "bun:test";

import {
  createStoreId,
  storeMigration,
  storeSchema,
  storeTableName,
  type StoreRepository,
  type StoreSettings,
} from "../domain";
import { createInMemoryStoreRepository } from "../repositories";

const createStoreSettings = (name: string): StoreSettings => ({
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  defaultCurrencyCode: "USD",
  defaultLocale: "en-US",
  defaultRegionId: null,
  defaultSalesChannelId: null,
  id: createStoreId("store_contract"),
  metadata: {},
  name,
  supportedCurrencyCodes: ["USD"],
  timezone: "UTC",
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
});

const runStoreRepositoryContract = (
  name: string,
  createRepository: () => StoreRepository
) => {
  describe(name, () => {
    it("saves and reads store settings", async () => {
      const repository = createRepository();
      const settings = createStoreSettings("Contract Store");

      await expect(repository.getStoreSettings()).resolves.toBeNull();
      await expect(repository.saveStoreSettings(settings)).resolves.toEqual(
        settings
      );
      await expect(repository.getStoreSettings()).resolves.toEqual(settings);
    });

    it("replaces the singleton store settings record", async () => {
      const repository = createRepository();

      await repository.saveStoreSettings(createStoreSettings("First"));
      await repository.saveStoreSettings(createStoreSettings("Second"));

      await expect(repository.getStoreSettings()).resolves.toMatchObject({
        name: "Second",
      });
    });
  });
};

runStoreRepositoryContract("in-memory store repository", () =>
  createInMemoryStoreRepository()
);

describe("store schema contribution", () => {
  it("declares the owned store table and migration hooks", () => {
    expect(storeTableName).toBe("store");
    expect(storeSchema).toEqual({
      store: "store",
    });
    expect(storeMigration).toMatchObject({
      down: expect.any(Function),
      up: expect.any(Function),
    });
  });
});

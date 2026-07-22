import { describe, expect, it } from "bun:test";

import { Effect } from "effect";

import {
  createTaxCategoryId,
  createTaxProviderConfigId,
  createTaxRateId,
  createTaxRegionId,
} from "../domain";
import type {
  TaxCategoryRecord,
  TaxProviderConfigRecord,
  TaxRateRecord,
  TaxRepository,
  TaxRegionRecord,
} from "../domain";
import { createInMemoryTaxRepository } from "../repositories";

const now = new Date("2026-01-01T00:00:00.000Z");

const createProviderConfig = (): TaxProviderConfigRecord => ({
  createdAt: now,
  id: createTaxProviderConfigId("txprov_contract"),
  isActive: true,
  metadata: {},
  providerKey: "manual",
  settings: {},
  updatedAt: now,
});

const createCategory = (): TaxCategoryRecord => ({
  code: "STANDARD",
  createdAt: now,
  description: null,
  id: createTaxCategoryId("txcat_contract"),
  metadata: {},
  name: "Standard",
  updatedAt: now,
});

const createRegion = (
  providerConfigId = createTaxProviderConfigId("txprov_contract")
): TaxRegionRecord => ({
  code: "US",
  countryCode: "US",
  createdAt: now,
  id: createTaxRegionId("txreg_contract"),
  metadata: {},
  name: "United States",
  providerConfigId,
  updatedAt: now,
});

const createRate = (): TaxRateRecord => ({
  categoryId: createTaxCategoryId("txcat_contract"),
  createdAt: now,
  id: createTaxRateId("txrate_contract"),
  metadata: {},
  name: "Standard tax",
  percentage: 7.5,
  regionId: createTaxRegionId("txreg_contract"),
  updatedAt: now,
});

const runTaxRepositoryContract = (
  name: string,
  createRepository: () => TaxRepository
) => {
  describe(name, () => {
    it("saves and reads tax provider configs, categories, regions, and rates", async () => {
      const repository = createRepository();
      const providerConfig = createProviderConfig();
      const category = createCategory();
      const region = createRegion();
      const rate = createRate();

      await Effect.runPromise(repository.saveProviderConfig(providerConfig));
      await Effect.runPromise(repository.saveCategory(category));
      await Effect.runPromise(repository.saveRegion(region));
      await Effect.runPromise(repository.saveRate(rate));

      await expect(
        Effect.runPromise(repository.findProviderConfigById(providerConfig.id))
      ).resolves.toEqual(providerConfig);
      await expect(
        Effect.runPromise(repository.findActiveProviderConfigByKey("manual"))
      ).resolves.toEqual(providerConfig);
      await expect(
        Effect.runPromise(repository.findCategoryById(category.id))
      ).resolves.toEqual(category);
      await expect(
        Effect.runPromise(repository.findRegionById(region.id))
      ).resolves.toEqual(region);
      await expect(
        Effect.runPromise(repository.findRatesByRegionId(region.id))
      ).resolves.toEqual([rate]);
    });
  });
};

runTaxRepositoryContract("in-memory tax repository", () =>
  createInMemoryTaxRepository()
);

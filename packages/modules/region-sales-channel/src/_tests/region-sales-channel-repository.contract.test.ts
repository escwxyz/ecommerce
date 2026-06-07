import { describe, expect, it } from "bun:test";

import {
  createRegionId,
  createSalesChannelId,
  type RegionRepository,
  type SalesChannelRepository,
} from "../domain";
import { createResettableInMemoryRegionSalesChannelRepository } from "../repositories";

const createdAt = new Date("2026-01-01T00:00:00.000Z");

const createRegion = (id: string) => ({
  countries: ["US"],
  createdAt,
  currencyCode: "USD",
  id: createRegionId(id),
  metadata: {},
  name: `Region ${id}`,
  providerAvailability: {
    fulfillmentOptionIds: [],
    paymentProviderIds: [],
    taxProviderId: null,
  },
  updatedAt: createdAt,
});

const createSalesChannel = (id: string) => ({
  createdAt,
  description: null,
  id: createSalesChannelId(id),
  metadata: {},
  name: `Channel ${id}`,
  productIds: [],
  status: "draft" as const,
  updatedAt: createdAt,
});

describe("region sales-channel repository contracts", () => {
  it("saves and reads region records", async () => {
    const repository: RegionRepository =
      createResettableInMemoryRegionSalesChannelRepository();
    const region = createRegion("reg_contract");

    await expect(repository.saveRegion(region)).resolves.toEqual(region);
    await expect(repository.findRegionById(region.id)).resolves.toEqual(region);
    await expect(repository.listRegions()).resolves.toEqual([region]);
  });

  it("saves and reads sales-channel records", async () => {
    const repository: SalesChannelRepository =
      createResettableInMemoryRegionSalesChannelRepository();
    const channel = createSalesChannel("sc_contract");

    await expect(repository.saveSalesChannel(channel)).resolves.toEqual(
      channel
    );
    await expect(repository.findSalesChannelById(channel.id)).resolves.toEqual(
      channel
    );
    await expect(repository.listSalesChannels()).resolves.toEqual([channel]);
  });
});

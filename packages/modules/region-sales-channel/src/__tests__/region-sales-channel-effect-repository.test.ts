import { describe, expect, it } from "bun:test";

import { Effect } from "effect";

import {
  createRegionId,
  createSalesChannelId,
  type RegionRecord,
  type SalesChannelRecord,
} from "../domain";
import { createResettableInMemoryRegionSalesChannelRepository } from "../repositories";

const baseDate = new Date("2026-01-01T00:00:00.000Z");

const createRegionRecord = (id: string, createdAt: Date): RegionRecord => ({
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

const createSalesChannelRecord = (
  id: string,
  createdAt: Date
): SalesChannelRecord => ({
  createdAt,
  description: null,
  id: createSalesChannelId(id),
  metadata: {},
  name: `Sales channel ${id}`,
  productIds: [],
  status: "draft",
  updatedAt: createdAt,
});

describe("in-memory region sales-channel repository", () => {
  it("saves and reads regions and sales channels", async () => {
    const repository = createResettableInMemoryRegionSalesChannelRepository();
    const region = createRegionRecord("reg_memory", baseDate);
    const channel = createSalesChannelRecord("sc_memory", baseDate);

    const savedRegion = await Effect.runPromise(repository.saveRegion(region));
    const loadedRegion = await Effect.runPromise(
      repository.findRegionById(region.id)
    );
    const savedChannel = await Effect.runPromise(
      repository.saveSalesChannel(channel)
    );
    const loadedChannel = await Effect.runPromise(
      repository.findSalesChannelById(channel.id)
    );

    expect(savedRegion).toEqual(region);
    expect(loadedRegion).toEqual(region);
    expect(savedChannel).toEqual(channel);
    expect(loadedChannel).toEqual(channel);
  });

  it("lists newest records first", async () => {
    const repository = createResettableInMemoryRegionSalesChannelRepository();
    const olderRegion = createRegionRecord(
      "reg_older",
      new Date("2026-01-01T00:00:00.000Z")
    );
    const newerRegion = createRegionRecord(
      "reg_newer",
      new Date("2026-01-02T00:00:00.000Z")
    );
    const olderChannel = createSalesChannelRecord(
      "sc_older",
      new Date("2026-01-01T00:00:00.000Z")
    );
    const newerChannel = createSalesChannelRecord(
      "sc_newer",
      new Date("2026-01-02T00:00:00.000Z")
    );

    await Effect.runPromise(repository.saveRegion(olderRegion));
    await Effect.runPromise(repository.saveRegion(newerRegion));
    await Effect.runPromise(repository.saveSalesChannel(olderChannel));
    await Effect.runPromise(repository.saveSalesChannel(newerChannel));

    await expect(Effect.runPromise(repository.listRegions)).resolves.toEqual([
      newerRegion,
      olderRegion,
    ]);
    await expect(
      Effect.runPromise(repository.listSalesChannels)
    ).resolves.toEqual([newerChannel, olderChannel]);
  });
});

import { Effect, Layer } from "effect";

import type {
  RegionId,
  RegionRecord,
  RegionRepository,
  SalesChannelId,
  SalesChannelRecord,
  SalesChannelRepository,
} from "../domain";
import {
  RegionRepositoryService,
  SalesChannelRepositoryService,
} from "../domain";

export interface ResettableRegionSalesChannelRepository
  extends RegionRepository, SalesChannelRepository {
  clear(): void;
}

const sortByCreatedAtDescending = <
  TRecord extends { readonly createdAt: Date },
>(
  records: Iterable<TRecord>
): TRecord[] => {
  const sortedRecords: TRecord[] = [];

  for (const record of records) {
    const recordTimestamp = record.createdAt.getTime();
    let insertAt = 0;

    while (insertAt < sortedRecords.length) {
      const currentRecord = sortedRecords[insertAt];

      if (
        !currentRecord ||
        currentRecord.createdAt.getTime() < recordTimestamp
      ) {
        break;
      }

      insertAt += 1;
    }

    sortedRecords.splice(insertAt, 0, record);
  }

  return sortedRecords;
};

export class InMemoryRegionSalesChannelRepository implements ResettableRegionSalesChannelRepository {
  readonly #regions = new Map<string, RegionRecord>();
  readonly #salesChannels = new Map<string, SalesChannelRecord>();

  clear(): void {
    this.#regions.clear();
    this.#salesChannels.clear();
  }

  findRegionById(id: RegionId) {
    return Effect.succeed(this.#regions.get(id) ?? null);
  }

  findSalesChannelById(id: SalesChannelId) {
    return Effect.succeed(this.#salesChannels.get(id) ?? null);
  }

  readonly listRegions = Effect.sync(() =>
    sortByCreatedAtDescending(this.#regions.values())
  );

  readonly listSalesChannels = Effect.sync(() =>
    sortByCreatedAtDescending(this.#salesChannels.values())
  );

  saveRegion(region: RegionRecord) {
    return Effect.sync(() => {
      this.#regions.set(region.id, region);
      return region;
    });
  }

  saveSalesChannel(channel: SalesChannelRecord) {
    return Effect.sync(() => {
      this.#salesChannels.set(channel.id, channel);
      return channel;
    });
  }
}

export const defaultRegionSalesChannelRepository =
  new InMemoryRegionSalesChannelRepository();

export const createInMemoryRegionRepository = (): RegionRepository =>
  new InMemoryRegionSalesChannelRepository();

export const createInMemorySalesChannelRepository =
  (): SalesChannelRepository => new InMemoryRegionSalesChannelRepository();

export const createInMemoryRegionSalesChannelRepository = (): RegionRepository &
  SalesChannelRepository => new InMemoryRegionSalesChannelRepository();

export const createResettableInMemoryRegionSalesChannelRepository =
  (): ResettableRegionSalesChannelRepository =>
    new InMemoryRegionSalesChannelRepository();

export const createInMemoryRegionRepositoryLayer = () =>
  Layer.effect(
    RegionRepositoryService,
    Effect.sync(() => new InMemoryRegionSalesChannelRepository())
  );

export const createInMemorySalesChannelRepositoryLayer = () =>
  Layer.effect(
    SalesChannelRepositoryService,
    Effect.sync(() => new InMemoryRegionSalesChannelRepository())
  );

export const createInMemoryRegionSalesChannelRepositoryLayer = () => {
  const repository = new InMemoryRegionSalesChannelRepository();
  return Layer.merge(
    Layer.succeed(RegionRepositoryService, repository),
    Layer.succeed(SalesChannelRepositoryService, repository)
  );
};

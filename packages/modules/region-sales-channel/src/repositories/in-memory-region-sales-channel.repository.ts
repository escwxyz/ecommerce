import type {
  RegionId,
  RegionRecord,
  RegionRepository,
  SalesChannelId,
  SalesChannelRecord,
  SalesChannelRepository,
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

  findRegionById(id: RegionId): Promise<RegionRecord | null> {
    return Promise.resolve(this.#regions.get(id) ?? null);
  }

  findSalesChannelById(id: SalesChannelId): Promise<SalesChannelRecord | null> {
    return Promise.resolve(this.#salesChannels.get(id) ?? null);
  }

  listRegions(): Promise<readonly RegionRecord[]> {
    return Promise.resolve(sortByCreatedAtDescending(this.#regions.values()));
  }

  listSalesChannels(): Promise<readonly SalesChannelRecord[]> {
    return Promise.resolve(
      sortByCreatedAtDescending(this.#salesChannels.values())
    );
  }

  saveRegion(region: RegionRecord): Promise<RegionRecord> {
    this.#regions.set(region.id, region);
    return Promise.resolve(region);
  }

  saveSalesChannel(channel: SalesChannelRecord): Promise<SalesChannelRecord> {
    this.#salesChannels.set(channel.id, channel);
    return Promise.resolve(channel);
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

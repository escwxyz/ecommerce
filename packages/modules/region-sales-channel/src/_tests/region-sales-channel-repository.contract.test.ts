import { Database, type SQLQueryBindings } from "bun:sqlite";
import { afterEach, describe, expect, it } from "bun:test";

import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";

import { createD1RegionSalesChannelRepository } from "../adapters/d1";
import {
  createRegionId,
  createSalesChannelId,
  regionSalesChannelMigration,
  type RegionSalesChannelDatabase,
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

interface RepositoryTestContext {
  readonly cleanup?: () => void;
  readonly repository: RegionRepository & SalesChannelRepository;
}

const runRegionSalesChannelRepositoryContract = (
  name: string,
  createContext: () => Promise<RepositoryTestContext> | RepositoryTestContext
) => {
  describe(name, () => {
    let cleanup: (() => void) | undefined;

    afterEach(() => {
      cleanup?.();
      cleanup = undefined;
    });

    const setup = async () => {
      const context = await createContext();
      cleanup = context.cleanup;
      return context.repository;
    };

    it("saves and reads region records", async () => {
      const repository = await setup();
      const region = createRegion("reg_contract");

      await expect(repository.saveRegion(region)).resolves.toEqual(region);
      await expect(repository.findRegionById(region.id)).resolves.toEqual(
        region
      );
      await expect(repository.listRegions()).resolves.toEqual([region]);
    });

    it("saves and reads sales-channel records", async () => {
      const repository = await setup();
      const channel = createSalesChannel("sc_contract");

      await expect(repository.saveSalesChannel(channel)).resolves.toEqual(
        channel
      );
      await expect(
        repository.findSalesChannelById(channel.id)
      ).resolves.toEqual(channel);
      await expect(repository.listSalesChannels()).resolves.toEqual([channel]);
    });

    it("lists newest records first for both regions and sales channels", async () => {
      const repository = await setup();
      const olderRegion = createRegion("reg_older");
      const newerRegion = {
        ...createRegion("reg_newer"),
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      };
      const olderChannel = createSalesChannel("sc_older");
      const newerChannel = {
        ...createSalesChannel("sc_newer"),
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      };

      await repository.saveRegion(olderRegion);
      await repository.saveRegion(newerRegion);
      await repository.saveSalesChannel(olderChannel);
      await repository.saveSalesChannel(newerChannel);

      await expect(repository.listRegions()).resolves.toEqual([
        newerRegion,
        olderRegion,
      ]);
      await expect(repository.listSalesChannels()).resolves.toEqual([
        newerChannel,
        olderChannel,
      ]);
    });
  });
};

const createFakeD1Binding = (sqlite: Database) => ({
  batch: async (statements: readonly FakeD1PreparedStatement[]) =>
    Promise.all(statements.map((statement) => statement.all())),
  exec: async (query: string) => {
    sqlite.exec(query);
    return { count: 0, duration: 0 };
  },
  prepare: (query: string) => new FakeD1PreparedStatement(sqlite, query),
});

type FakeD1Binding = ConstructorParameters<typeof D1Dialect>[0]["database"];

const createKyselyD1RegionSalesChannelDatabase = (sqlite: Database) =>
  new Kysely<RegionSalesChannelDatabase>({
    dialect: new D1Dialect({
      database: createFakeD1Binding(sqlite) as unknown as FakeD1Binding,
    }),
  });

class FakeD1PreparedStatement {
  readonly #query: string;
  readonly #sqlite: Database;
  readonly #values: readonly SQLQueryBindings[];

  constructor(
    sqlite: Database,
    query: string,
    values: readonly SQLQueryBindings[] = []
  ) {
    this.#query = query;
    this.#sqlite = sqlite;
    this.#values = values;
  }

  bind(...values: readonly SQLQueryBindings[]): FakeD1PreparedStatement {
    return new FakeD1PreparedStatement(this.#sqlite, this.#query, values);
  }

  all() {
    const normalizedQuery = this.#query.trim().toLowerCase();
    const statement = this.#sqlite.query(this.#query);

    if (
      normalizedQuery.startsWith("select") ||
      normalizedQuery.startsWith("pragma")
    ) {
      return Promise.resolve({
        meta: { changes: 0, last_row_id: 0 },
        results: statement.all(...this.#values),
        success: true,
      });
    }

    const result = statement.run(...this.#values);
    return Promise.resolve({
      meta: {
        changes: result.changes,
        last_row_id: Number(result.lastInsertRowid),
      },
      results: [],
      success: true,
    });
  }
}

runRegionSalesChannelRepositoryContract(
  "in-memory region sales-channel repository",
  () => ({
    repository: createResettableInMemoryRegionSalesChannelRepository(),
  })
);

runRegionSalesChannelRepositoryContract(
  "D1 region sales-channel repository",
  async () => {
    const sqlite = new Database(":memory:");
    const db = createKyselyD1RegionSalesChannelDatabase(sqlite);
    await regionSalesChannelMigration.up(db);

    return {
      cleanup: () => sqlite.close(),
      repository: createD1RegionSalesChannelRepository({ db }),
    };
  }
);

describe("region sales-channel schema contribution", () => {
  it("creates region and sales-channel tables through the Kysely migration", async () => {
    const sqlite = new Database(":memory:");
    const db = createKyselyD1RegionSalesChannelDatabase(sqlite);

    await regionSalesChannelMigration.up(db);

    expect(
      sqlite
        .query("select name from sqlite_master where type = 'table'")
        .all()
        .map((row) => (row as { name: string }).name)
    ).toEqual(
      expect.arrayContaining([
        "region",
        "region_country",
        "sales_channel",
        "sales_channel_product",
      ])
    );

    sqlite.close();
  });
});

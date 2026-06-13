import { Database, type SQLQueryBindings } from "bun:sqlite";
import { afterEach, describe, expect, it } from "bun:test";

import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";

import { createD1PricingRepository } from "../adapters/d1";
import {
  createCurrencyId,
  createMoneyAmountId,
  createPriceListId,
  createPricePreferenceId,
  createPriceRuleId,
  createPriceSetId,
  pricingMigration,
  type PricingDatabase,
  type PricingRepository,
} from "../domain";
import { createResettableInMemoryPricingRepository } from "../repositories";

const createdAt = new Date("2026-01-01T00:00:00.000Z");

const createCurrency = (code: string, timestamp: Date = createdAt) => ({
  code,
  createdAt: timestamp,
  id: createCurrencyId(`cur_${code.toLowerCase()}`),
  name: `${code} Currency`,
  precision: 2,
  updatedAt: timestamp,
});

const createPriceSet = (id: string, timestamp: Date = createdAt) => ({
  createdAt: timestamp,
  id: createPriceSetId(id),
  metadata: {},
  title: `Price Set ${id}`,
  updatedAt: timestamp,
});

const createPriceList = (id: string, timestamp: Date = createdAt) => ({
  createdAt: timestamp,
  description: null,
  endsAt: null,
  id: createPriceListId(id),
  startsAt: null,
  status: "active" as const,
  title: `Price List ${id}`,
  updatedAt: timestamp,
});

interface RepositoryTestContext {
  readonly cleanup?: () => void;
  readonly repository: PricingRepository;
}

const runPricingRepositoryContract = (
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

    it("saves and reads currencies by code", async () => {
      const repository = await setup();
      const currency = createCurrency("USD");

      await expect(repository.saveCurrency(currency)).resolves.toEqual(
        currency
      );
      await expect(repository.findCurrencyByCode("USD")).resolves.toEqual(
        currency
      );
      await expect(repository.listCurrencies()).resolves.toEqual([currency]);
    });

    it("saves and reads money amounts by price set", async () => {
      const repository = await setup();
      const priceSet = createPriceSet("pset_contract");
      const amount = {
        amount: 2500,
        createdAt,
        currencyCode: "USD",
        id: createMoneyAmountId("amt_contract"),
        priceListId: null,
        priceSetId: priceSet.id,
        rules: {},
        updatedAt: createdAt,
      };

      await repository.savePriceSet(priceSet);
      await expect(repository.saveMoneyAmount(amount)).resolves.toEqual(amount);
      await expect(
        repository.findMoneyAmountsForPriceSet(priceSet.id)
      ).resolves.toEqual([amount]);
      await expect(repository.findPriceSetById(priceSet.id)).resolves.toEqual(
        priceSet
      );
    });

    it("saves and reads price lists and rules", async () => {
      const repository = await setup();
      const priceList = createPriceList("plist_contract");
      const rule = {
        attribute: "region",
        createdAt,
        id: createPriceRuleId("prule_contract"),
        priceListId: priceList.id,
        updatedAt: createdAt,
        value: "EU",
      };
      const preference = {
        attribute: "region",
        createdAt,
        currencyCode: "EUR",
        id: createPricePreferenceId("ppref_contract"),
        updatedAt: createdAt,
        value: "EU",
      };

      await expect(repository.savePriceList(priceList)).resolves.toEqual(
        priceList
      );
      await expect(repository.findPriceListById(priceList.id)).resolves.toEqual(
        priceList
      );
      await expect(repository.savePriceRule(rule)).resolves.toEqual(rule);
      await expect(
        repository.findPriceRulesByPriceListId(priceList.id)
      ).resolves.toEqual([rule]);
      await expect(repository.savePricePreference(preference)).resolves.toEqual(
        preference
      );
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

const createKyselyD1PricingDatabase = (sqlite: Database) =>
  new Kysely<PricingDatabase>({
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

runPricingRepositoryContract("in-memory pricing repository", () => ({
  repository: createResettableInMemoryPricingRepository(),
}));

runPricingRepositoryContract("D1 pricing repository", async () => {
  const sqlite = new Database(":memory:");
  const db = createKyselyD1PricingDatabase(sqlite);
  await pricingMigration.up(db);

  return {
    cleanup: () => sqlite.close(),
    repository: createD1PricingRepository({ db }),
  };
});

describe("pricing schema contribution", () => {
  it("creates pricing tables through the Kysely migration", async () => {
    const sqlite = new Database(":memory:");
    const db = createKyselyD1PricingDatabase(sqlite);

    await pricingMigration.up(db);

    expect(
      sqlite
        .query("select name from sqlite_master where type = 'table'")
        .all()
        .map((row) => (row as { name: string }).name)
    ).toEqual(
      expect.arrayContaining([
        "pricing_currency",
        "pricing_price_set",
        "pricing_price_list",
        "pricing_money_amount",
        "pricing_price_rule",
        "pricing_price_preference",
      ])
    );

    sqlite.close();
  });
});

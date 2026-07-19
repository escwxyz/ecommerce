import { afterAll, describe, expect, it } from "bun:test";

import {
  PricingRepositoryService,
  createCurrencyId,
  createMoneyAmountId,
  createPriceListId,
  createPriceRuleId,
  createPriceSetId,
} from "@ecommerce/pricing";
import type {
  CurrencyRecord,
  MoneyAmountRecord,
  PriceListRecord,
  PriceRuleRecord,
} from "@ecommerce/pricing";
import { Effect, Exit, Layer, ManagedRuntime, Redacted } from "effect";

import {
  createPostgresClientLayer,
  createPostgresDrizzleLayer,
  createPostgresPricingRepositoryLayer,
  resetPostgresDevelopmentDatabase,
  resetPostgresPricingTables,
  runPostgresMigrations,
  withPostgresPricingTransaction,
} from "../index";
import { localPostgresContractUrlEnv } from "../repository-contract-harness";

const livePostgresUrl = process.env[localPostgresContractUrlEnv];
const describeLivePostgres = livePostgresUrl ? describe : describe.skip;
const createdAt = new Date("2026-01-01T00:00:00.000Z");

const createCurrency = (code: string): CurrencyRecord => ({
  code,
  createdAt,
  id: createCurrencyId(`cur_${code.toLowerCase()}`),
  name: `${code} Currency`,
  precision: 2,
  updatedAt: createdAt,
});

const createPriceList = (id: string): PriceListRecord => ({
  createdAt,
  description: null,
  endsAt: null,
  id: createPriceListId(id),
  startsAt: null,
  status: "active",
  title: `Price List ${id}`,
  updatedAt: createdAt,
});

const createLiveDatabaseLayer = () =>
  createPostgresClientLayer({
    applicationName: "@ecommerce/db-postgres:pricing-repository",
    maxConnections: 2,
    url: Redacted.make(livePostgresUrl ?? "postgres://missing"),
  }).pipe((clientLayer) =>
    Layer.merge(
      clientLayer,
      createPostgresDrizzleLayer().pipe(Layer.provide(clientLayer))
    )
  );

describe("PostgreSQL pricing repository Layer", () => {
  it("constructs repository Layers without opening a connection", () => {
    const layer = createPostgresPricingRepositoryLayer().pipe(
      Layer.provide(createLiveDatabaseLayer())
    );

    expect(Layer.isLayer(layer)).toBe(true);
  });
});

describeLivePostgres("PostgreSQL pricing repository Layer", () => {
  const liveDatabaseLayer = createLiveDatabaseLayer();
  const liveRepositoryLayer = createPostgresPricingRepositoryLayer().pipe(
    Layer.provide(liveDatabaseLayer)
  );
  const liveRuntime = ManagedRuntime.make(
    Layer.merge(liveDatabaseLayer, liveRepositoryLayer)
  );

  afterAll(async () => {
    await liveRuntime.dispose();
  });

  it("saves and reads pricing records", async () => {
    await liveRuntime.runPromise(
      resetPostgresDevelopmentDatabase({ allowDestructive: true }).pipe(
        Effect.andThen(runPostgresMigrations()),
        Effect.provide(liveDatabaseLayer)
      )
    );

    const currency = createCurrency("USD");
    const priceSet = {
      createdAt,
      id: createPriceSetId("pset_contract"),
      metadata: {},
      title: "Contract price set",
      updatedAt: createdAt,
    };
    const priceList = createPriceList("plist_contract");
    const amount: MoneyAmountRecord = {
      amount: 2500,
      createdAt,
      currencyCode: "USD",
      id: createMoneyAmountId("amt_contract"),
      priceListId: priceList.id,
      priceSetId: priceSet.id,
      rules: { customerGroupId: "vip" },
      updatedAt: createdAt,
    };
    const rule: PriceRuleRecord = {
      attribute: "customerGroupId",
      createdAt,
      id: createPriceRuleId("prule_contract"),
      priceListId: priceList.id,
      updatedAt: createdAt,
      value: "vip",
    };

    await liveRuntime.runPromise(
      PricingRepositoryService.use((repository) =>
        repository
          .saveCurrency(currency)
          .pipe(
            Effect.andThen(repository.savePriceSet(priceSet)),
            Effect.andThen(repository.savePriceList(priceList)),
            Effect.andThen(repository.saveMoneyAmount(amount)),
            Effect.andThen(repository.savePriceRule(rule))
          )
      )
    );

    await expect(
      liveRuntime.runPromise(
        PricingRepositoryService.use((repository) =>
          repository.findCurrencyByCode("USD")
        )
      )
    ).resolves.toEqual(currency);
    await expect(
      liveRuntime.runPromise(
        PricingRepositoryService.use((repository) =>
          repository.findMoneyAmountsForPriceSet(priceSet.id)
        )
      )
    ).resolves.toEqual([amount]);
    await expect(
      liveRuntime.runPromise(
        PricingRepositoryService.use((repository) =>
          repository.findPriceRulesByPriceListId(priceList.id)
        )
      )
    ).resolves.toEqual([rule]);
  });

  it("rolls back pricing writes inside PostgreSQL transactions", async () => {
    await liveRuntime.runPromise(resetPostgresPricingTables);

    const rollbackExit = await liveRuntime.runPromiseExit(
      withPostgresPricingTransaction(
        PricingRepositoryService.use((repository) =>
          repository
            .saveCurrency(createCurrency("EUR"))
            .pipe(Effect.andThen(Effect.fail("force-rollback")))
        )
      )
    );
    const loaded = await liveRuntime.runPromise(
      PricingRepositoryService.use((repository) =>
        repository.findCurrencyByCode("EUR")
      )
    );

    expect(Exit.isFailure(rollbackExit)).toBe(true);
    expect(loaded).toBeNull();
  });
});

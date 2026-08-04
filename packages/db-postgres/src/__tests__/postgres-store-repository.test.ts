import { afterAll, describe, expect, it } from "bun:test";

import {
  createRepositoryContractHarness,
  type RepositoryContractCase,
} from "@ecommerce/core/testing";
import { createStoreId, StoreRepositoryService } from "@ecommerce/store";
import type { StoreRepository, StoreSettings } from "@ecommerce/store";
import { Effect, Exit, Layer, ManagedRuntime, Redacted } from "effect";

import {
  createPostgresClientLayer,
  createPostgresDrizzleLayer,
  createPostgresPoolConfig,
  createPostgresStoreRepositoryLayer,
  postgresAdapterTarget,
  resetPostgresDevelopmentDatabase,
  resetPostgresStoreTables,
  runPostgresMigrations,
  withPostgresStoreTransaction,
} from "../index";
import {
  createLocalPostgresRepositoryContractHarness,
  localPostgresContractUrlEnv,
} from "../repository-contract-harness";

const livePostgresUrl = process.env[localPostgresContractUrlEnv];
const describeLivePostgres = livePostgresUrl ? describe : describe.skip;

const createStoreSettings = (name: string): StoreSettings => ({
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  defaultCurrencyCode: "USD",
  defaultLocale: "en-US",
  defaultRegionId: null,
  defaultSalesChannelId: null,
  id: createStoreId("store_postgres_contract"),
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

const createLiveDatabaseLayer = () =>
  createPostgresClientLayer(
    createPostgresPoolConfig({
      applicationName: "@ecommerce/db-postgres:store-repository",
      maxConnections: 2,
      url: Redacted.make(livePostgresUrl ?? "postgres://missing"),
    })
  ).pipe((clientLayer) =>
    Layer.merge(
      clientLayer,
      createPostgresDrizzleLayer().pipe(Layer.provide(clientLayer))
    )
  );

describe("PostgreSQL store repository Layer", () => {
  it("constructs a repository Layer without opening a connection", () => {
    const harness = createRepositoryContractHarness({
      adapter: postgresAdapterTarget,
      layer: createPostgresStoreRepositoryLayer().pipe(
        Layer.provide(createLiveDatabaseLayer())
      ),
      repositoryName: "StoreRepository",
    });

    expect(harness.adapter).toBe(postgresAdapterTarget);
    expect(harness.repositoryName).toBe("StoreRepository");
    expect(Effect.isEffect(harness.runAll(storeRepositoryContractCases))).toBe(
      true
    );
  });

  it("skips the live contract harness when no PostgreSQL URL is configured", () => {
    const originalUrl = process.env[localPostgresContractUrlEnv];

    delete process.env[localPostgresContractUrlEnv];

    const result = createLocalPostgresRepositoryContractHarness({
      repositoryLayer: createPostgresStoreRepositoryLayer(),
      repositoryName: "StoreRepository",
      reset: resetPostgresStoreTables,
    });

    if (originalUrl) {
      process.env[localPostgresContractUrlEnv] = originalUrl;
    }

    expect(result).toEqual({
      _tag: "skipped",
      reason: "missing-postgres-url",
    });
  });
});

describeLivePostgres("PostgreSQL store repository Layer", () => {
  const liveDatabaseLayer = createLiveDatabaseLayer();
  const liveRepositoryLayer = createPostgresStoreRepositoryLayer().pipe(
    Layer.provide(liveDatabaseLayer)
  );
  const liveRuntime = ManagedRuntime.make(
    Layer.merge(liveDatabaseLayer, liveRepositoryLayer)
  );
  const liveHarness = createLocalPostgresRepositoryContractHarness({
    databaseUrl: livePostgresUrl,
    repositoryLayer: createPostgresStoreRepositoryLayer(),
    repositoryName: "StoreRepository",
    reset: resetPostgresStoreTables,
  });

  afterAll(async () => {
    await liveRuntime.dispose();
  });

  it("runs the store repository contract against local PostgreSQL", async () => {
    expect(liveHarness._tag).toBe("available");

    if (liveHarness._tag === "available") {
      await Effect.runPromise(
        liveHarness.harness.runAll(storeRepositoryContractCases)
      );
    }
  });

  it("rolls back store writes inside PostgreSQL transactions", async () => {
    await liveRuntime.runPromise(
      resetPostgresDevelopmentDatabase({
        allowDestructive: true,
      }).pipe(
        Effect.andThen(runPostgresMigrations()),
        Effect.provide(liveDatabaseLayer)
      )
    );

    const rollbackExit = await liveRuntime.runPromiseExit(
      withPostgresStoreTransaction(
        StoreRepositoryService.use((repository) =>
          repository
            .saveStoreSettings(createStoreSettings("Rolled Back"))
            .pipe(Effect.andThen(Effect.fail("force-rollback")))
        )
      )
    );
    const loaded = await liveRuntime.runPromise(
      StoreRepositoryService.use((repository) => repository.getStoreSettings)
    );

    expect(Exit.isFailure(rollbackExit)).toBe(true);
    expect(loaded).toBeNull();
  });
});

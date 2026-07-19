import { afterAll, describe, expect, it } from "bun:test";

import {
  RegionRepositoryService,
  SalesChannelRepositoryService,
  createRegionId,
  createSalesChannelId,
} from "@ecommerce/region-sales-channel";
import type {
  RegionRecord,
  SalesChannelRecord,
} from "@ecommerce/region-sales-channel";
import { Effect, Exit, Layer, ManagedRuntime, Redacted } from "effect";

import {
  createPostgresClientLayer,
  createPostgresDrizzleLayer,
  createPostgresRegionSalesChannelRepositoryLayer,
  resetPostgresDevelopmentDatabase,
  resetPostgresRegionSalesChannelTables,
  runPostgresMigrations,
  withPostgresRegionSalesChannelTransaction,
} from "../index";
import { localPostgresContractUrlEnv } from "../repository-contract-harness";

const livePostgresUrl = process.env[localPostgresContractUrlEnv];
const describeLivePostgres = livePostgresUrl ? describe : describe.skip;

const createRegionRecord = (id: string, createdAt: Date): RegionRecord => ({
  countries: ["US"],
  createdAt,
  currencyCode: "USD",
  id: createRegionId(id),
  metadata: {},
  name: `Region ${id}`,
  providerAvailability: {
    fulfillmentOptionIds: ["ship_standard"],
    paymentProviderIds: ["manual"],
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
  productIds: ["prod_1"],
  status: "active",
  updatedAt: createdAt,
});

const createLiveDatabaseLayer = () =>
  createPostgresClientLayer({
    applicationName: "@ecommerce/db-postgres:region-sales-channel-repository",
    maxConnections: 2,
    url: Redacted.make(livePostgresUrl ?? "postgres://missing"),
  }).pipe((clientLayer) =>
    Layer.merge(
      clientLayer,
      createPostgresDrizzleLayer().pipe(Layer.provide(clientLayer))
    )
  );

describe("PostgreSQL region sales-channel repository Layer", () => {
  it("constructs repository Layers without opening a connection", () => {
    const layer = createPostgresRegionSalesChannelRepositoryLayer().pipe(
      Layer.provide(createLiveDatabaseLayer())
    );

    expect(Layer.isLayer(layer)).toBe(true);
  });
});

describeLivePostgres("PostgreSQL region sales-channel repository Layer", () => {
  const liveDatabaseLayer = createLiveDatabaseLayer();
  const liveRepositoryLayer =
    createPostgresRegionSalesChannelRepositoryLayer().pipe(
      Layer.provide(liveDatabaseLayer)
    );
  const liveRuntime = ManagedRuntime.make(
    Layer.merge(liveDatabaseLayer, liveRepositoryLayer)
  );

  afterAll(async () => {
    await liveRuntime.dispose();
  });

  it("saves and reads regions and sales channels", async () => {
    await liveRuntime.runPromise(
      resetPostgresDevelopmentDatabase({ allowDestructive: true }).pipe(
        Effect.andThen(runPostgresMigrations()),
        Effect.provide(liveDatabaseLayer)
      )
    );

    const region = createRegionRecord(
      "reg_contract",
      new Date("2026-01-01T00:00:00.000Z")
    );
    const channel = createSalesChannelRecord(
      "sc_contract",
      new Date("2026-01-02T00:00:00.000Z")
    );

    await liveRuntime.runPromise(
      RegionRepositoryService.use((repository) => repository.saveRegion(region))
    );
    await liveRuntime.runPromise(
      SalesChannelRepositoryService.use((repository) =>
        repository.saveSalesChannel(channel)
      )
    );

    await expect(
      liveRuntime.runPromise(
        RegionRepositoryService.use((repository) =>
          repository.findRegionById(region.id)
        )
      )
    ).resolves.toEqual(region);
    await expect(
      liveRuntime.runPromise(
        SalesChannelRepositoryService.use((repository) =>
          repository.findSalesChannelById(channel.id)
        )
      )
    ).resolves.toEqual(channel);
  });

  it("rolls back region sales-channel writes inside PostgreSQL transactions", async () => {
    await liveRuntime.runPromise(resetPostgresRegionSalesChannelTables);

    const rollbackExit = await liveRuntime.runPromiseExit(
      withPostgresRegionSalesChannelTransaction(
        RegionRepositoryService.use((repository) =>
          repository
            .saveRegion(
              createRegionRecord(
                "reg_rolled_back",
                new Date("2026-01-01T00:00:00.000Z")
              )
            )
            .pipe(Effect.andThen(Effect.fail("force-rollback")))
        )
      )
    );
    const loaded = await liveRuntime.runPromise(
      RegionRepositoryService.use((repository) =>
        repository.findRegionById(createRegionId("reg_rolled_back"))
      )
    );

    expect(Exit.isFailure(rollbackExit)).toBe(true);
    expect(loaded).toBeNull();
  });
});

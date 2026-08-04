import { afterAll, describe, expect, it } from "bun:test";

import {
  createRepositoryContractHarness,
  type RepositoryContractCase,
} from "@ecommerce/core/testing";
import { createProductId, ProductRepositoryService } from "@ecommerce/product";
import type { ProductRecord, ProductRepository } from "@ecommerce/product";
import { Effect, Exit, Layer, ManagedRuntime, Redacted } from "effect";

import {
  createPostgresClientLayer,
  createPostgresDrizzleLayer,
  createPostgresProductRepositoryLayer,
  postgresAdapterTarget,
  resetPostgresDevelopmentDatabase,
  resetPostgresProductTables,
  runPostgresMigrations,
  withPostgresProductTransaction,
} from "../index";
import {
  createLocalPostgresRepositoryContractHarness,
  localPostgresContractUrlEnv,
} from "../repository-contract-harness";

const livePostgresUrl = process.env[localPostgresContractUrlEnv];
const describeLivePostgres = livePostgresUrl ? describe : describe.skip;

const createProductRecord = (id: string, createdAt: Date): ProductRecord => ({
  catalog: {
    categories: [],
    collections: [],
    media: [],
    metadata: {},
    options: [],
    publishedAt: null,
    searchableText: "",
    tags: [],
    variants: [],
  },
  createdAt,
  handle: `handle-${id}`,
  id: createProductId(id),
  status: "draft",
  title: `Product ${id}`,
  updatedAt: createdAt,
});

const productRepositoryContractCases: readonly RepositoryContractCase<ProductRepository>[] =
  [
    {
      name: "saves and reads products by ID and handle",
      run: ProductRepositoryService.use((repository) =>
        Effect.gen(function* savesAndReadsProductsContract() {
          const product = createProductRecord(
            "prod_contract_1",
            new Date("2026-01-01T00:00:00.000Z")
          );

          const saved = yield* repository.saveProduct(product);
          const byId = yield* repository.findProductById(product.id);
          const byHandle = yield* repository.findProductByHandle(
            product.handle
          );

          expect(saved).toEqual(product);
          expect(byId).toEqual(product);
          expect(byHandle).toEqual(product);
        })
      ),
    },
    {
      name: "lists newest products first",
      run: ProductRepositoryService.use((repository) =>
        Effect.gen(function* listsNewestProductsFirstContract() {
          const older = createProductRecord(
            "prod_contract_older",
            new Date("2026-01-01T00:00:00.000Z")
          );
          const newer = createProductRecord(
            "prod_contract_newer",
            new Date("2026-01-02T00:00:00.000Z")
          );

          yield* repository.saveProduct(older);
          yield* repository.saveProduct(newer);

          const products = yield* repository.listProducts;

          expect(products).toEqual([newer, older]);
        })
      ),
    },
  ];

const createLiveDatabaseLayer = () =>
  createPostgresClientLayer({
    applicationName: "@ecommerce/db-postgres:product-repository",
    maxConnections: 2,
    url: Redacted.make(livePostgresUrl ?? "postgres://missing"),
  }).pipe((clientLayer) =>
    Layer.merge(
      clientLayer,
      createPostgresDrizzleLayer().pipe(Layer.provide(clientLayer))
    )
  );

describe("PostgreSQL product repository Layer", () => {
  it("constructs a repository Layer without opening a connection", () => {
    const harness = createRepositoryContractHarness({
      adapter: postgresAdapterTarget,
      layer: createPostgresProductRepositoryLayer().pipe(
        Layer.provide(createLiveDatabaseLayer())
      ),
      repositoryName: "ProductRepository",
    });

    expect(harness.adapter).toBe(postgresAdapterTarget);
    expect(harness.repositoryName).toBe("ProductRepository");
    expect(
      Effect.isEffect(harness.runAll(productRepositoryContractCases))
    ).toBe(true);
  });

  it("skips the live contract harness when no PostgreSQL URL is configured", () => {
    const originalUrl = process.env[localPostgresContractUrlEnv];

    delete process.env[localPostgresContractUrlEnv];

    const result = createLocalPostgresRepositoryContractHarness({
      repositoryLayer: createPostgresProductRepositoryLayer(),
      repositoryName: "ProductRepository",
      reset: resetPostgresProductTables,
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

describeLivePostgres("PostgreSQL product repository Layer", () => {
  const liveDatabaseLayer = createLiveDatabaseLayer();
  const liveRepositoryLayer = createPostgresProductRepositoryLayer().pipe(
    Layer.provide(liveDatabaseLayer)
  );
  const liveRuntime = ManagedRuntime.make(
    Layer.merge(liveDatabaseLayer, liveRepositoryLayer)
  );
  const liveHarness = createLocalPostgresRepositoryContractHarness({
    databaseUrl: livePostgresUrl,
    repositoryLayer: createPostgresProductRepositoryLayer(),
    repositoryName: "ProductRepository",
    reset: resetPostgresProductTables,
  });

  afterAll(async () => {
    await liveRuntime.dispose();
  });

  it("runs the product repository contract against local PostgreSQL", async () => {
    expect(liveHarness._tag).toBe("available");

    if (liveHarness._tag === "available") {
      await Effect.runPromise(
        liveHarness.harness.runAll(productRepositoryContractCases)
      );
    }
  });

  it("rolls back product writes inside PostgreSQL transactions", async () => {
    await liveRuntime.runPromise(
      resetPostgresDevelopmentDatabase({
        allowDestructive: true,
      }).pipe(
        Effect.andThen(runPostgresMigrations()),
        Effect.provide(liveDatabaseLayer)
      )
    );

    const rollbackExit = await liveRuntime.runPromiseExit(
      withPostgresProductTransaction(
        ProductRepositoryService.use((repository) =>
          repository
            .saveProduct(
              createProductRecord(
                "prod_rolled_back",
                new Date("2026-01-01T00:00:00.000Z")
              )
            )
            .pipe(Effect.andThen(Effect.fail("force-rollback")))
        )
      )
    );
    const loaded = await liveRuntime.runPromise(
      ProductRepositoryService.use((repository) =>
        repository.findProductById(createProductId("prod_rolled_back"))
      )
    );

    expect(Exit.isFailure(rollbackExit)).toBe(true);
    expect(loaded).toBeNull();
  });
});

import { describe, expect, it } from "bun:test";

import { Context, Effect, Layer } from "effect";

import {
  PostgresDrizzleService,
  postgresAdapterTarget,
  type PostgresDrizzleService as PostgresDrizzleServiceShape,
} from "../index";
import {
  createLocalPostgresRepositoryContractHarness,
  localPostgresContractUrlEnv,
} from "../repository-contract-harness";

class StoreRepository extends Context.Service<
  StoreRepository,
  {
    readonly adapterName: Effect.Effect<string>;
  }
>()("test/PostgresRepositoryContractHarness/StoreRepository") {}

const makeRepositoryLayer = () =>
  Layer.effect(
    StoreRepository,
    PostgresDrizzleService.use((service) =>
      Effect.succeed(
        StoreRepository.of({
          adapterName: Effect.succeed(
            service ? postgresAdapterTarget : "missing"
          ),
        })
      )
    )
  );

describe("local PostgreSQL repository contract harness", () => {
  it("skips live contract harnesses when no PostgreSQL URL is configured", () => {
    const originalUrl = process.env[localPostgresContractUrlEnv];

    delete process.env[localPostgresContractUrlEnv];

    const result = createLocalPostgresRepositoryContractHarness({
      migrateBeforeEach: false,
      repositoryLayer: makeRepositoryLayer(),
      repositoryName: "StoreRepository",
    });

    if (originalUrl) {
      process.env[localPostgresContractUrlEnv] = originalUrl;
    }

    expect(result).toEqual({
      _tag: "skipped",
      reason: "missing-postgres-url",
    });
  });

  it("constructs an available harness from an explicit URL without opening a connection", () => {
    const result = createLocalPostgresRepositoryContractHarness({
      databaseUrl: "postgres://user:password@example.test:5432/ecommerce",
      migrateBeforeEach: false,
      repositoryLayer: makeRepositoryLayer(),
      repositoryName: "StoreRepository",
      reset: PostgresDrizzleService.use((service) =>
        Effect.sync(() => {
          expect(Boolean(service)).toBe(true);
        })
      ),
    });

    expect(result._tag).toBe("available");

    if (result._tag === "available") {
      expect(result.databaseUrlSource).toBe("explicit");
      expect(result.harness.adapter).toBe(postgresAdapterTarget);
      expect(result.harness.repositoryName).toBe("StoreRepository");
      expect(
        Effect.isEffect(
          result.harness.runCase({
            name: "reads adapter name",
            run: StoreRepository.use((repository) =>
              repository.adapterName.pipe(
                Effect.map((adapterName) => {
                  expect(adapterName).toBe(postgresAdapterTarget);
                })
              )
            ),
          })
        )
      ).toBe(true);
    }
  });

  it("accepts repository reset effects that require the PostgreSQL adapter service", () => {
    const reset = (
      PostgresDrizzleService.use((service: PostgresDrizzleServiceShape) =>
        Effect.succeed(Boolean(service.database))
      ) satisfies Effect.Effect<boolean, unknown, PostgresDrizzleService>
    ).pipe(Effect.asVoid);

    const result = createLocalPostgresRepositoryContractHarness({
      databaseUrl: "postgres://user:password@example.test:5432/ecommerce",
      migrateBeforeEach: false,
      repositoryLayer: makeRepositoryLayer(),
      repositoryName: "StoreRepository",
      reset,
    });

    expect(result._tag).toBe("available");
  });
});

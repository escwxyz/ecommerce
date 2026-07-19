import { afterAll, describe, expect, it } from "bun:test";

import {
  createRepositoryContractHarness,
  type RepositoryContractCase,
} from "@ecommerce/core/testing";
import {
  CustomerRepositoryService,
  createCustomerAddressId,
  createCustomerGroupId,
  createCustomerId,
} from "@ecommerce/customer";
import type {
  CustomerGroup,
  CustomerProfile,
  CustomerRepository,
} from "@ecommerce/customer";
import { Effect, Exit, Layer, ManagedRuntime, Redacted } from "effect";

import {
  createPostgresClientLayer,
  createPostgresCustomerRepositoryLayer,
  createPostgresDrizzleLayer,
  createPostgresPoolConfig,
  postgresAdapterTarget,
  resetPostgresCustomerTables,
  resetPostgresDevelopmentDatabase,
  runPostgresMigrations,
  withPostgresCustomerTransaction,
} from "../index";
import {
  createLocalPostgresRepositoryContractHarness,
  localPostgresContractUrlEnv,
} from "../repository-contract-harness";

const livePostgresUrl = process.env[localPostgresContractUrlEnv];
const describeLivePostgres = livePostgresUrl ? describe : describe.skip;

const createCustomerRecord = (
  id: string,
  createdAt: Date
): CustomerProfile => ({
  addresses: [],
  authUserId: null,
  createdAt,
  email: `${id}@example.com`,
  groupIds: [],
  id: createCustomerId(id),
  metadata: {},
  updatedAt: createdAt,
});

const customerRepositoryContractCases: readonly RepositoryContractCase<CustomerRepository>[] =
  [
    {
      name: "saves and reads customers by ID, email, and auth user",
      run: CustomerRepositoryService.use((repository) =>
        Effect.gen(function* savesAndReadsCustomersContract() {
          const customer = {
            ...createCustomerRecord(
              "cust_postgres_contract",
              new Date("2026-01-01T00:00:00.000Z")
            ),
            authUserId: "user_postgres_contract",
          };

          yield* repository.saveCustomer(customer);

          const byId = yield* repository.findCustomerById(customer.id);
          const byEmail = yield* repository.findCustomerByEmail(
            "CUST_POSTGRES_CONTRACT@example.com"
          );
          const byAuth = yield* repository.findCustomerByAuthUserId(
            "user_postgres_contract"
          );

          expect(byId).toEqual(customer);
          expect(byEmail).toEqual(customer);
          expect(byAuth).toEqual(customer);
        })
      ),
    },
    {
      name: "adds addresses and customer group assignments",
      run: CustomerRepositoryService.use((repository) =>
        Effect.gen(function* addsRelationsContract() {
          const customer = createCustomerRecord(
            "cust_postgres_grouped",
            new Date("2026-01-01T00:00:00.000Z")
          );
          const group: CustomerGroup = {
            handle: "vip",
            id: createCustomerGroupId("cgrp_postgres_vip"),
            metadata: {},
            name: "VIP",
          };

          yield* repository.saveCustomer(customer);
          yield* repository.saveCustomerGroup(group);
          yield* repository.assignCustomerGroup({
            customerId: customer.id,
            groupId: group.id,
          });
          const updated = yield* repository.addCustomerAddress({
            address: {
              address1: "1 Main St",
              city: "London",
              countryCode: "GB",
              id: createCustomerAddressId("caddr_postgres_home"),
              isDefaultBilling: true,
              isDefaultShipping: true,
              kind: "shipping",
              metadata: {},
              postalCode: "SW1A 1AA",
            },
            customerId: customer.id,
          });

          expect(updated).toMatchObject({
            addresses: [{ id: "caddr_postgres_home" }],
            groupIds: ["cgrp_postgres_vip"],
          });
        })
      ),
    },
  ];

const createLiveDatabaseLayer = () =>
  createPostgresClientLayer(
    createPostgresPoolConfig({
      applicationName: "@ecommerce/db-postgres:customer-repository",
      maxConnections: 2,
      url: Redacted.make(livePostgresUrl ?? "postgres://missing"),
    })
  ).pipe((clientLayer) =>
    Layer.merge(
      clientLayer,
      createPostgresDrizzleLayer().pipe(Layer.provide(clientLayer))
    )
  );

describe("PostgreSQL customer repository Layer", () => {
  it("constructs a repository Layer without opening a connection", () => {
    const harness = createRepositoryContractHarness({
      adapter: postgresAdapterTarget,
      layer: createPostgresCustomerRepositoryLayer().pipe(
        Layer.provide(createLiveDatabaseLayer())
      ),
      repositoryName: "CustomerRepository",
    });

    expect(harness.adapter).toBe(postgresAdapterTarget);
    expect(harness.repositoryName).toBe("CustomerRepository");
    expect(
      Effect.isEffect(harness.runAll(customerRepositoryContractCases))
    ).toBe(true);
  });

  it("skips the live contract harness when no PostgreSQL URL is configured", () => {
    const originalUrl = process.env[localPostgresContractUrlEnv];

    delete process.env[localPostgresContractUrlEnv];

    const result = createLocalPostgresRepositoryContractHarness({
      repositoryLayer: createPostgresCustomerRepositoryLayer(),
      repositoryName: "CustomerRepository",
      reset: resetPostgresCustomerTables,
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

describeLivePostgres("PostgreSQL customer repository Layer", () => {
  const liveDatabaseLayer = createLiveDatabaseLayer();
  const liveRepositoryLayer = createPostgresCustomerRepositoryLayer().pipe(
    Layer.provide(liveDatabaseLayer)
  );
  const liveRuntime = ManagedRuntime.make(
    Layer.merge(liveDatabaseLayer, liveRepositoryLayer)
  );
  const liveHarness = createLocalPostgresRepositoryContractHarness({
    databaseUrl: livePostgresUrl,
    repositoryLayer: createPostgresCustomerRepositoryLayer(),
    repositoryName: "CustomerRepository",
    reset: resetPostgresCustomerTables,
  });

  afterAll(async () => {
    await liveRuntime.dispose();
  });

  it("runs the customer repository contract against local PostgreSQL", async () => {
    expect(liveHarness._tag).toBe("available");

    if (liveHarness._tag === "available") {
      await Effect.runPromise(
        liveHarness.harness.runAll(customerRepositoryContractCases)
      );
    }
  });

  it("rolls back customer writes inside PostgreSQL transactions", async () => {
    await liveRuntime.runPromise(
      resetPostgresDevelopmentDatabase({
        allowDestructive: true,
      }).pipe(
        Effect.andThen(runPostgresMigrations()),
        Effect.provide(liveDatabaseLayer)
      )
    );

    const rollbackExit = await liveRuntime.runPromiseExit(
      withPostgresCustomerTransaction(
        CustomerRepositoryService.use((repository) =>
          repository
            .saveCustomer(
              createCustomerRecord(
                "cust_postgres_rollback",
                new Date("2026-01-01T00:00:00.000Z")
              )
            )
            .pipe(Effect.andThen(Effect.fail("force-rollback")))
        )
      )
    );
    const loaded = await liveRuntime.runPromise(
      CustomerRepositoryService.use((repository) =>
        repository.findCustomerById(createCustomerId("cust_postgres_rollback"))
      )
    );

    expect(Exit.isFailure(rollbackExit)).toBe(true);
    expect(loaded).toBeNull();
  });
});

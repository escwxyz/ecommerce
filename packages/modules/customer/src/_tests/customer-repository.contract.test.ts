import { Database, type SQLQueryBindings } from "bun:sqlite";
import { afterEach, describe, expect, it } from "bun:test";

import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";

import { createD1CustomerRepository } from "../adapters/d1";
import {
  createCustomerAddressId,
  createCustomerGroupId,
  createCustomerId,
  customerMigration,
  type CustomerDatabase,
  type CustomerProfile,
  type CustomerRepository,
} from "../domain";
import { createInMemoryCustomerRepository } from "../repositories";

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

const runCustomerRepositoryContract = (
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

    it("saves and reads customers by ID, email, and auth user", async () => {
      const repository = await setup();
      const customer = {
        ...createCustomerRecord(
          "cust_contract_1",
          new Date("2026-01-01T00:00:00.000Z")
        ),
        authUserId: "user_contract",
      };

      await expect(repository.saveCustomer(customer)).resolves.toEqual(
        customer
      );
      await expect(repository.findCustomerById(customer.id)).resolves.toEqual(
        customer
      );
      await expect(
        repository.findCustomerByEmail("CUST_CONTRACT_1@example.com")
      ).resolves.toEqual(customer);
      await expect(
        repository.findCustomerByAuthUserId("user_contract")
      ).resolves.toEqual(customer);
    });

    it("lists newest customers first", async () => {
      const repository = await setup();
      const older = createCustomerRecord(
        "cust_older",
        new Date("2026-01-01T00:00:00.000Z")
      );
      const newer = createCustomerRecord(
        "cust_newer",
        new Date("2026-01-02T00:00:00.000Z")
      );

      await repository.saveCustomer(older);
      await repository.saveCustomer(newer);

      await expect(repository.listCustomers()).resolves.toEqual([newer, older]);
    });

    it("adds addresses and customer group assignments", async () => {
      const repository = await setup();
      const customer = createCustomerRecord(
        "cust_grouped",
        new Date("2026-01-01T00:00:00.000Z")
      );
      const group = {
        handle: "vip",
        id: createCustomerGroupId("cgrp_vip"),
        metadata: {},
        name: "VIP",
      };

      await repository.saveCustomer(customer);
      await repository.saveCustomerGroup(group);
      await repository.assignCustomerGroup({
        customerId: customer.id,
        groupId: group.id,
      });

      await expect(
        repository.addCustomerAddress({
          address: {
            address1: "1 Main St",
            city: "London",
            countryCode: "GB",
            id: createCustomerAddressId("caddr_home"),
            isDefaultBilling: true,
            isDefaultShipping: true,
            kind: "shipping",
            metadata: {},
            postalCode: "SW1A 1AA",
          },
          customerId: customer.id,
        })
      ).resolves.toMatchObject({
        addresses: [{ id: "caddr_home" }],
        groupIds: ["cgrp_vip"],
      });
    });
  });
};

interface RepositoryTestContext {
  readonly cleanup?: () => void;
  readonly repository: CustomerRepository;
}

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

const createKyselyD1CustomerDatabase = (sqlite: Database) =>
  new Kysely<CustomerDatabase>({
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

const createMigratedD1CustomerContext = async (): Promise<{
  readonly db: Kysely<CustomerDatabase>;
  readonly repository: CustomerRepository;
  readonly sqlite: Database;
}> => {
  const sqlite = new Database(":memory:");
  sqlite.exec("pragma foreign_keys = on");
  const db = createKyselyD1CustomerDatabase(sqlite);
  await customerMigration.up(db);

  return {
    db,
    repository: createD1CustomerRepository({ db }),
    sqlite,
  };
};

runCustomerRepositoryContract("in-memory customer repository", () => ({
  repository: createInMemoryCustomerRepository(),
}));

runCustomerRepositoryContract("D1 customer repository", async () => {
  const { repository, sqlite } = await createMigratedD1CustomerContext();

  return {
    cleanup: () => sqlite.close(),
    repository,
  };
});

describe("D1 customer repository persistence constraints", () => {
  it("persists customer-owned addresses and group assignments in normalized tables", async () => {
    const { repository, sqlite } = await createMigratedD1CustomerContext();
    const customer = createCustomerRecord(
      "cust_normalized",
      new Date("2026-01-01T00:00:00.000Z")
    );
    const group = {
      handle: "vip",
      id: createCustomerGroupId("cgrp_vip"),
      metadata: { tier: "gold" },
      name: "VIP",
    };

    await repository.saveCustomer(customer);
    await repository.saveCustomerGroup(group);
    await repository.assignCustomerGroup({
      customerId: customer.id,
      groupId: group.id,
    });
    await repository.addCustomerAddress({
      address: {
        address1: "1 Main St",
        city: "London",
        countryCode: "GB",
        id: createCustomerAddressId("caddr_home"),
        isDefaultBilling: true,
        isDefaultShipping: true,
        kind: "shipping",
        metadata: { label: "home" },
        postalCode: "SW1A 1AA",
      },
      customerId: customer.id,
    });

    const countRows = (tableName: string) =>
      sqlite.query(`select count(*) as count from ${tableName}`).get() as {
        count: number;
      };

    expect(countRows("customer").count).toBe(1);
    expect(countRows("customer_address").count).toBe(1);
    expect(countRows("customer_group").count).toBe(1);
    expect(countRows("customer_group_customer").count).toBe(1);
    await expect(
      repository.findCustomerById(customer.id)
    ).resolves.toMatchObject({
      addresses: [{ id: "caddr_home", metadata: { label: "home" } }],
      groupIds: ["cgrp_vip"],
    });

    sqlite.close();
  });
});

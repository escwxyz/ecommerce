import { describe, expect, it } from "bun:test";

import {
  createRepositoryContractHarness,
  type RepositoryContractCase,
} from "@ecommerce/core/testing";
import { Effect, Layer } from "effect";

import {
  CustomerRepositoryService,
  createCustomerAddressId,
  createCustomerGroupId,
  createCustomerId,
} from "../domain";
import type {
  CustomerGroup,
  CustomerProfile,
  CustomerRepository,
} from "../domain";
import { createResettableInMemoryCustomerRepository } from "../repositories";

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

export const customerRepositoryContractCases: readonly RepositoryContractCase<CustomerRepository>[] =
  [
    {
      name: "saves and reads customers by ID, email, and auth user",
      run: CustomerRepositoryService.use((repository) =>
        Effect.gen(function* savesAndReadsCustomersContract() {
          const customer = {
            ...createCustomerRecord(
              "cust_contract_1",
              new Date("2026-01-01T00:00:00.000Z")
            ),
            authUserId: "user_contract",
          };

          const saved = yield* repository.saveCustomer(customer);
          const byId = yield* repository.findCustomerById(customer.id);
          const byEmail = yield* repository.findCustomerByEmail(
            "CUST_CONTRACT_1@example.com"
          );
          const byAuth =
            yield* repository.findCustomerByAuthUserId("user_contract");

          expect(saved).toEqual(customer);
          expect(byId).toEqual(customer);
          expect(byEmail).toEqual(customer);
          expect(byAuth).toEqual(customer);
        })
      ),
    },
    {
      name: "lists newest customers first",
      run: CustomerRepositoryService.use((repository) =>
        Effect.gen(function* listsNewestCustomersFirstContract() {
          const older = createCustomerRecord(
            "cust_older",
            new Date("2026-01-01T00:00:00.000Z")
          );
          const newer = createCustomerRecord(
            "cust_newer",
            new Date("2026-01-02T00:00:00.000Z")
          );

          yield* repository.saveCustomer(older);
          yield* repository.saveCustomer(newer);

          const customers = yield* repository.listCustomers;

          expect(customers).toEqual([newer, older]);
        })
      ),
    },
    {
      name: "adds addresses and customer group assignments",
      run: CustomerRepositoryService.use((repository) =>
        Effect.gen(function* addsRelationsContract() {
          const customer = createCustomerRecord(
            "cust_grouped",
            new Date("2026-01-01T00:00:00.000Z")
          );
          const group: CustomerGroup = {
            handle: "vip",
            id: createCustomerGroupId("cgrp_vip"),
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
              id: createCustomerAddressId("caddr_home"),
              isDefaultBilling: true,
              isDefaultShipping: true,
              kind: "shipping",
              metadata: {},
              postalCode: "SW1A 1AA",
            },
            customerId: customer.id,
          });

          expect(updated).toMatchObject({
            addresses: [{ id: "caddr_home" }],
            groupIds: ["cgrp_vip"],
          });
        })
      ),
    },
  ];

describe("customer Effect repository contract", () => {
  it("runs against the in-memory repository Layer", async () => {
    const repository = createResettableInMemoryCustomerRepository();
    const harness = createRepositoryContractHarness({
      adapter: "in-memory",
      layer: Layer.succeed(CustomerRepositoryService, repository),
      repositoryName: "CustomerRepository",
      reset: Effect.sync(() => repository.clear()),
    });

    await Effect.runPromise(harness.runAll(customerRepositoryContractCases));

    expect(harness.adapter).toBe("in-memory");
    expect(harness.repositoryName).toBe("CustomerRepository");
  });
});

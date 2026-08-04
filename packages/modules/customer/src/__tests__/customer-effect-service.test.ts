import { describe, expect, it } from "bun:test";

import {
  createCustomerAuthSession,
  createStoreAdminAuthSession,
} from "@ecommerce/auth/testing";
import {
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";
import { Effect, Exit } from "effect";

import { createCustomerId } from "../domain";
import { createInMemoryCustomerRepository } from "../repositories";
import { createCustomerService } from "../services";

describe("customer Effect service", () => {
  it("creates customer profiles, addresses, groups, auth links, and payment identity", async () => {
    const service = createCustomerService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator([
        "cust_1",
        "cgrp_vip",
        "caddr_home",
      ]),
      repository: createInMemoryCustomerRepository(),
    });

    const customer = await Effect.runPromise(
      service.createCustomer({
        authUserId: "user_customer",
        email: "CUSTOMER@EXAMPLE.COM",
        firstName: " Ada ",
        lastName: "Lovelace",
      })
    );
    const group = await Effect.runPromise(
      service.createCustomerGroup({
        handle: "VIP",
        name: "VIP",
      })
    );

    await Effect.runPromise(
      service.assignCustomerGroup({
        customerId: customer.id,
        groupId: group.id,
      })
    );
    const updated = await Effect.runPromise(
      service.addCustomerAddress({
        address1: "1 Main St",
        city: "London",
        countryCode: "gb",
        customerId: customer.id,
        isDefaultBilling: true,
        isDefaultShipping: true,
        kind: "shipping",
        metadata: {},
        postalCode: "SW1A 1AA",
      })
    );

    expect(updated).toMatchObject({
      addresses: [
        {
          countryCode: "GB",
          id: "caddr_home",
        },
      ],
      email: "customer@example.com",
      firstName: "Ada",
      groupIds: ["cgrp_vip"],
      id: "cust_1",
    });
    await expect(
      Effect.runPromise(service.resolveCustomerFromAuthUserId("user_customer"))
    ).resolves.toMatchObject({ id: "cust_1" });
    await expect(
      Effect.runPromise(service.getPaymentIdentity(customer.id))
    ).resolves.toEqual({
      customerId: createCustomerId("cust_1"),
      email: "customer@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      phone: undefined,
    });
  });

  it("uses shared auth contracts to classify customer and store-admin actors", () => {
    const service = createCustomerService({
      repository: createInMemoryCustomerRepository(),
    });

    expect(service.resolveCustomerActor(createCustomerAuthSession()).kind).toBe(
      "customer"
    );
    expect(
      service.resolveCustomerActor(createStoreAdminAuthSession()).kind
    ).toBe("store-admin");
  });

  it("rejects creating two customer profiles for the same auth user", async () => {
    const service = createCustomerService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator(["cust_1", "cust_2"]),
      repository: createInMemoryCustomerRepository(),
    });

    await Effect.runPromise(
      service.createCustomer({
        authUserId: "user_duplicate",
        email: "first@example.com",
      })
    );

    const exit = await Effect.runPromiseExit(
      service.createCustomer({
        authUserId: "user_duplicate",
        email: "second@example.com",
      })
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(String(exit.cause)).toContain("CustomerAuthUserConflict");
    }
  });

  it("returns null payment identity for unknown customers", async () => {
    const service = createCustomerService({
      repository: createInMemoryCustomerRepository(),
    });

    await expect(
      Effect.runPromise(
        service.getPaymentIdentity(createCustomerId("cust_missing"))
      )
    ).resolves.toBeNull();
  });
});

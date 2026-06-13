import { describe, expect, it } from "bun:test";

import {
  createCustomerAuthSession,
  createStoreAdminAuthSession,
} from "@ecommerce/auth/testing";
import {
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";

import { customerContractRouter } from "../contracts";
import { customerModule } from "../module";
import { createInMemoryCustomerRepository } from "../repositories";
import { createCustomerService } from "../services";

describe("customer module foundation", () => {
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

    const customer = await service.createCustomer({
      authUserId: "user_customer",
      email: "CUSTOMER@EXAMPLE.COM",
      firstName: " Ada ",
      lastName: "Lovelace",
    });
    const group = await service.createCustomerGroup({
      handle: "vip",
      name: "VIP",
    });

    await service.assignCustomerGroup({
      customerId: customer.id,
      groupId: group.id,
    });
    const updated = await service.addCustomerAddress({
      address1: "1 Main St",
      city: "London",
      countryCode: "gb",
      customerId: customer.id,
      isDefaultBilling: true,
      isDefaultShipping: true,
      kind: "shipping",
      metadata: {},
      postalCode: "SW1A 1AA",
    });

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
      service.resolveCustomerFromAuthUserId("user_customer")
    ).resolves.toMatchObject({ id: "cust_1" });
    await expect(service.getPaymentIdentity(customer.id)).resolves.toEqual({
      customerId: "cust_1",
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

  it("declares contract-first customer route metadata", () => {
    expect(customerContractRouter.customerCreate["~orpc"].route.method).toBe(
      "POST"
    );
    expect(customerContractRouter.customerCreate["~orpc"].route.summary).toBe(
      "Create customer"
    );
    expect(
      customerContractRouter.customerResolveFromAuth["~orpc"].route.operationId
    ).toBe("customerResolveFromAuth");
    expect(
      customerContractRouter.customerPaymentIdentityGet["~orpc"].route
        .operationId
    ).toBe("customerPaymentIdentityGet");
  });

  it("exposes typed module contributions", () => {
    expect(customerModule.key).toBe("customer");
    expect(customerModule.schema?.tables).toContain("customer_address");
    expect(customerModule.contributions?.apiFragments?.[0]?.key).toBe(
      "module:customer"
    );
    expect(customerModule.contributions?.adminSurfaces?.[0]?.label).toBe(
      "Customers"
    );
    expect(customerModule.contributions?.eventTypes).toContain(
      "customer.auth-linked"
    );
  });
});

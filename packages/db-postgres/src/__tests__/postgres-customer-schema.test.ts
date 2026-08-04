import { describe, expect, it } from "bun:test";

import {
  createCustomerAddressId,
  createCustomerGroupId,
  createCustomerId,
} from "@ecommerce/customer";
import type {
  CustomerAddress,
  CustomerGroup,
  CustomerProfile,
} from "@ecommerce/customer";
import { Effect, Exit, Schema } from "effect";

import {
  CustomerAddressPostgresInsertSchema,
  CustomerGroupPostgresInsertSchema,
  CustomerPostgresInsertSchema,
  CustomerPostgresRowSchema,
  postgresCustomer,
  postgresCustomerAddress,
  postgresCustomerTableName,
  toCustomerAddressPostgresInsert,
  toCustomerGroupPostgresInsert,
  toCustomerPostgresInsert,
} from "../index";

const customerProfile: CustomerProfile = {
  addresses: [],
  authUserId: "user_postgres",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  email: "ada@example.com",
  firstName: "Ada",
  groupIds: [],
  id: createCustomerId("cust_postgres_schema"),
  lastName: "Lovelace",
  metadata: { source: "test" },
  phone: "123",
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

const customerAddress: CustomerAddress = {
  address1: "1 Main St",
  city: "London",
  countryCode: "GB",
  id: createCustomerAddressId("caddr_postgres_schema"),
  isDefaultBilling: true,
  isDefaultShipping: true,
  kind: "shipping",
  metadata: {},
  postalCode: "SW1A 1AA",
};

const customerGroup: CustomerGroup = {
  handle: "vip",
  id: createCustomerGroupId("cgrp_postgres_schema"),
  metadata: {},
  name: "VIP",
};

describe("PostgreSQL customer schema and codecs", () => {
  it("declares the customer PostgreSQL tables and generated storage schemas", async () => {
    const customerInsert = await Effect.runPromise(
      toCustomerPostgresInsert(customerProfile)
    );
    const addressInsert = await Effect.runPromise(
      toCustomerAddressPostgresInsert({
        address: customerAddress,
        customerId: customerProfile.id,
      })
    );
    const groupInsert = await Effect.runPromise(
      toCustomerGroupPostgresInsert(customerGroup)
    );

    expect(postgresCustomerTableName).toBe("customer");
    expect(postgresCustomer.id).toBeDefined();
    expect(postgresCustomerAddress.customerId).toBeDefined();
    expect(
      Schema.decodeUnknownSync(CustomerPostgresInsertSchema)(customerInsert)
    ).toEqual(customerInsert);
    expect(
      Schema.decodeUnknownSync(CustomerAddressPostgresInsertSchema)(
        addressInsert
      )
    ).toEqual(addressInsert);
    expect(
      Schema.decodeUnknownSync(CustomerGroupPostgresInsertSchema)(groupInsert)
    ).toEqual(groupInsert);
  });

  it("preserves customer invariants at the PostgreSQL storage boundary", () => {
    const invalidEmail = Schema.decodeUnknownExit(CustomerPostgresRowSchema)({
      ...customerProfile,
      email: "not-an-email",
      metadataJson: {},
    });

    expect(Exit.isFailure(invalidEmail)).toBe(true);
  });
});

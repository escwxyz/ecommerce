import { describe, expect, it } from "bun:test";

import {
  commerceMigrations,
  type CommerceDatabaseSchemaKey,
  customerSchema,
} from "./index";

describe("customer schema assembly", () => {
  it("contributes customer-owned tables and migration to the shared schema", () => {
    const customerTables = [
      "customer",
      "customer_address",
      "customer_group",
      "customer_group_customer",
    ] satisfies CommerceDatabaseSchemaKey[];

    expect(customerSchema.customerSchema.customer).toBe("customer");
    expect(customerTables).toContain("customer_address");
    expect(commerceMigrations["006_customer"]).toBeDefined();
  });
});

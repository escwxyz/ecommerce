import { describe, expect, it } from "bun:test";

import {
  commerceMigrations,
  type CommerceDatabaseSchemaKey,
  paymentSchema,
} from "./index";

describe("payment schema assembly", () => {
  it("contributes payment-owned tables and migration to the shared schema", () => {
    const paymentTables = [
      "payment_provider",
      "payment_account_holder",
      "payment_method",
      "payment_collection",
      "payment_session",
      "payment",
      "payment_capture",
      "payment_refund",
    ] satisfies CommerceDatabaseSchemaKey[];

    expect(paymentSchema.paymentSchema.collection).toBe("payment_collection");
    expect(paymentTables).toContain("payment_session");
    expect(commerceMigrations["009_payment"]).toBeDefined();
  });
});

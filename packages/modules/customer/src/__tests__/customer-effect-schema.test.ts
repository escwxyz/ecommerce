import { describe, expect, it } from "bun:test";

import { Effect, Exit, Schema } from "effect";

import {
  CreateCustomerInputSchema,
  CustomerApiProfileSchema,
  CustomerEmailSchema,
  CustomerIdentifierSchema,
  createCustomerId,
  createCustomerIdEffect,
} from "../domain";

describe("customer Effect schemas", () => {
  it("decodes customer identifiers, inputs, and API profiles", () => {
    expect(
      Schema.decodeUnknownSync(CustomerIdentifierSchema)({ id: "cust_1" })
    ).toEqual({ id: createCustomerId("cust_1") });
    expect(
      Schema.decodeUnknownSync(CreateCustomerInputSchema)({
        email: "ada@example.com",
      })
    ).toEqual({ email: "ada@example.com" });
    expect(
      Schema.decodeUnknownSync(CustomerApiProfileSchema)({
        addresses: [],
        authUserId: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        email: "ada@example.com",
        groupIds: [],
        id: "cust_1",
        metadata: {},
        updatedAt: "2026-01-01T00:00:00.000Z",
      })
    ).toMatchObject({ id: "cust_1" });
  });

  it("rejects invalid identifiers and email addresses at boundaries", async () => {
    expect(() =>
      Schema.decodeUnknownSync(CustomerEmailSchema)("not-an-email")
    ).toThrow();

    const exit = await Effect.runPromiseExit(createCustomerIdEffect("invalid"));

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(String(exit.cause)).toContain("CustomerInvalidIdentifier");
    }
  });
});

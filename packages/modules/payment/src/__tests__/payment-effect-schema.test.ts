import { describe, expect, it } from "bun:test";

import { Schema } from "effect";

import {
  PaymentCollectionApiSchema,
  PaymentCollectionIdSchema,
} from "../domain";

describe("payment Effect schemas", () => {
  it("validates payment identifiers and API ISO datetimes", () => {
    expect(
      String(Schema.decodeUnknownSync(PaymentCollectionIdSchema)("paycol_1"))
    ).toBe("paycol_1");
    expect(() =>
      Schema.decodeUnknownSync(PaymentCollectionIdSchema)("bad_1")
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(PaymentCollectionApiSchema)({
        amount: 1200,
        createdAt: "not-a-date",
        currencyCode: "USD",
        id: "paycol_1",
        metadata: {},
        status: "pending",
        updatedAt: "2026-01-01T00:00:00.000Z",
      })
    ).toThrow();
  });
});

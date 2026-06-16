import { describe, expect, it } from "bun:test";

import {
  commerceMigrations,
  type CommerceDatabaseSchemaKey,
  orderSchema,
} from ".";

describe("order schema assembly", () => {
  it("contributes order-owned tables to the shared database assembly", () => {
    const orderTable: CommerceDatabaseSchemaKey = "order_record";

    expect(orderSchema.orderSchema.order).toBe(orderTable);
    expect(commerceMigrations).toHaveProperty("013_order");
  });
});

import { describe, expect, it } from "bun:test";

import {
  cartSchema,
  commerceMigrations,
  type CommerceDatabaseSchemaKey,
} from "./index";

describe("cart database assembly", () => {
  it("contributes cart tables to the shared commerce database schema", () => {
    const tableName: CommerceDatabaseSchemaKey = "cart_line_item";

    expect(tableName).toBe("cart_line_item");
    expect(cartSchema.cartSchema.lineItem).toBe("cart_line_item");
    expect(Object.keys(commerceMigrations)).toContain("012_cart");
  });
});

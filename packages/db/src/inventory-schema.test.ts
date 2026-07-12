import { describe, expect, it } from "bun:test";

import { inventorySchema, type CommerceDatabaseSchemaKey } from "./index";
import { commerceMigrations } from "./legacy";

describe("inventory database assembly", () => {
  it("contributes inventory tables to the shared commerce database schema", () => {
    const tableName: CommerceDatabaseSchemaKey = "inventory_reservation";

    expect(tableName).toBe("inventory_reservation");
    expect(inventorySchema.inventorySchema.reservation).toBe(
      "inventory_reservation"
    );
    expect(Object.keys(commerceMigrations)).toContain("007_inventory");
  });
});

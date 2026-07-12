import { describe, expect, it } from "bun:test";

import { fulfillmentSchema, type CommerceDatabaseSchemaKey } from "./index";
import { commerceMigrations } from "./legacy";

describe("fulfillment schema assembly", () => {
  it("contributes fulfillment-owned tables and migration to the shared schema", () => {
    const fulfillmentTables = [
      "fulfillment_provider",
      "fulfillment_set",
      "shipping_profile",
      "service_zone",
      "shipping_option",
      "fulfillment",
      "shipment",
      "return_shipment_link",
    ] satisfies CommerceDatabaseSchemaKey[];

    expect(fulfillmentSchema.fulfillmentSchema.shippingOption).toBe(
      "shipping_option"
    );
    expect(fulfillmentTables).toContain("shipment");
    expect(commerceMigrations["010_fulfillment"]).toBeDefined();
  });
});

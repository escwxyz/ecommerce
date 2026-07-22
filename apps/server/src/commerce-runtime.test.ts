import { describe, expect, it } from "bun:test";

import { createFulfillmentProviderRegistry } from "@ecommerce/fulfillment";

import {
  createDevelopmentCommerceProviderRegistries,
  createServerCommerceRuntime,
} from "./commerce-runtime";

const unusedDatabase = {};

describe("server commerce runtime", () => {
  it("registers persistent module routes but omits checkout without providers", () => {
    const runtime = createServerCommerceRuntime({ db: unusedDatabase });
    const routeKeys = Object.keys(runtime.apiAssembly.router);

    expect(runtime.checkoutConfigured).toBe(false);
    expect(routeKeys).not.toContain("customerGet");
    expect(routeKeys).not.toContain("taxCalculate");
    expect(routeKeys).not.toContain("paymentCollectionCreate");
    expect(routeKeys).not.toContain("fulfillmentCreate");
    expect(routeKeys).toContain("orderCreateFromCheckout");
    expect(routeKeys).not.toContain("checkoutComplete");
  });

  it("configures checkout service without restoring the legacy oRPC route", () => {
    const runtime = createServerCommerceRuntime({
      ...createDevelopmentCommerceProviderRegistries(),
      db: unusedDatabase,
    });

    expect(runtime.checkoutConfigured).toBe(true);
    expect(Object.keys(runtime.apiAssembly.router)).not.toContain(
      "checkoutComplete"
    );
  });

  it("rejects incomplete checkout provider composition", () => {
    expect(() =>
      createServerCommerceRuntime({
        db: unusedDatabase,
        fulfillmentProviderRegistry: createFulfillmentProviderRegistry([]),
      })
    ).toThrow(
      "Checkout composition requires both payment and fulfillment provider registries."
    );
  });
});

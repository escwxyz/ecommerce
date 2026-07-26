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
    expect(routeKeys).not.toContain("orderCreateFromCheckout");
    expect(routeKeys).not.toContain("checkoutComplete");
  });

  it("composes the checkout service without restoring legacy oRPC routes", () => {
    const runtime = createServerCommerceRuntime({
      ...createDevelopmentCommerceProviderRegistries(),
      db: unusedDatabase,
    });

    expect(runtime.checkoutConfigured).toBe(true);
    expect(runtime.services.checkout).toBeDefined();
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

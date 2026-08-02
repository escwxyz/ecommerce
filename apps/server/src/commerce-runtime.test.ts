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

    expect(runtime.checkoutConfigured).toBe(false);
    expect(runtime.services.customer).toBeDefined();
    expect(runtime.services.tax).toBeDefined();
    expect(runtime.services.payment).toBeDefined();
    expect(runtime.services.fulfillment).toBeDefined();
    expect(runtime.services.order).toBeDefined();
    expect(runtime.services.checkout).toBeUndefined();
  });

  it("composes the checkout service without restoring legacy route assembly", () => {
    const runtime = createServerCommerceRuntime({
      ...createDevelopmentCommerceProviderRegistries(),
      db: unusedDatabase,
    });

    expect(runtime.checkoutConfigured).toBe(true);
    expect(runtime.services.checkout).toBeDefined();
    expect("apiAssembly" in runtime).toBe(false);
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

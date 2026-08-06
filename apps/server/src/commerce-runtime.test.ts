import { describe, expect, it } from "bun:test";

import { createFulfillmentProviderRegistry } from "@ecommerce/fulfillment";
import { Effect } from "effect";

import {
  createDevelopmentCommerceProviderRegistries,
  createDevelopmentCommerceRuntime,
} from "./commerce-runtime";

const unusedDatabase = {};

describe("server commerce runtime", () => {
  it("registers persistent module routes but omits checkout without providers", () => {
    const runtime = createDevelopmentCommerceRuntime({ db: unusedDatabase });

    expect(runtime.checkoutConfigured).toBe(false);
    expect(runtime.services.customer).toBeDefined();
    expect(runtime.services.tax).toBeDefined();
    expect(runtime.services.payment).toBeDefined();
    expect(runtime.services.fulfillment).toBeDefined();
    expect(runtime.services.order).toBeDefined();
    expect(runtime.services.checkout).toBeUndefined();
  });

  it("composes the checkout service without restoring legacy route assembly", () => {
    const runtime = createDevelopmentCommerceRuntime({
      ...createDevelopmentCommerceProviderRegistries(),
      db: unusedDatabase,
    });

    expect(runtime.checkoutConfigured).toBe(true);
    expect(runtime.services.checkout).toBeDefined();
    expect("apiAssembly" in runtime).toBe(false);
  });

  it("rejects incomplete checkout provider composition", () => {
    expect(() =>
      createDevelopmentCommerceRuntime({
        db: unusedDatabase,
        fulfillmentProviderRegistry: createFulfillmentProviderRegistry([]),
      })
    ).toThrow(
      "Checkout composition requires both payment and fulfillment provider registries."
    );
  });

  it("creates fresh in-memory adapter state for each development runtime", async () => {
    const first = createDevelopmentCommerceRuntime({ db: unusedDatabase });
    const second = createDevelopmentCommerceRuntime({ db: unusedDatabase });
    const cart = await Effect.runPromise(
      first.services.cart.createCart({ currencyCode: "USD" })
    );

    expect(
      await Effect.runPromise(first.services.cart.getCart(cart.id))
    ).not.toBeNull();
    expect(
      await Effect.runPromise(second.services.cart.getCart(cart.id))
    ).toBeNull();
  });
});

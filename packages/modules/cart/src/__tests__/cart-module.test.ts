import { describe, expect, it } from "bun:test";

import { cartModule } from "../module";

describe("cart module declaration", () => {
  it("declares Effect service, events, permissions, workflow steps, and extension points", () => {
    expect(cartModule.key).toBe("cart");
    expect(cartModule.dependencies).toEqual([
      "customer",
      "fulfillment",
      "inventory",
      "payment",
      "pricing",
      "product",
      "promotion",
      "region-sales-channel",
      "store",
      "tax",
    ]);
    expect(cartModule.providedServices?.map(({ key }) => key)).toEqual([
      "cart-service",
    ]);
    expect(cartModule.schema?.tables).toEqual([
      "cart",
      "cart_line_item",
      "cart_adjustment",
    ]);
    expect(cartModule.contributions?.eventTypes).toContain(
      "cart.line-item-added"
    );
    expect(
      cartModule.contributions?.workflowSteps?.map((step) => step.name)
    ).toEqual(["cart.prepare-checkout"]);
  });
});

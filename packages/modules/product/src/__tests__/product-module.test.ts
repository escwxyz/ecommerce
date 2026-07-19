import { describe, expect, it } from "bun:test";

import { productModule } from "../module";

describe("product module metadata", () => {
  it("exposes product contributions without legacy route fragments", () => {
    expect(productModule.key).toBe("product");
    expect(productModule.contributions?.apiFragments).toEqual([]);
    expect(productModule.contributions?.adminSurfaces?.[0]?.label).toBe(
      "Products"
    );
    expect(productModule.contributions?.eventTypes).toContain(
      "product.catalog.updated"
    );
  });
});

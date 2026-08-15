import { describe, expect, it } from "bun:test";

import { productModule } from "../module";

describe("product module metadata", () => {
  it("exposes product metadata and its executable service", () => {
    expect(productModule.key).toBe("product");
    expect(
      productModule.contributions?.services?.map(({ key }) => key)
    ).toEqual(["product:service"]);
    expect(productModule.contributions?.adminSurfaces?.[0]?.label).toBe(
      "Products"
    );
    expect(productModule.contributions?.eventTypes).toContain(
      "product.catalog.updated"
    );
  });
});

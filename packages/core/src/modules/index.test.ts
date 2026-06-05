import { describe, expect, it } from "bun:test";

import {
  CyclicModuleDependencyError,
  DuplicateModuleError,
  MissingModuleDependencyError,
} from "../errors/index";
import { ClockService } from "../services/index";
import {
  composeCommerceModules,
  defineCommerceModule,
  validateCommerceModules,
} from "./index";

describe("commerce module composition", () => {
  it("orders modules after their dependencies", () => {
    const catalogModule = defineCommerceModule({
      key: "catalog",
      providedServices: [{ key: "clock", service: ClockService }],
    });
    const pricingModule = defineCommerceModule({
      key: "pricing",
      dependencies: ["catalog"] as const,
    });
    const cartModule = defineCommerceModule({
      key: "cart",
      dependencies: ["catalog", "pricing"] as const,
    });

    const graph = composeCommerceModules([
      cartModule,
      pricingModule,
      catalogModule,
    ] as const);

    expect(graph.orderedKeys).toEqual(["catalog", "pricing", "cart"]);
  });

  it("supports typed product-style contributions", () => {
    const productModule = defineCommerceModule({
      key: "product",
      contributions: {
        apiFragments: [
          {
            key: "module:product",
            router: {
              productList: {},
            },
          },
        ],
        adminSurfaces: [
          {
            key: "product:navigation",
            kind: "navigation",
            label: "Products",
            path: "/dashboard",
          },
        ],
      },
    });

    const graph = composeCommerceModules([productModule] as const);

    expect(graph.orderedKeys).toEqual(["product"]);
    expect(productModule.contributions?.apiFragments?.[0]?.key).toBe(
      "module:product"
    );
    expect(productModule.contributions?.adminSurfaces?.[0]?.label).toBe(
      "Products"
    );
  });

  it("rejects duplicate module keys", () => {
    expect(() =>
      validateCommerceModules([
        defineCommerceModule({ key: "catalog" }),
        defineCommerceModule({ key: "catalog" }),
      ] as const)
    ).toThrow(DuplicateModuleError);
  });

  it("rejects missing dependencies", () => {
    expect(() =>
      validateCommerceModules([
        defineCommerceModule({
          key: "cart",
          dependencies: ["catalog"] as const,
        }),
      ] as const)
    ).toThrow(MissingModuleDependencyError);
  });

  it("rejects cyclic dependencies", () => {
    expect(() =>
      validateCommerceModules([
        defineCommerceModule({
          key: "catalog",
          dependencies: ["pricing"] as const,
        }),
        defineCommerceModule({
          key: "pricing",
          dependencies: ["catalog"] as const,
        }),
      ] as const)
    ).toThrow(CyclicModuleDependencyError);
  });
});

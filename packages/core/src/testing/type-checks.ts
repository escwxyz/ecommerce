import { Layer } from "effect";

import { defineCommerceModule } from "../modules/index";
import type { ValidateModuleDependencies } from "../modules/index";
import {
  ClockService,
  IdGeneratorService,
  clockLayer,
  idGeneratorLayer,
} from "../services/index";
import { createSequenceIdGenerator, createStaticClock } from "./index";

const baseModule = defineCommerceModule({
  key: "base",
  providedServices: [{ key: "clock", service: ClockService }],
});

const dependentModule = defineCommerceModule({
  key: "dependent",
  dependencies: ["base"] as const,
  providedServices: [{ key: "id-generator", service: IdGeneratorService }],
});

const productModule = defineCommerceModule({
  key: "product",
  dependencies: ["base"] as const,
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

type Expect<Actual extends true> = Actual;

export type ModuleDependenciesSatisfied = Expect<
  ValidateModuleDependencies<[typeof baseModule, typeof dependentModule]>
>;

export type ProductModuleDependenciesSatisfied = Expect<
  ValidateModuleDependencies<[typeof baseModule, typeof productModule]>
>;

export const testLayerComposition = Layer.mergeAll(
  clockLayer(createStaticClock(new Date("2026-01-01T00:00:00.000Z"))),
  idGeneratorLayer(createSequenceIdGenerator(["typecheck_1"]))
);

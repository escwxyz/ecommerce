import { Context, Effect, Layer } from "effect";

import {
  composeCommerceApplication,
  defineCommerceModule,
  defineCommerceModuleServiceContribution,
} from "../modules/index";
import type {
  CommerceModuleLifecycleError,
  ValidateModuleDependencies,
} from "../modules/index";
import {
  ClockService,
  IdGeneratorService,
  clockLayer,
  idGeneratorLayer,
} from "../services/index";
import { createSequenceIdGenerator, createStaticClock } from "./index";

const baseModule = defineCommerceModule({
  contributions: {
    services: [
      defineCommerceModuleServiceContribution({
        key: "base:clock",
        layer: clockLayer(
          createStaticClock(new Date("2026-01-01T00:00:00.000Z"))
        ),
        service: ClockService,
      }),
    ],
  },
  key: "base",
});

const dependentModule = defineCommerceModule({
  key: "dependent",
  dependencies: ["base"] as const,
  contributions: {
    services: [
      defineCommerceModuleServiceContribution({
        key: "dependent:id-generator",
        layer: idGeneratorLayer(createSequenceIdGenerator(["typecheck_1"])),
        service: IdGeneratorService,
      }),
    ],
  },
});

const productModule = defineCommerceModule({
  key: "product",
  dependencies: ["base"] as const,
  contributions: {
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

const TypecheckHost = Context.Service<{ readonly host: true }>(
  "typechecks/Host"
);
const TypecheckOutput = Context.Service<{ readonly output: true }>(
  "typechecks/Output"
);
class TypecheckLayerFailureError extends Error {
  override readonly name = "TypecheckLayerFailureError";
}

const heterogeneousModule = defineCommerceModule({
  contributions: {
    services: [
      defineCommerceModuleServiceContribution({
        key: "heterogeneous:output",
        layer: Layer.effect(
          TypecheckOutput,
          TypecheckHost.use(() =>
            Effect.fail(new TypecheckLayerFailureError("type-level only"))
          )
        ),
        service: TypecheckOutput,
      }),
    ],
  },
  key: "heterogeneous",
});

const heterogeneousComposition = composeCommerceApplication({
  modules: [heterogeneousModule] as const,
});

// @ts-expect-error executable service registrations require both a Layer and tag
defineCommerceModule({
  contributions: {
    services: [{ _tag: "Service", key: "invalid:service" }],
  },
  key: "invalid",
});

type Expect<Actual extends true> = Actual;
type IsAny<Value> = 0 extends 1 & Value ? true : false;
type Equal<Actual, Expected> = [Actual] extends [Expected]
  ? [Expected] extends [Actual]
    ? true
    : false
  : false;

type HeterogeneousApplicationLayer =
  typeof heterogeneousComposition.applicationLayer;

export type ModuleLayerOutputPreserved = Expect<
  Equal<
    Layer.Success<HeterogeneousApplicationLayer>,
    Context.Service.Identifier<typeof TypecheckOutput>
  >
>;

export type ModuleLayerFailurePreserved = Expect<
  Equal<
    Layer.Error<HeterogeneousApplicationLayer>,
    CommerceModuleLifecycleError | TypecheckLayerFailureError
  >
>;

export type ModuleLayerRequirementPreserved = Expect<
  Equal<
    Layer.Services<HeterogeneousApplicationLayer>,
    Context.Service.Identifier<typeof TypecheckHost>
  >
>;

export type ModuleLayerInferenceDoesNotUseAny = Expect<
  IsAny<
    | Layer.Success<HeterogeneousApplicationLayer>
    | Layer.Error<HeterogeneousApplicationLayer>
    | Layer.Services<HeterogeneousApplicationLayer>
  > extends false
    ? true
    : false
>;

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

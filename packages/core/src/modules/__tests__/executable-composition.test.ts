import { describe, expect, it } from "bun:test";

import { Cause, Context, Effect, Exit, Layer } from "effect";

import { createTestTelemetry } from "../../testing/index";
import {
  CommerceModuleCompositionError,
  CommerceModuleLifecycleError,
  composeCommerceApplication,
  defineCommerceModule,
  defineCommerceModuleServiceContribution,
} from "../index";
import type { CommerceModuleDefinition } from "../index";

const CatalogService = Context.Service<{ readonly value: string }>(
  "test/CatalogService"
);

describe("executable commerce module composition", () => {
  it("builds the declared service from the canonical module definition", async () => {
    const catalogModule = defineCommerceModule({
      contributions: {
        services: [
          defineCommerceModuleServiceContribution({
            key: "catalog:service",
            layer: Layer.succeed(CatalogService, { value: "catalog" }),
            service: CatalogService,
          }),
        ],
      },
      key: "catalog",
    });

    const composition = composeCommerceApplication({
      modules: [catalogModule] as const,
    });
    const value = await Effect.runPromise(
      CatalogService.use((service) => Effect.succeed(service.value)).pipe(
        Effect.provide(composition.applicationLayer)
      )
    );

    expect(value).toBe("catalog");
    expect(composition.orderedKeys).toEqual(["catalog"]);
    expect(composition.services.map((service) => service.key)).toEqual([
      "catalog:service",
    ]);
  });

  it("orders dependency peers by stable module key regardless of input order", () => {
    const alpha = defineCommerceModule({ key: "alpha" });
    const beta = defineCommerceModule({ key: "beta" });
    const checkout = defineCommerceModule({
      dependencies: ["alpha", "beta"] as const,
      key: "checkout",
    });

    const forward = composeCommerceApplication({
      modules: [checkout, beta, alpha] as const,
    });
    const reverse = composeCommerceApplication({
      modules: [alpha, checkout, beta] as const,
    });

    expect(forward.orderedKeys).toEqual(["alpha", "beta", "checkout"]);
    expect(reverse.orderedKeys).toEqual(forward.orderedKeys);
  });

  it("rejects duplicate executable contribution keys before Layer acquisition", () => {
    let acquired = 0;
    const duplicate = () =>
      defineCommerceModuleServiceContribution({
        key: "catalog:service",
        layer: Layer.effect(
          CatalogService,
          Effect.sync(() => {
            acquired += 1;
            return { value: "catalog" };
          })
        ),
        service: CatalogService,
      });

    expect(() =>
      composeCommerceApplication({
        modules: [
          defineCommerceModule({
            contributions: { services: [duplicate(), duplicate()] },
            key: "catalog",
          }),
        ] as const,
      })
    ).toThrow(CommerceModuleCompositionError);
    expect(acquired).toBe(0);
  });

  it("rejects duplicate keys across every contribution registry with ownership", () => {
    const executable = {
      handler: () => Effect.void,
      layer: Layer.empty,
      provider: CatalogService,
      service: CatalogService,
    };
    const apiGroup = ({
      groupIdentifier,
      key,
      path,
    }: {
      readonly groupIdentifier: string;
      readonly key: string;
      readonly path?: string;
    }) => ({
      _tag: "ApiGroup",
      group: {
        endpoints: path ? { collision: { method: "GET", path } } : {},
        identifier: groupIdentifier,
      },
      handlers: Layer.empty,
      key,
      owner: "module",
      surface: "admin",
    });
    const module = (
      key: string,
      contributions: Record<string, unknown>,
      schema?: Record<string, unknown>
    ) =>
      ({ contributions, key, schema }) as unknown as CommerceModuleDefinition;
    const cases: readonly {
      readonly contributionKind: string;
      readonly modules: readonly CommerceModuleDefinition[];
      readonly owners: readonly [string, string];
    }[] = [
      {
        contributionKind: "service",
        modules: [
          module("alpha", {
            services: [
              { ...executable, _tag: "Service", key: "alpha:shared" },
              { ...executable, _tag: "Service", key: "alpha:shared" },
            ],
          }),
        ],
        owners: ["alpha", "alpha"],
      },
      ...(["provider", "event-handler"] as const).map((kind) => ({
        contributionKind: kind,
        modules: [
          module("alpha", {
            [kind === "provider" ? "providers" : "eventHandlers"]: [
              {
                ...executable,
                _tag: kind === "provider" ? "Provider" : "EventHandler",
                key: "shared",
              },
            ],
          }),
          module("beta", {
            [kind === "provider" ? "providers" : "eventHandlers"]: [
              {
                ...executable,
                _tag: kind === "provider" ? "Provider" : "EventHandler",
                key: "shared",
              },
            ],
          }),
        ],
        owners: ["alpha", "beta"] as const,
      })),
      {
        contributionKind: "api-group",
        modules: [
          module("alpha", {
            apiGroups: [apiGroup({ groupIdentifier: "alpha", key: "shared" })],
          }),
          module("beta", {
            apiGroups: [apiGroup({ groupIdentifier: "beta", key: "shared" })],
          }),
        ],
        owners: ["alpha", "beta"],
      },
      {
        contributionKind: "HTTP group",
        modules: [
          module("alpha", {
            apiGroups: [apiGroup({ groupIdentifier: "shared", key: "alpha" })],
          }),
          module("beta", {
            apiGroups: [apiGroup({ groupIdentifier: "shared", key: "beta" })],
          }),
        ],
        owners: ["alpha", "beta"],
      },
      {
        contributionKind: "HTTP route",
        modules: [
          module("alpha", {
            apiGroups: [
              apiGroup({
                groupIdentifier: "alpha",
                key: "alpha",
                path: "/shared",
              }),
            ],
          }),
          module("beta", {
            apiGroups: [
              apiGroup({
                groupIdentifier: "beta",
                key: "beta",
                path: "/shared",
              }),
            ],
          }),
        ],
        owners: ["alpha", "beta"],
      },
      ...(
        [
          ["workflow", "workflows", { key: "shared", steps: [], version: "1" }],
          ["event type", "eventTypes", "shared"],
          [
            "permission",
            "permissions",
            { action: "read", key: "shared:read", resource: "shared" },
          ],
        ] as const
      ).map(([contributionKind, collection, value]) => ({
        contributionKind,
        modules: [
          module("alpha", { [collection]: [value] }),
          module("beta", { [collection]: [value] }),
        ],
        owners: ["alpha", "beta"] as const,
      })),
      {
        contributionKind: "admin surface",
        modules: [
          module("alpha", {
            adminSurfaces: [
              { key: "shared", kind: "navigation", label: "One" },
              { key: "shared", kind: "navigation", label: "Two" },
            ],
          }),
        ],
        owners: ["alpha", "alpha"],
      },
      {
        contributionKind: "storage namespace",
        modules: [
          module("alpha", {}, { storageNamespaces: ["shared"] }),
          module("beta", {}, { storageNamespaces: ["shared"] }),
        ],
        owners: ["alpha", "beta"],
      },
    ];

    for (const testCase of cases) {
      try {
        composeCommerceApplication({ modules: testCase.modules });
        throw new Error(`Expected ${testCase.contributionKind} collision`);
      } catch (error) {
        expect(error).toBeInstanceOf(CommerceModuleCompositionError);
        if (error instanceof CommerceModuleCompositionError) {
          expect(error.detail).toMatchObject({
            _tag: "DuplicateContribution",
            contributionKind: testCase.contributionKind,
            existingOwner: testCase.owners[0],
            owner: testCase.owners[1],
          });
        }
      }
    }
  });

  it("scopes admin surface keys by module owner", () => {
    const module = (key: string, label: string) =>
      defineCommerceModule({
        contributions: {
          adminSurfaces: [{ key: "navigation", kind: "navigation", label }],
        },
        key,
      });

    expect(() =>
      composeCommerceApplication({
        modules: [module("alpha", "Alpha"), module("beta", "Beta")] as const,
      })
    ).not.toThrow();
  });

  it("rejects an API group without an executable handler Layer", () => {
    const invalidModule = {
      contributions: {
        apiGroups: [
          {
            _tag: "ApiGroup",
            group: { identifier: "catalog", endpoints: {} },
            key: "catalog:api",
            owner: "module",
            surface: "admin",
          },
        ],
      },
      key: "catalog",
    } as unknown as CommerceModuleDefinition;

    expect(() =>
      composeCommerceApplication({
        modules: [invalidModule] as const,
      })
    ).toThrow(CommerceModuleCompositionError);
  });

  it("continues validating API groups whose group has no endpoint collection", () => {
    const apiGroup = (groupIdentifier: string) => ({
      _tag: "ApiGroup",
      group: { identifier: groupIdentifier },
      handlers: Layer.empty,
      key: "catalog:shared",
      owner: "module",
      surface: "admin",
    });
    const invalidModule = {
      contributions: {
        apiGroups: [apiGroup("catalog-one"), apiGroup("catalog-two")],
      },
      key: "catalog",
    } as unknown as CommerceModuleDefinition;

    expect(() =>
      composeCommerceApplication({ modules: [invalidModule] as const })
    ).toThrow(CommerceModuleCompositionError);
  });

  it("rejects providers and event handlers without executable fields", () => {
    const invalidContributions = [
      {
        eventHandlers: [{ _tag: "EventHandler", key: "catalog:event-handler" }],
      },
      {
        providers: [{ _tag: "Provider", key: "catalog:provider" }],
      },
    ];

    for (const contributions of invalidContributions) {
      const invalidModule = {
        contributions,
        key: "catalog",
      } as unknown as CommerceModuleDefinition;
      expect(() =>
        composeCommerceApplication({ modules: [invalidModule] as const })
      ).toThrow(CommerceModuleCompositionError);
    }
  });

  it("runs lifecycle hooks in dependency order and rolls back a failed bootstrap", async () => {
    const calls: string[] = [];
    const base = defineCommerceModule({
      key: "base",
      lifecycle: {
        onBootstrap: Effect.sync(() => calls.push("base:bootstrap")),
        onRegister: Effect.sync(() => calls.push("base:register")),
        onShutdown: Effect.sync(() => calls.push("base:shutdown")),
      },
    });
    const dependant = defineCommerceModule({
      dependencies: ["base"] as const,
      key: "dependant",
      lifecycle: {
        onBootstrap: Effect.fail("unavailable"),
        onRegister: Effect.sync(() => calls.push("dependant:register")),
        onShutdown: Effect.sync(() => calls.push("dependant:shutdown")),
      },
    });
    const composition = composeCommerceApplication({
      modules: [dependant, base] as const,
    });

    await expect(
      Effect.runPromise(composition.lifecycle.start)
    ).rejects.toBeInstanceOf(CommerceModuleLifecycleError);
    expect(calls).toEqual([
      "base:register",
      "base:bootstrap",
      "dependant:register",
      "dependant:shutdown",
      "base:shutdown",
    ]);
  });

  it("records secret-safe lifecycle outcomes for startup and rollback", async () => {
    const telemetry = createTestTelemetry();
    const composition = composeCommerceApplication({
      modules: [
        defineCommerceModule({
          key: "catalog",
          lifecycle: {
            onBootstrap: Effect.fail("unavailable"),
            onShutdown: Effect.void,
          },
        }),
      ] as const,
    });

    await Effect.runPromise(
      Effect.exit(composition.lifecycle.start).pipe(
        Effect.provide(telemetry.layer)
      )
    );

    expect(telemetry.logs).toContainEqual({
      annotations: {
        moduleKey: "catalog",
        operation: "module.lifecycle",
        phase: "bootstrap",
        requestId: "module-lifecycle:catalog:bootstrap",
      },
      message: ["commerce.operation.failed", { outcome: "typed_rejection" }],
    });
    expect(telemetry.logs).toContainEqual({
      annotations: {
        moduleKey: "catalog",
        operation: "module.lifecycle",
        phase: "shutdown",
        requestId: "module-lifecycle:catalog:shutdown",
      },
      message: ["commerce.operation.succeeded"],
    });
    expect(JSON.stringify(telemetry.logs)).not.toContain("unavailable");
  });

  it("keeps lifecycle state isolated across concurrent Layer acquisitions", async () => {
    let bootstraps = 0;
    let shutdowns = 0;
    const composition = composeCommerceApplication({
      modules: [
        defineCommerceModule({
          key: "catalog",
          lifecycle: {
            onBootstrap: Effect.sync(() => {
              bootstraps += 1;
            }),
            onShutdown: Effect.sync(() => {
              shutdowns += 1;
            }),
          },
        }),
      ] as const,
    });

    await Effect.runPromise(
      Effect.all(
        [10, 30].map((duration) =>
          Effect.sleep(`${duration} millis`).pipe(
            Effect.provide(composition.applicationLayer)
          )
        ),
        { concurrency: "unbounded" }
      )
    );

    expect(bootstraps).toBe(2);
    expect(shutdowns).toBe(2);
  });

  it("preserves lifecycle defects as Effect Causes", async () => {
    const defect = new Error("bootstrap defect");
    const composition = composeCommerceApplication({
      modules: [
        defineCommerceModule({
          key: "catalog",
          lifecycle: { onBootstrap: Effect.die(defect) },
        }),
      ] as const,
    });

    const exit = await Effect.runPromise(
      Effect.exit(composition.lifecycle.start)
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const foundDefect = Cause.findDefect(exit.cause);
      expect("success" in foundDefect ? foundDefect.success : undefined).toBe(
        defect
      );
    }
  });

  it("preserves interruption from lifecycle execution", async () => {
    const composition = composeCommerceApplication({
      modules: [
        defineCommerceModule({
          key: "catalog",
          lifecycle: { onBootstrap: Effect.interrupt },
        }),
      ] as const,
    });

    const exit = await Effect.runPromise(
      Effect.exit(composition.lifecycle.start)
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(Cause.hasInterrupts(exit.cause)).toBe(true);
    }
  });

  it("combines the startup failure with cleanup defects", async () => {
    const cleanupDefect = new Error("cleanup defect");
    const composition = composeCommerceApplication({
      modules: [
        defineCommerceModule({
          key: "catalog",
          lifecycle: {
            onBootstrap: Effect.fail("unavailable"),
            onShutdown: Effect.die(cleanupDefect),
          },
        }),
      ] as const,
    });

    const exit = await Effect.runPromise(
      Effect.exit(composition.lifecycle.start)
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(Cause.hasFails(exit.cause)).toBe(true);
      const foundDefect = Cause.findDefect(exit.cause);
      expect("success" in foundDefect ? foundDefect.success : undefined).toBe(
        cleanupDefect
      );
    }
  });

  it("scopes lifecycle start and shutdown to the application Layer", async () => {
    const calls: string[] = [];
    const composition = composeCommerceApplication({
      modules: [
        defineCommerceModule({
          key: "catalog",
          lifecycle: {
            onBootstrap: Effect.sync(() => calls.push("bootstrap")),
            onShutdown: Effect.sync(() => calls.push("shutdown")),
          },
        }),
      ] as const,
    });

    await Effect.runPromise(
      Effect.void.pipe(Effect.provide(composition.applicationLayer))
    );

    expect(calls).toEqual(["bootstrap", "shutdown"]);
  });
});

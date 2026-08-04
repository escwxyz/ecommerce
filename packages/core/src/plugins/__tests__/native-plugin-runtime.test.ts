import { describe, expect, it } from "bun:test";

import { Context, Effect, Exit, Layer } from "effect";

import { createTestTelemetry } from "../../testing/index";
import {
  composeNativePlugins,
  defineNativePlugin,
  defineNativePluginServiceContribution,
  transitionNativePlugin,
  transitionNativePlugins,
} from "../index";

class TestPluginService extends Context.Service<
  TestPluginService,
  { readonly value: string }
>()("@ecommerce/core/test/TestPluginService") {}

const testPluginServiceLayer = Layer.succeed(
  TestPluginService,
  TestPluginService.of({ value: "test" })
);

describe("native plugin runtime", () => {
  it("rejects active plugins whose required capabilities are unavailable", () => {
    const plugin = defineNativePlugin({
      manifest: {
        capabilities: [
          {
            key: "commerce:events",
            required: true,
          },
          {
            key: "telemetry:write",
            required: false,
          },
        ],
        id: "analytics",
        version: "1.0.0",
      },
    });

    expect(() =>
      composeNativePlugins([plugin], {
        availableCapabilities: ["telemetry:write"],
      })
    ).toThrow(
      'Native plugin "analytics" requires unavailable capability "commerce:events".'
    );
  });

  it("rejects duplicate executable contribution keys before composition", () => {
    const createPlugin = (id: string) =>
      defineNativePlugin({
        contributions: {
          services: [
            defineNativePluginServiceContribution({
              key: "analytics:service",
              layer: testPluginServiceLayer,
              service: TestPluginService,
            }),
          ],
        },
        manifest: {
          capabilities: [],
          id,
          version: "1.0.0",
        },
      });

    expect(() =>
      composeNativePlugins([createPlugin("first"), createPlugin("second")])
    ).toThrow(
      'Duplicate native plugin service key "analytics:service" from "second" conflicts with "first".'
    );
  });

  it("rejects duplicate storage namespaces before composition", () => {
    const createPlugin = (id: string) =>
      defineNativePlugin({
        contributions: {
          storage: [{ namespace: "analytics-cache" }],
        },
        manifest: {
          capabilities: [],
          id,
          version: "1.0.0",
        },
      });

    expect(() =>
      composeNativePlugins([createPlugin("first"), createPlugin("second")])
    ).toThrow(
      'Duplicate native plugin storage namespace "analytics-cache" from "second" conflicts with "first".'
    );
  });

  it("composes active plugin contributions in stable plugin ID order", () => {
    const createPlugin = (id: string) =>
      defineNativePlugin({
        contributions: {
          adminSurfaces: [
            {
              key: `${id}:navigation`,
              kind: "navigation",
              label: id,
            },
          ],
        },
        manifest: {
          capabilities: [],
          id,
          version: "1.0.0",
        },
      });

    const composition = composeNativePlugins([
      createPlugin("reporting"),
      createPlugin("analytics"),
    ]);

    expect(
      composition.activePlugins.map((plugin) => String(plugin.manifest.id))
    ).toEqual(["analytics", "reporting"]);
    expect(composition.adminSurfaces.map((surface) => surface.key)).toEqual([
      "analytics:navigation",
      "reporting:navigation",
    ]);
  });

  it("runs lifecycle transitions in plugin ID order and returns updated states", async () => {
    const hookOrder: string[] = [];
    const telemetry = createTestTelemetry();
    const createPlugin = (id: string) =>
      defineNativePlugin({
        lifecycle: {
          onActivate: ({ pluginId }) =>
            Effect.sync(() => {
              hookOrder.push(pluginId);
            }),
        },
        manifest: {
          capabilities: [],
          id,
          version: "1.0.0",
        },
        state: "installed",
      });

    const transitioned = await Effect.runPromise(
      transitionNativePlugins(
        [createPlugin("reporting"), createPlugin("analytics")],
        { event: "activate" }
      ).pipe(Effect.provide(telemetry.layer))
    );

    expect(hookOrder).toEqual(["analytics", "reporting"]);
    expect(
      transitioned.map((plugin) => ({
        id: String(plugin.manifest.id),
        state: plugin.state,
      }))
    ).toEqual([
      { id: "analytics", state: "active" },
      { id: "reporting", state: "active" },
    ]);
  });

  it("captures structured lifecycle logs and spans deterministically", async () => {
    const telemetry = createTestTelemetry();
    const plugin = defineNativePlugin({
      lifecycle: {
        onActivate: () => Effect.void,
      },
      manifest: {
        capabilities: [],
        id: "analytics",
        version: "1.0.0",
      },
      state: "installed",
    });

    await Effect.runPromise(
      transitionNativePlugin(plugin, {
        correlation: { requestId: "plugin_lifecycle_1" },
        event: "activate",
      }).pipe(Effect.provide(telemetry.layer))
    );

    expect(telemetry.logs).toContainEqual({
      annotations: {
        event: "activate",
        fromState: "installed",
        operation: "plugin.lifecycle",
        pluginId: "analytics",
        pluginVersion: "1.0.0",
        requestId: "plugin_lifecycle_1",
        toState: "active",
      },
      message: ["commerce.operation.succeeded"],
    });
    const lifecycleSpan = telemetry.spans.find(
      (span) => span.name === "plugin.lifecycle"
    );
    expect(Object.fromEntries(lifecycleSpan?.attributes ?? [])).toEqual({
      event: "activate",
      fromState: "installed",
      operation: "plugin.lifecycle",
      pluginId: "analytics",
      pluginVersion: "1.0.0",
      requestId: "plugin_lifecycle_1",
      toState: "active",
    });
  });

  it("preserves lifecycle defects while recording their telemetry outcome", async () => {
    const telemetry = createTestTelemetry();
    const plugin = defineNativePlugin({
      lifecycle: {
        onActivate: () => Effect.die("activation-defect"),
      },
      manifest: {
        capabilities: [],
        id: "analytics",
        version: "1.0.0",
      },
      state: "installed",
    });

    const exit = await Effect.runPromiseExit(
      transitionNativePlugin(plugin, {
        correlation: { requestId: "plugin_lifecycle_2" },
        event: "activate",
      }).pipe(Effect.provide(telemetry.layer))
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(plugin.state).toBe("installed");
    expect(telemetry.logs).toContainEqual({
      annotations: {
        event: "activate",
        fromState: "installed",
        operation: "plugin.lifecycle",
        pluginId: "analytics",
        pluginVersion: "1.0.0",
        requestId: "plugin_lifecycle_2",
        toState: "active",
      },
      message: ["commerce.operation.failed", { outcome: "defect" }],
    });
  });
});

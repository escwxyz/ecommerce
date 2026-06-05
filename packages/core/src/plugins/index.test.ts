import { describe, expect, it } from "bun:test";

import { Effect } from "effect";

import { MissingModuleDependencyError } from "../errors/index";
import { defineCommerceModule } from "../modules/index";
import {
  assertSandboxBridgeCapability,
  composeNativePlugins,
  createSandboxPluginGrantPolicy,
  defineNativePlugin,
  defineSandboxPlugin,
  getNativePluginLifecycleTransition,
  isSandboxEntrypointResponse,
  runNativePluginLifecycleHook,
} from "./index";

describe("native plugin contracts", () => {
  it("normalizes native plugin manifests while preserving typed contributions", () => {
    const analyticsModule = defineCommerceModule({ key: "analytics" });
    const plugin = defineNativePlugin({
      manifest: {
        capabilities: ["admin:read"],
        id: "analytics",
        version: "1.0.0",
      },
      contributions: {
        adminSurfaces: [
          {
            key: "analytics:navigation",
            kind: "navigation",
            label: "Analytics",
            path: "/dashboard/analytics",
            permission: "analytics:read",
            routeKey: "analyticsSummary",
          },
        ],
        apiFragments: [
          {
            key: "plugin:analytics",
            router: {
              analyticsSummary: {},
            },
          },
        ],
        modules: [analyticsModule],
        providers: [
          {
            contractKey: "provider:search",
            key: "analytics-search",
            kind: "search",
            label: "Analytics Search",
          },
        ],
        storage: [
          {
            namespace: "analytics-cache",
            description: "Cached analytics rollups.",
          },
        ],
      },
    });

    expect(plugin.manifest).toMatchObject({
      capabilities: ["admin:read"],
      id: "analytics",
      tier: "native",
      version: "1.0.0",
    });
    expect(plugin.contributions.modules).toEqual([analyticsModule]);
    expect(plugin.contributions.apiFragments?.[0]?.key).toBe(
      "plugin:analytics"
    );
    expect(plugin.contributions.adminSurfaces?.[0]?.permission).toBe(
      "analytics:read"
    );
    expect(plugin.contributions.providers?.[0]).toMatchObject({
      contractKey: "provider:search",
      kind: "search",
    });
    expect(plugin.contributions.storage?.[0]?.namespace).toBe(
      "analytics-cache"
    );
  });

  it("rejects duplicate plugin IDs during composition", () => {
    const firstPlugin = defineNativePlugin({
      manifest: {
        capabilities: [],
        id: "duplicate",
        version: "1.0.0",
      },
    });
    const secondPlugin = defineNativePlugin({
      manifest: {
        capabilities: [],
        id: "duplicate",
        version: "1.1.0",
      },
    });

    expect(() => composeNativePlugins([firstPlugin, secondPlugin])).toThrow(
      /Duplicate native plugin ID "duplicate"/
    );
  });

  it("excludes inactive plugin contributions from active composition", () => {
    const activePlugin = defineNativePlugin({
      manifest: {
        capabilities: [],
        id: "active-plugin",
        version: "1.0.0",
      },
      contributions: {
        adminSurfaces: [
          {
            key: "active:navigation",
            kind: "navigation",
            label: "Active",
          },
        ],
      },
      state: "active",
    });
    const inactivePlugin = defineNativePlugin({
      manifest: {
        capabilities: [],
        id: "inactive-plugin",
        version: "1.0.0",
      },
      contributions: {
        adminSurfaces: [
          {
            key: "inactive:navigation",
            kind: "navigation",
            label: "Inactive",
          },
        ],
      },
      state: "inactive",
    });

    const composition = composeNativePlugins([activePlugin, inactivePlugin]);

    expect(
      composition.activePlugins.map((plugin) => plugin.manifest.id)
    ).toEqual(["active-plugin"]);
    expect(composition.adminSurfaces.map((surface) => surface.key)).toEqual([
      "active:navigation",
    ]);
  });

  it("rejects duplicate admin surface keys from active plugins", () => {
    const createPlugin = (id: string) =>
      defineNativePlugin({
        manifest: {
          capabilities: [],
          id,
          version: "1.0.0",
        },
        contributions: {
          adminSurfaces: [
            {
              key: "shared:navigation",
              kind: "navigation",
              label: id,
            },
          ],
        },
      });

    expect(() =>
      composeNativePlugins([createPlugin("first"), createPlugin("second")])
    ).toThrow(/Duplicate native plugin admin surface key "shared:navigation"/);
  });

  it("validates native plugin admin permissions during composition", () => {
    const plugin = defineNativePlugin({
      manifest: {
        capabilities: [],
        id: "analytics",
        version: "1.0.0",
      },
      contributions: {
        adminSurfaces: [
          {
            key: "analytics:navigation",
            kind: "navigation",
            label: "Analytics",
            permission: "analytics:read",
          },
        ],
      },
    });

    expect(() =>
      composeNativePlugins([plugin], {
        permissionValidator: (permission) => {
          if (permission.key !== "product:read") {
            throw new Error(`Unsupported permission "${permission.key}".`);
          }
        },
      })
    ).toThrow(/Unsupported permission "analytics:read"/);
  });

  it("composes plugin modules through existing module dependency validation", () => {
    const plugin = defineNativePlugin({
      manifest: {
        capabilities: [],
        id: "cart-plugin",
        version: "1.0.0",
      },
      contributions: {
        modules: [
          defineCommerceModule({
            key: "cart",
            dependencies: ["product"] as const,
          }),
        ],
      },
    });

    expect(() => composeNativePlugins([plugin])).toThrow(
      MissingModuleDependencyError
    );
  });

  it("validates native plugin lifecycle transitions", () => {
    expect(
      getNativePluginLifecycleTransition({
        event: "activate",
        from: "installed",
      })
    ).toEqual({
      hook: "onActivate",
      to: "active",
    });

    expect(() =>
      getNativePluginLifecycleTransition({
        event: "activate",
        from: "registered",
      })
    ).toThrow(/Invalid native plugin lifecycle transition/);
  });

  it("passes upgrade version context to lifecycle hooks", async () => {
    const seenVersions: string[] = [];
    const plugin = defineNativePlugin({
      lifecycle: {
        onUpgrade: ({ fromVersion, toVersion }) =>
          Effect.sync(() => {
            seenVersions.push(`${fromVersion}->${toVersion}`);
          }),
      },
      manifest: {
        capabilities: [],
        id: "upgradeable",
        version: "2.0.0",
      },
      state: "active",
    });

    await Effect.runPromise(
      runNativePluginLifecycleHook(plugin, {
        event: "upgrade",
        fromState: "active",
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
      })
    );

    expect(seenVersions).toEqual(["1.0.0->2.0.0"]);
  });
});

describe("sandbox plugin contracts", () => {
  const createSandboxRegistration = () =>
    defineSandboxPlugin({
      manifest: {
        allowedHosts: ["HTTPS://API.EXAMPLE.COM/v1"],
        bundle: {
          integrity: {
            algorithm: "sha256",
            value: "sha256-test",
          },
          mainModule: "src/index.js",
          r2Key: "plugins/tax/1.0.0/index.js",
          version: "1.0.0+sha256-test",
        },
        capabilities: ["bridge:fetch", "bridge:log", "bridge:storage"],
        contributions: {
          routes: ["tax.quote"],
          hooks: ["cart.updated"],
          adminSurfaces: ["tax.settings"],
        },
        entrypoints: [
          {
            key: "tax.quote",
            kind: "route",
          },
        ],
        id: "tax-sandbox",
        storage: [
          {
            namespace: "settings",
          },
        ],
        version: "1.0.0",
      },
      state: "installed",
    });

  it("normalizes sandbox plugin manifests and host allowlists", () => {
    const plugin = createSandboxRegistration();

    expect(plugin.manifest.tier).toBe("sandbox");
    expect(plugin.state).toBe("installed");
    expect(plugin.manifest.allowedHosts).toEqual(["api.example.com"]);
    expect(plugin.manifest.bundle.integrity).toEqual({
      algorithm: "sha256",
      value: "sha256-test",
    });
  });

  it("rejects invalid sandbox manifests", () => {
    expect(() =>
      defineSandboxPlugin({
        manifest: {
          bundle: {
            integrity: {
              algorithm: "sha256",
              value: "hash",
            },
            mainModule: "src/index.js",
            r2Key: "plugins/bad/index.js",
            version: "1.0.0+hash",
          },
          capabilities: ["bridge:log"],
          entrypoints: [],
          id: "bad",
          version: "1.0.0",
        },
      })
    ).toThrow(/at least one entrypoint/);

    expect(() =>
      defineSandboxPlugin({
        manifest: {
          bundle: {
            integrity: {
              algorithm: "sha256",
              value: "",
            },
            mainModule: "src/index.js",
            r2Key: "plugins/bad/index.js",
            version: "1.0.0+hash",
          },
          capabilities: ["bridge:log"],
          entrypoints: [
            {
              key: "bad.route",
              kind: "route",
            },
          ],
          id: "bad",
          version: "1.0.0",
        },
      })
    ).toThrow(/integrity value/);
  });

  it("separates requested sandbox capabilities from granted policy", () => {
    const plugin = createSandboxRegistration();
    const policy = createSandboxPluginGrantPolicy({
      manifest: plugin.manifest,
      grantedAllowedHosts: [],
      grantedCapabilities: ["bridge:log"],
      grantedStorageNamespaces: ["settings"],
    });

    expect(policy.canActivate).toBe(false);
    expect(policy.grantedCapabilities).toEqual(["bridge:log"]);
    expect(policy.deniedCapabilities).toEqual([
      "bridge:fetch",
      "bridge:storage",
    ]);
    expect(policy.deniedAllowedHosts).toEqual(["api.example.com"]);
  });

  it("validates sandbox bridge capabilities and response shapes", () => {
    const denied = assertSandboxBridgeCapability(
      {
        correlationId: "corr_1",
        grantedAllowedHosts: [],
        grantedCapabilities: ["bridge:log"],
        grantedStorageNamespaces: [],
        lifecycleState: "active",
        pluginId: "tax-sandbox",
        pluginVersion: "1.0.0",
        tenantId: "tenant_1",
      },
      {
        capability: "bridge:storage",
        resource: "settings",
        type: "storageRead",
      }
    );

    expect(denied).toMatchObject({
      decision: "deny",
      operationType: "storageRead",
      pluginId: "tax-sandbox",
      resource: "settings",
    });
    expect(
      isSandboxEntrypointResponse({
        body: { ok: true },
        status: 200,
        type: "routeResponse",
      })
    ).toBe(true);
    expect(
      isSandboxEntrypointResponse({
        status: 99,
        type: "routeResponse",
      })
    ).toBe(false);
  });
});

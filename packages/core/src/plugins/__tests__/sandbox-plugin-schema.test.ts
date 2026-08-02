import { describe, expect, it } from "bun:test";

import { Schema } from "effect";

import {
  SandboxBridgeOperationSchema,
  SandboxEntrypointResponseSchema,
  SandboxPluginManifestSchema,
  defineSandboxPlugin,
} from "../index";

describe("sandbox plugin Effect schemas", () => {
  it("decodes a sandbox manifest with normalized runtime-neutral bridge values", () => {
    const plugin = defineSandboxPlugin({
      manifest: {
        allowedHosts: ["HTTPS://API.EXAMPLE.COM/v1", "api.example.com"],
        bundle: {
          integrity: {
            algorithm: "sha256",
            value: "sha256-test",
          },
          mainModule: "src/index.js",
          modules: {
            "admin/settings": "src/admin/settings.js",
          },
          r2Key: "plugins/tax/1.0.0/index.js",
          version: "1.0.0+sha256-test",
        },
        capabilities: ["bridge:storage", "bridge:log", "bridge:storage"],
        entrypoints: [
          {
            exportName: "route",
            key: "tax.quote",
            kind: "route",
          },
        ],
        id: "tax-sandbox",
        storage: [
          {
            description: "Plugin settings mediated by the host bridge.",
            namespace: "settings",
          },
        ],
        version: "1.0.0",
      },
    });

    const decodedManifest = Schema.decodeUnknownSync(
      SandboxPluginManifestSchema
    )(plugin.manifest);
    const encoded = Schema.encodeSync(SandboxPluginManifestSchema)(
      decodedManifest
    );

    expect(encoded).toEqual({
      allowedHosts: ["api.example.com"],
      bundle: {
        integrity: {
          algorithm: "sha256",
          value: "sha256-test",
        },
        mainModule: "src/index.js",
        modules: {
          "admin/settings": "src/admin/settings.js",
        },
        r2Key: "plugins/tax/1.0.0/index.js",
        version: "1.0.0+sha256-test",
      },
      capabilities: ["bridge:log", "bridge:storage"],
      entrypoints: [
        {
          exportName: "route",
          key: "tax.quote",
          kind: "route",
        },
      ],
      id: "tax-sandbox",
      schemaVersion: 1,
      storage: [
        {
          description: "Plugin settings mediated by the host bridge.",
          namespace: "settings",
        },
      ],
      tier: "sandbox",
      version: "1.0.0",
    });
    expect(
      Schema.decodeUnknownSync(SandboxPluginManifestSchema)(encoded)
    ).toEqual(decodedManifest);
  });

  it("rejects malformed sandbox manifests at the Effect Schema boundary", () => {
    expect(() =>
      Schema.decodeUnknownSync(SandboxPluginManifestSchema)({
        bundle: {
          integrity: {
            algorithm: "sha256",
            value: "hash",
          },
          mainModule: "src/index.js",
          r2Key: "plugins/bad/index.js",
          version: "1.0.0+hash",
        },
        capabilities: ["cloudflare:binding"],
        entrypoints: [
          {
            key: "bad.route",
            kind: "route",
          },
        ],
        id: "bad",
        schemaVersion: 1,
        tier: "sandbox",
        version: "1.0.0",
      })
    ).toThrow();

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
          entrypoints: [
            {
              key: "duplicate",
              kind: "route",
            },
            {
              key: "duplicate",
              kind: "hook",
            },
          ],
          id: "bad",
          version: "1.0.0",
        },
      })
    ).toThrow();
  });

  it("decodes bridge request and response messages through Effect Schema", () => {
    expect(
      Schema.decodeUnknownSync(SandboxBridgeOperationSchema)({
        capability: "bridge:storage",
        resource: "settings",
        type: "storageRead",
      })
    ).toEqual({
      capability: "bridge:storage",
      resource: "settings",
      type: "storageRead",
    });

    expect(
      Schema.decodeUnknownSync(SandboxEntrypointResponseSchema)({
        headers: {
          "content-type": "application/json",
        },
        status: 200,
        type: "routeResponse",
      })
    ).toEqual({
      headers: {
        "content-type": "application/json",
      },
      status: 200,
      type: "routeResponse",
    });

    expect(() =>
      Schema.decodeUnknownSync(SandboxBridgeOperationSchema)({
        capability: "bridge:storage",
        type: "log",
      })
    ).toThrow();

    expect(() =>
      Schema.decodeUnknownSync(SandboxEntrypointResponseSchema)({
        status: 99,
        type: "routeResponse",
      })
    ).toThrow();
  });
});

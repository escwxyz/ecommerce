import { describe, expect, it } from "bun:test";

import { Schema } from "effect";

import { NativePluginManifestSchema, defineNativePlugin } from "../index";

describe("native plugin manifest schema", () => {
  it("decodes a versioned manifest with deterministic portable capabilities", () => {
    const plugin = defineNativePlugin({
      manifest: {
        capabilities: [
          {
            key: "telemetry:write",
            required: false,
          },
          {
            key: "commerce:events",
            required: true,
          },
        ],
        id: "analytics.plugin",
        schemaVersion: 1,
        version: "1.2.0-beta.1",
      },
    });

    const encodedManifest = Schema.encodeSync(NativePluginManifestSchema)(
      plugin.manifest
    );

    expect(encodedManifest).toEqual({
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
      id: "analytics.plugin",
      schemaVersion: 1,
      tier: "native",
      version: "1.2.0-beta.1",
    });
    expect(
      Schema.decodeUnknownSync(NativePluginManifestSchema)(encodedManifest)
    ).toEqual(plugin.manifest);
  });

  it("rejects malformed identity, version, and capability declarations", () => {
    expect(() =>
      defineNativePlugin({
        manifest: {
          capabilities: [],
          id: "Analytics Plugin",
          schemaVersion: 1,
          version: "1.0.0",
        },
      })
    ).toThrow();

    expect(() =>
      defineNativePlugin({
        manifest: {
          capabilities: [],
          id: "analytics",
          schemaVersion: 1,
          version: "latest",
        },
      })
    ).toThrow();

    expect(() =>
      defineNativePlugin({
        manifest: {
          capabilities: [
            {
              key: "cloudflare:binding",
              required: true,
            },
          ],
          id: "analytics",
          schemaVersion: 1,
          version: "1.0.0",
        },
      })
    ).toThrow();
  });

  it("rejects duplicate capability keys instead of merging requirements", () => {
    expect(() =>
      defineNativePlugin({
        manifest: {
          capabilities: [
            {
              key: "commerce:events",
              required: true,
            },
            {
              key: "commerce:events",
              required: false,
            },
          ],
          id: "analytics",
          schemaVersion: 1,
          version: "1.0.0",
        },
      })
    ).toThrow();
  });
});

import { describe, expect, it } from "bun:test";

import { defineNativePlugin } from "../plugins/index";
import {
  composeAdminMetadata,
  createAdminPermission,
  defineAdminMetadataContribution,
} from "./index";

describe("admin metadata composition", () => {
  const productContribution = defineAdminMetadataContribution({
    source: {
      key: "product",
      label: "Product module",
      type: "module",
    },
    surfaces: [
      {
        kind: "navigation",
        key: "navigation",
        label: "Products",
        order: 20,
        path: "/dashboard/products",
        permission: createAdminPermission("product", "read"),
      },
      {
        kind: "resource",
        key: "resource",
        label: "Product catalog",
        operations: {
          create: { key: "productCreate" },
          list: { key: "productList" },
        },
        permission: createAdminPermission("product", "write"),
        primitives: [
          {
            kind: "table",
            key: "product-table",
            operation: { key: "productList" },
          },
        ],
      },
    ],
  });

  it("normalizes module and active plugin metadata with source-scoped IDs", () => {
    const analyticsPlugin = defineNativePlugin({
      contributions: {
        adminSurfaces: [
          {
            kind: "widget",
            key: "summary",
            label: "Analytics summary",
            order: 10,
            primitive: {
              kind: "stat",
              key: "summary-stat",
              operation: { key: "analyticsSummary" },
            },
          },
        ],
      },
      manifest: {
        capabilities: ["admin:read"],
        id: "analytics",
        version: "1.0.0",
      },
    });

    const model = composeAdminMetadata({
      contributions: [productContribution],
      plugins: [analyticsPlugin],
    });

    expect(model.surfaces.map((surface) => surface.id)).toEqual([
      "plugin:analytics:summary",
      "module:product:navigation",
      "module:product:resource",
    ]);
    expect(model.surfaces[0]).toMatchObject({
      label: "Analytics summary",
      source: {
        key: "analytics",
        type: "plugin",
      },
    });
  });

  it("filters surfaces by declared permissions", () => {
    const model = composeAdminMetadata({
      contributions: [productContribution],
      permissions: ["product:read"],
    });

    expect(model.surfaces.map((surface) => surface.id)).toEqual([
      "module:product:navigation",
    ]);
  });

  it("validates declared permissions through an injected validator", () => {
    expect(() =>
      composeAdminMetadata({
        contributions: [
          defineAdminMetadataContribution({
            source: {
              key: "analytics",
              label: "Analytics",
              type: "plugin",
            },
            surfaces: [
              {
                key: "navigation",
                kind: "navigation",
                label: "Analytics",
                permission: "analytics:read",
              },
            ],
          }),
        ],
        permissionValidator: (permission) => {
          if (permission.key !== "product:read") {
            throw new Error(`Unsupported permission "${permission.key}".`);
          }
        },
      })
    ).toThrow(/Unsupported permission "analytics:read"/);
  });

  it("rejects duplicate global surface IDs with contributor labels", () => {
    const duplicateContribution = defineAdminMetadataContribution({
      source: {
        key: "product",
        label: "Duplicate product module",
        type: "module",
      },
      surfaces: [
        {
          kind: "navigation",
          key: "navigation",
          label: "Duplicate Products",
        },
      ],
    });

    expect(() =>
      composeAdminMetadata({
        contributions: [productContribution, duplicateContribution],
      })
    ).toThrow(/module:product:navigation.*Product module.*Duplicate product/);
  });

  it("rejects unsupported sandbox plugin primitives", () => {
    expect(() =>
      defineAdminMetadataContribution({
        source: {
          key: "sandbox-tax",
          label: "Sandbox tax plugin",
          tier: "sandbox",
          type: "plugin",
        },
        surfaces: [
          {
            kind: "widget",
            key: "settings",
            label: "Tax settings",
            primitive: {
              component: "@tax/admin/Settings",
              kind: "custom",
              key: "tax-settings",
            },
          },
        ],
      })
    ).toThrow(/Unsupported sandbox admin primitive "custom"/);
  });
});

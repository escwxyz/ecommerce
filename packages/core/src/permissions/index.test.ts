import { describe, expect, it } from "bun:test";

import {
  composeCommercePermissions,
  createCommercePermission,
  createCommercePermissionValidator,
} from "./index";

describe("commerce permission composition", () => {
  it("composes descriptors into a statement for auth builders", () => {
    const composition = composeCommercePermissions([
      {
        permissions: [
          createCommercePermission({
            action: "write",
            resource: "product",
          }),
          createCommercePermission({
            action: "read",
            resource: "product",
          }),
        ],
        source: {
          key: "product",
          type: "module",
        },
      },
    ]);

    expect(composition.statement).toEqual({
      product: ["read", "write"],
    });
    expect(composition.permissions.map((permission) => permission.key)).toEqual(
      ["product:read", "product:write"]
    );
  });

  it("rejects duplicate permission keys across sources", () => {
    const permission = createCommercePermission({
      action: "read",
      resource: "product",
    });

    expect(() =>
      composeCommercePermissions([
        {
          permissions: [permission],
          source: {
            key: "product",
            type: "module",
          },
        },
        {
          permissions: [permission],
          source: {
            key: "catalog-plugin",
            type: "plugin",
          },
        },
      ])
    ).toThrow(/Duplicate commerce permission "product:read"/);
  });

  it("creates validators from the composed vocabulary", () => {
    const composition = composeCommercePermissions([
      {
        permissions: [
          createCommercePermission({
            action: "read",
            resource: "product",
          }),
        ],
        source: {
          key: "product",
          type: "module",
        },
      },
    ]);
    const validatePermission = createCommercePermissionValidator(composition);

    expect(validatePermission("product:read")).toBe("product:read");
    expect(() => validatePermission("product:write")).toThrow(
      /Unsupported commerce permission "product:write"/
    );
  });
});

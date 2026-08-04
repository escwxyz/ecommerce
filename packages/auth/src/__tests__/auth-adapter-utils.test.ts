import { describe, expect, it } from "bun:test";

import {
  decodeAdapterPermissionKeys,
  getAdapterBooleanField,
  getAdapterDateField,
  getAdapterStringField,
  normalizeAdapterRole,
  toAdapterRecord,
} from "../auth-adapter-utils";
import { AuthPermissionKey } from "../auth-contracts";

describe("auth adapter utilities", () => {
  it("reads typed scalar fields from unknown provider records", () => {
    const issuedAt = new Date("2026-01-01T00:00:00.000Z");
    const record = toAdapterRecord({
      email: "customer@example.com",
      emailVerified: true,
      issuedAt,
      name: "",
    });

    expect(record).toBeDefined();
    expect(getAdapterStringField(record ?? {}, "email")).toBe(
      "customer@example.com"
    );
    expect(getAdapterStringField(record ?? {}, "name")).toBeUndefined();
    expect(getAdapterBooleanField(record ?? {}, "emailVerified")).toBe(true);
    expect(getAdapterDateField(record ?? {}, "issuedAt")).toBe(issuedAt);
    expect(toAdapterRecord(null)).toBeUndefined();
  });

  it("decodes only valid provider permission keys", () => {
    const permissionKeys = decodeAdapterPermissionKeys([
      "product:read",
      "bad permission",
      123,
      "order:update:tenant-1",
    ]);

    expect(permissionKeys).toEqual([
      AuthPermissionKey.make("product:read"),
      AuthPermissionKey.make("order:update:tenant-1"),
    ]);
  });

  it("normalizes provider roles into Effect auth roles", () => {
    expect(normalizeAdapterRole("admin")).toBe("store-admin");
    expect(normalizeAdapterRole(["customer", "store-admin"])).toBe(
      "store-admin"
    );
    expect(normalizeAdapterRole("customer")).toBe("customer");
    expect(normalizeAdapterRole(undefined)).toBe("customer");
  });
});

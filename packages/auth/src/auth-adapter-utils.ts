import { Schema } from "effect";

import { AuthPermissionKey } from "./auth-contracts";
import type { AuthRole } from "./auth-contracts";

/**
 * Converts an unknown provider payload into a safe indexable record. Auth
 * adapters should use this at their boundary before reading provider-specific
 * fields from untrusted session/user objects.
 */
export const toAdapterRecord = (
  value: unknown
): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;

export const getAdapterDateField = (
  record: Record<string, unknown>,
  key: string
): Date | undefined => {
  const value = record[key];

  return value instanceof Date ? value : undefined;
};

export const getAdapterStringField = (
  record: Record<string, unknown>,
  key: string
): string | undefined => {
  const value = record[key];

  return typeof value === "string" && value.length > 0 ? value : undefined;
};

export const getAdapterBooleanField = (
  record: Record<string, unknown>,
  key: string
): boolean | undefined => {
  const value = record[key];

  return typeof value === "boolean" ? value : undefined;
};

/**
 * Decodes provider-supplied permission strings into portable auth permission
 * keys and drops malformed or non-string entries at the adapter boundary.
 */
export const decodeAdapterPermissionKeys = (
  permissions: unknown
): readonly AuthPermissionKey[] => {
  if (!Array.isArray(permissions)) {
    return [];
  }

  const permissionKeys: AuthPermissionKey[] = [];

  for (const permission of permissions) {
    if (typeof permission !== "string") {
      continue;
    }

    const decoded = Schema.decodeUnknownExit(AuthPermissionKey)(permission);

    if (decoded._tag === "Success") {
      permissionKeys.push(decoded.value);
    }
  }

  return permissionKeys;
};

/**
 * Normalizes simple provider role values into the Effect auth boundary role
 * vocabulary. The function intentionally defaults to `customer` because
 * anonymous state is represented by the absence of an authenticated session.
 */
export const normalizeAdapterRole = (role: unknown): AuthRole => {
  let roles: readonly unknown[] = [];

  if (Array.isArray(role)) {
    roles = role;
  } else if (typeof role === "string") {
    roles = role.split(",");
  }

  return roles.some((value) => value === "admin" || value === "store-admin")
    ? "store-admin"
    : "customer";
};

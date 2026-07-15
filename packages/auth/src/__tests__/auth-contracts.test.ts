import { describe, expect, it } from "bun:test";

import { Effect, Exit, Schema } from "effect";

import {
  AuthAdapterFailure,
  AuthIdentity,
  AuthPermission,
  AuthPermissionDenied,
  AuthPermissionKey,
  AuthRole,
  AuthSession,
  AuthSessionExpired,
  AuthSessionId,
  AuthUnauthenticated,
  AuthUserId,
  createAuthPermissionKey,
} from "../auth-contracts";

const fixedDate = new Date("2026-01-01T00:00:00.000Z");

describe("Effect auth boundary contracts", () => {
  it("decodes identity, session, role, and permission contracts without Better Auth types", () => {
    const userId = AuthUserId.make("user_1");
    const role = Schema.decodeUnknownSync(AuthRole)("store-admin");
    const permission = Schema.decodeUnknownSync(AuthPermission)({
      action: "read",
      resource: "product",
    });
    const identity = Schema.decodeUnknownSync(AuthIdentity)({
      email: "admin@example.com",
      emailVerified: true,
      id: userId,
      name: "Admin",
      role,
    });
    const session = Schema.decodeUnknownSync(AuthSession)({
      expiresAt: fixedDate,
      id: "session_1",
      identity,
      issuedAt: fixedDate,
      permissionKeys: [createAuthPermissionKey(permission)],
    });

    expect(session.identity.id).toBe(userId);
    expect(session.identity.role).toBe("store-admin");
    expect(session.permissionKeys).toEqual([
      AuthPermissionKey.make("product:read"),
    ]);
  });

  it("rejects invalid auth boundary values before module logic sees them", () => {
    const invalidIdentity = Schema.decodeUnknownExit(AuthIdentity)({
      email: "not-an-email",
      emailVerified: true,
      id: "",
      name: "",
      role: "root",
    });
    const invalidPermission = Schema.decodeUnknownExit(AuthPermission)({
      action: "",
      resource: "product",
    });

    expect(Exit.isFailure(invalidIdentity)).toBe(true);
    expect(Exit.isFailure(invalidPermission)).toBe(true);
  });

  it("keeps expected auth failures schema-backed and matchable", () => {
    const unauthenticated = new AuthUnauthenticated({
      reason: "missing-session",
    });
    const expired = new AuthSessionExpired({
      expiredAt: fixedDate,
      sessionId: AuthSessionId.make("session_1"),
    });
    const denied = new AuthPermissionDenied({
      permission: AuthPermissionKey.make("product:write"),
      reason: "missing-permission",
    });
    const adapterFailure = new AuthAdapterFailure({
      adapter: "better-auth",
      operation: "get-session",
      reason: "provider-rejected",
    });
    const recovered = Effect.runSync(
      Effect.fail(denied).pipe(
        Effect.catchTag("AuthPermissionDenied", (error) =>
          Effect.succeed(error.permission)
        )
      )
    );

    expect(Schema.encodeSync(AuthUnauthenticated)(unauthenticated)).toEqual({
      _tag: "AuthUnauthenticated",
      reason: "missing-session",
    });
    expect(Schema.encodeSync(AuthSessionExpired)(expired)).toEqual({
      _tag: "AuthSessionExpired",
      expiredAt: fixedDate,
      sessionId: "session_1",
    });
    expect(Schema.encodeSync(AuthPermissionDenied)(denied)).toEqual({
      _tag: "AuthPermissionDenied",
      permission: "product:write",
      reason: "missing-permission",
    });
    expect(Schema.encodeSync(AuthAdapterFailure)(adapterFailure)).toEqual({
      _tag: "AuthAdapterFailure",
      adapter: "better-auth",
      operation: "get-session",
      reason: "provider-rejected",
    });
    expect(recovered).toBe(AuthPermissionKey.make("product:write"));
  });
});

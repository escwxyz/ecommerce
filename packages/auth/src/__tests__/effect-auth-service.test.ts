import { describe, expect, it } from "bun:test";

import { Effect } from "effect";

import {
  AuthPermissionDenied,
  AuthPermissionKey,
  AuthSessionId,
  AuthUnauthenticated,
  AuthUserId,
} from "../auth-contracts";
import {
  CurrentAuthRequestContext,
  EffectAuthService,
  authRequestContextLayer,
  effectAuthServiceLayer,
  makeAnonymousAuthRequestContext,
} from "../effect-auth-service";

const session = {
  expiresAt: new Date("2026-01-02T00:00:00.000Z"),
  id: AuthSessionId.make("session_1"),
  identity: {
    email: "admin@example.com",
    emailVerified: true,
    id: AuthUserId.make("user_1"),
    name: "Admin",
    role: "store-admin" as const,
  },
  issuedAt: new Date("2026-01-01T00:00:00.000Z"),
  permissionKeys: [AuthPermissionKey.make("product:read")],
};

describe("Effect auth service contracts", () => {
  it("provides request auth context through a replaceable Layer", async () => {
    const context = {
      identity: session.identity,
      isAuthenticated: true,
      permissionKeys: session.permissionKeys,
      session,
    };
    const program = CurrentAuthRequestContext.use((currentContext) =>
      Effect.succeed({
        permissionKeys: currentContext.permissionKeys,
        role: currentContext.identity?.role,
      })
    );

    await expect(
      Effect.runPromise(
        program.pipe(Effect.provide(authRequestContextLayer(context)))
      )
    ).resolves.toEqual({
      permissionKeys: [AuthPermissionKey.make("product:read")],
      role: "store-admin",
    });
  });

  it("defines an Effect-native AuthService without Better Auth types", async () => {
    const layer = effectAuthServiceLayer(
      EffectAuthService.of({
        getRequestContext: () =>
          Effect.succeed(makeAnonymousAuthRequestContext()),
        requireAuthenticated: () =>
          Effect.fail(new AuthUnauthenticated({ reason: "missing-session" })),
        requirePermission: () =>
          Effect.fail(
            new AuthPermissionDenied({
              permission: AuthPermissionKey.make("product:write"),
              reason: "missing-permission",
            })
          ),
      })
    );
    const program = EffectAuthService.use((service) =>
      Effect.all({
        context: service.getRequestContext({ headers: new Headers() }),
        permissionResult: Effect.exit(
          service.requirePermission({
            headers: new Headers(),
            permission: AuthPermissionKey.make("product:write"),
          })
        ),
      })
    );

    const result = await Effect.runPromise(program.pipe(Effect.provide(layer)));

    expect(result.context.isAuthenticated).toBe(false);
    expect(result.permissionResult._tag).toBe("Failure");
  });
});

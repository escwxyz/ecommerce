import { describe, expect, it } from "bun:test";

import { Effect } from "effect";

import {
  AuthAdapterFailure,
  AuthPermissionKey,
  AuthSessionExpired,
  AuthSessionId,
  AuthUserId,
} from "../auth-contracts";
import { betterAuthEffectAuthLayer } from "../better-auth-effect-adapter";
import { EffectAuthService } from "../effect-auth-service";

const fixedDate = new Date("2026-01-01T00:00:00.000Z");
const expiresAt = new Date("2027-01-02T00:00:00.000Z");

const createBetterAuthSession = () => ({
  session: {
    createdAt: fixedDate,
    expiresAt,
    id: "session_1",
    token: "session-token",
    updatedAt: fixedDate,
    userId: "user_1",
  },
  user: {
    banned: false,
    createdAt: fixedDate,
    email: "admin@example.com",
    emailVerified: true,
    id: "user_1",
    name: "Admin",
    permissions: ["product:read"],
    role: "admin",
    updatedAt: fixedDate,
  },
});

describe("Better Auth Effect adapter", () => {
  it("wraps Better Auth getSession behind the Effect AuthService Layer", async () => {
    const calls: Headers[] = [];
    const headers = new Headers({ cookie: "better-auth.session=token" });
    const layer = betterAuthEffectAuthLayer({
      api: {
        getSession: (input) => {
          calls.push(input.headers);
          return Promise.resolve(createBetterAuthSession());
        },
      },
    });
    const permission = AuthPermissionKey.make("product:read");
    const program = EffectAuthService.use((service) =>
      service.requirePermission({ headers, permission })
    );

    const context = await Effect.runPromise(
      program.pipe(Effect.provide(layer))
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]).not.toBe(headers);
    expect(calls[0]?.get("cookie")).toBe("better-auth.session=token");
    expect(context.isAuthenticated).toBe(true);
    expect(context.identity?.id).toBe(AuthUserId.make("user_1"));
    expect(context.identity?.role).toBe("store-admin");
    expect(context.permissionKeys).toEqual([permission]);
    expect(context.session?.id).toBe(AuthSessionId.make("session_1"));
  });

  it("keeps anonymous Better Auth sessions as unauthenticated context", async () => {
    const layer = betterAuthEffectAuthLayer({
      api: {
        getSession: () => Promise.resolve(null),
      },
    });
    const program = EffectAuthService.use((service) =>
      Effect.all({
        context: service.getRequestContext({ headers: new Headers() }),
        required: Effect.exit(
          service.requireAuthenticated({ headers: new Headers() })
        ),
      })
    );

    const result = await Effect.runPromise(program.pipe(Effect.provide(layer)));

    expect(result.context.isAuthenticated).toBe(false);
    expect(result.required._tag).toBe("Failure");
  });

  it("normalizes rejected Better Auth calls to adapter failures", async () => {
    const layer = betterAuthEffectAuthLayer({
      api: {
        getSession: () => Promise.reject(new Error("database unavailable")),
      },
    });
    const program = EffectAuthService.use((service) =>
      Effect.flip(service.getRequestContext({ headers: new Headers() }))
    );

    const failure = await Effect.runPromise(
      program.pipe(Effect.provide(layer))
    );

    expect(failure).toBeInstanceOf(AuthAdapterFailure);
    expect(failure._tag).toBe("AuthAdapterFailure");
    if (failure._tag !== "AuthAdapterFailure") {
      throw new Error("expected AuthAdapterFailure");
    }
    expect(failure.reason).toBe("provider-rejected");
  });

  it("normalizes malformed Better Auth session results to adapter failures", async () => {
    const layer = betterAuthEffectAuthLayer({
      api: {
        getSession: () => Promise.resolve({ session: {}, user: {} }),
      },
    });
    const program = EffectAuthService.use((service) =>
      Effect.flip(service.getRequestContext({ headers: new Headers() }))
    );

    const failure = await Effect.runPromise(
      program.pipe(Effect.provide(layer))
    );

    expect(failure).toBeInstanceOf(AuthAdapterFailure);
    expect(failure._tag).toBe("AuthAdapterFailure");
    if (failure._tag !== "AuthAdapterFailure") {
      throw new Error("expected AuthAdapterFailure");
    }
    expect(failure.reason).toBe("invalid-response");
  });

  it("normalizes expired Better Auth sessions to boundary auth failures", async () => {
    const layer = betterAuthEffectAuthLayer({
      api: {
        getSession: () =>
          Promise.resolve({
            ...createBetterAuthSession(),
            session: {
              ...createBetterAuthSession().session,
              expiresAt: new Date("2026-01-02T00:00:00.000Z"),
            },
          }),
      },
    });
    const program = EffectAuthService.use((service) =>
      Effect.flip(service.requireAuthenticated({ headers: new Headers() }))
    );

    const failure = await Effect.runPromise(
      program.pipe(Effect.provide(layer))
    );

    expect(failure).toBeInstanceOf(AuthSessionExpired);
  });
});

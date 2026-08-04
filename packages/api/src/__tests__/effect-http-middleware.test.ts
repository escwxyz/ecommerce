import { describe, expect, it } from "bun:test";

import {
  AuthAdapterFailure,
  AuthPermissionKeySchema,
  AuthSessionId,
  AuthSessionExpired,
  AuthUnauthenticated,
  AuthUserId,
  EffectAuthServiceTag,
  effectAuthServiceLayer,
  type AuthRequestFailure,
  type EffectAuthSession,
} from "@ecommerce/auth";
import { Cause, Effect, Exit, Layer, Schema } from "effect";

import {
  CurrentEffectHttpAuthContext,
  CurrentEffectHttpRequestContext,
  EffectHttpAuthService,
  type EffectHttpAuthContext,
  EffectHttpDeadlineExceeded,
  EffectHttpForbidden,
  EffectHttpUnauthorized,
  EffectHttpPermissionService,
  EffectHttpRequestIdGenerator,
  createEffectHttpRequestContext,
  effectHttpAuthServiceFromEffectAuthLayer,
  serializeEffectHttpMiddlewareFailure,
  serializeSanitizedEffectHttpCause,
  withEffectHttpAuth,
  withEffectHttpDeadline,
  withEffectHttpPermission,
  withEffectHttpRequestContext,
} from "../effect-http-middleware";
import { SerializedApiError } from "../http-api-schemas";

const provideRequestIdGenerator = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.provideService(effect, EffectHttpRequestIdGenerator, {
    nextId: () => Effect.succeed("req_generated"),
  });

const requestContext = {
  correlation: {
    operationId: "corr_1",
    requestId: "req_1",
    traceId: "trace_1",
  },
  deadlineAtEpochMillis: Number.MAX_SAFE_INTEGER,
  headers: new Headers({ cookie: "better-auth.session=token" }),
  identity: {
    correlationId: "corr_1",
    requestId: "req_1",
    traceId: "trace_1",
  },
  method: "GET",
  path: "/admin/products",
  startedAtEpochMillis: 0,
};

const session: EffectAuthSession = {
  expiresAt: new Date("2027-01-02T00:00:00.000Z"),
  id: AuthSessionId.make("session_1"),
  identity: {
    email: "admin@example.com",
    emailVerified: true,
    id: AuthUserId.make("user_1"),
    name: "Admin",
    role: "store-admin",
  },
  issuedAt: new Date("2026-01-01T00:00:00.000Z"),
  permissionKeys: [AuthPermissionKeySchema.make("product:read")],
};

const authRequestContext = {
  identity: session.identity,
  isAuthenticated: true,
  permissionKeys: session.permissionKeys,
  session,
};

const resolvedAuthContext: EffectHttpAuthContext = {
  actor: {
    kind: session.identity.role,
    permissionKeys: session.permissionKeys,
    session,
    userId: session.identity.id,
  },
  requestContext: authRequestContext,
  session,
};

const runEffectAuthBridgeExit = (failure: AuthRequestFailure) => {
  const authLayer = effectAuthServiceLayer(
    EffectAuthServiceTag.of({
      getRequestContext: () =>
        Effect.fail(
          new AuthAdapterFailure({
            adapter: "test-auth",
            operation: "get-request-context",
            reason: "provider-rejected",
          })
        ),
      requireAuthenticated: () => Effect.fail(failure),
      requirePermission: () => Effect.fail(failure),
    })
  );
  const authBridgeLayer = effectHttpAuthServiceFromEffectAuthLayer.pipe(
    Layer.provide(authLayer)
  );
  const program = EffectHttpAuthService.use((service) =>
    service.authenticate(requestContext)
  );

  return Effect.runPromiseExit(program.pipe(Effect.provide(authBridgeLayer)));
};

describe("Effect HTTP middleware foundation", () => {
  it("derives request identity from headers and falls back to generated ids", async () => {
    const fromHeaders = await Effect.runPromise(
      createEffectHttpRequestContext({
        headers: {
          traceparent:
            "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00",
          "x-correlation-id": "corr_header",
          "x-request-id": "req_header",
        },
        method: "GET",
        path: "/store/products",
      }).pipe(provideRequestIdGenerator)
    );
    const generated = await Effect.runPromise(
      createEffectHttpRequestContext({
        headers: {},
        method: "GET",
        path: "/store/products",
      }).pipe(provideRequestIdGenerator)
    );

    expect(fromHeaders.identity).toEqual({
      correlationId: "corr_header",
      requestId: "req_header",
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
    });
    expect(fromHeaders.correlation).toEqual({
      operationId: "corr_header",
      parentSpanId: "00f067aa0ba902b7",
      requestId: "req_header",
      sampled: false,
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
    });
    expect(generated.identity.correlationId).toBe("req_generated");
    expect(generated.identity.requestId).toBe("req_generated");
  });

  it("installs request context and auth context before handlers run", async () => {
    const program = withEffectHttpRequestContext(
      withEffectHttpAuth(CurrentEffectHttpAuthContext),
      requestContext
    ).pipe(
      Effect.provideService(EffectHttpAuthService, {
        authenticate: (context) =>
          Effect.succeed(resolvedAuthContext).pipe(
            Effect.tap(() =>
              Effect.sync(() => {
                expect(context.identity.requestId).toBe("req_1");
              })
            )
          ),
      })
    );

    const currentAuthContext = await Effect.runPromise(program);

    expect(currentAuthContext.actor.userId).toBe("user_1");
  });

  it("maps only unauthenticated auth failures to HTTP unauthorized", async () => {
    const unauthorizedExit = await runEffectAuthBridgeExit(
      new AuthUnauthenticated({ reason: "missing-session" })
    );
    const adapterFailure = new AuthAdapterFailure({
      adapter: "better-auth",
      operation: "get-session",
      reason: "provider-rejected",
    });
    const expiredFailure = new AuthSessionExpired({
      expiredAt: new Date("2026-01-01T00:00:00.000Z"),
      sessionId: AuthSessionId.make("session_expired"),
    });

    const adapterExit = await runEffectAuthBridgeExit(adapterFailure);
    const expiredExit = await runEffectAuthBridgeExit(expiredFailure);

    expect(Exit.isFailure(unauthorizedExit)).toBe(true);
    expect(Exit.isFailure(adapterExit)).toBe(true);
    expect(Exit.isFailure(expiredExit)).toBe(true);

    if (Exit.isFailure(unauthorizedExit)) {
      const expectedFailure = unauthorizedExit.cause.reasons.find(
        Cause.isFailReason
      );
      expect(expectedFailure?.error).toBeInstanceOf(EffectHttpUnauthorized);
      expect(expectedFailure?.error._tag).toBe("EffectHttpUnauthorized");
    }
    if (Exit.isFailure(adapterExit)) {
      const defect = adapterExit.cause.reasons.find(Cause.isDieReason);
      expect(defect?.defect).toBe(adapterFailure);
    }
    if (Exit.isFailure(expiredExit)) {
      const defect = expiredExit.cause.reasons.find(Cause.isDieReason);
      expect(defect?.defect).toBe(expiredFailure);
    }
  });

  it("checks permissions before endpoint work runs", async () => {
    let executed = false;
    const program = withEffectHttpPermission(
      Effect.sync(() => {
        executed = true;
      }),
      "product:write"
    ).pipe(
      Effect.provideService(CurrentEffectHttpRequestContext, requestContext),
      Effect.provideService(CurrentEffectHttpAuthContext, {
        ...resolvedAuthContext,
      }),
      Effect.provideService(EffectHttpPermissionService, {
        requirePermission: ({ context, permission }) =>
          Effect.fail(
            new EffectHttpForbidden({
              message: "Missing required permission.",
              permission: String(permission),
              requestId: context.identity.requestId,
            })
          ),
      })
    );

    const failure = await Effect.runPromise(Effect.flip(program));

    expect(failure._tag).toBe("EffectHttpForbidden");
    expect(executed).toBe(false);
  });

  it("maps expired request deadlines to schema-backed failures", async () => {
    const expiredContext = {
      ...requestContext,
      deadlineAtEpochMillis: 0,
    };
    const program = withEffectHttpDeadline(Effect.succeed("ok")).pipe(
      Effect.provideService(CurrentEffectHttpRequestContext, expiredContext)
    );

    const failure = await Effect.runPromise(Effect.flip(program));

    expect(failure).toBeInstanceOf(EffectHttpDeadlineExceeded);
    expect(failure.requestId).toBe("req_1");
  });

  it("serializes expected middleware failures with the shared error schema", () => {
    const serialized = serializeEffectHttpMiddlewareFailure(
      new EffectHttpForbidden({
        message: "Missing required permission.",
        permission: "product:write",
        requestId: "req_1",
      })
    );

    expect(Schema.decodeUnknownSync(SerializedApiError)(serialized)).toEqual({
      error: {
        code: "EffectHttpForbidden",
        details: { permission: "product:write" },
        message: "Missing required permission.",
        request: {
          correlationId: "req_1",
          requestId: "req_1",
        },
      },
      success: false,
    });
  });

  it("sanitizes defect causes without exposing internal details", () => {
    const exit = Effect.runSync(
      Effect.exit(Effect.die("database password leaked"))
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      throw new Error("Expected defect failure.");
    }

    const serialized = serializeSanitizedEffectHttpCause(
      exit.cause,
      requestContext
    );

    expect(serialized.error.code).toBe("InternalServerError");
    expect(serialized.error.message).not.toContain("database password");
    expect(serialized.error.request.requestId).toBe("req_1");
  });
});

import { describe, expect, it } from "bun:test";

import type { AuthActor } from "@ecommerce/auth";
import { Effect, Exit, Schema } from "effect";

import {
  CurrentEffectHttpAuthContext,
  CurrentEffectHttpRequestContext,
  EffectHttpAuthService,
  EffectHttpDeadlineExceeded,
  EffectHttpForbidden,
  EffectHttpPermissionService,
  EffectHttpRequestIdGenerator,
  createEffectHttpRequestContext,
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
  deadlineAtEpochMillis: Number.MAX_SAFE_INTEGER,
  identity: {
    correlationId: "corr_1",
    requestId: "req_1",
    traceId: "trace_1",
  },
  method: "GET",
  path: "/admin/products",
  startedAtEpochMillis: 0,
};

const actor: AuthActor = {
  kind: "store-admin",
  permissionKeys: ["product:read"],
  session: null,
  userId: "user_1",
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
          Effect.succeed({
            actor,
            session: actor.session,
          }).pipe(
            Effect.tap(() =>
              Effect.sync(() => {
                expect(context.identity.requestId).toBe("req_1");
              })
            )
          ),
      })
    );

    const authContext = await Effect.runPromise(program);

    expect(authContext.actor.userId).toBe("user_1");
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
        actor,
        session: actor.session,
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

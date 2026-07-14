/* eslint-disable max-classes-per-file -- middleware expected failures and contract services are one shared HTTP vocabulary */

import type { AuthActor, AuthSession } from "@ecommerce/auth";
import type { CommercePermissionInput } from "@ecommerce/core/permissions";
import type {
  CorrelationContext,
  OperationTelemetryOptions,
} from "@ecommerce/core/telemetry";
import {
  sanitizeTelemetryAttributes,
  withOperationTelemetry,
} from "@ecommerce/core/telemetry";
import { Cause, Clock, Context, Effect, Layer, Schema } from "effect";
import type { Effect as EffectValue } from "effect/Effect";
import type { unhandled } from "effect/Types";
import { HttpServerRequest } from "effect/unstable/http/HttpServerRequest";
import type { HttpServerResponse } from "effect/unstable/http/HttpServerResponse";
import { HttpApiMiddleware } from "effect/unstable/httpapi";

import type {
  ApiRequestIdentity,
  SerializedApiError,
} from "./http-api-schemas";

export type EffectHttpRequestIdentity = typeof ApiRequestIdentity.Type;
export type EffectHttpSerializedError = typeof SerializedApiError.Type;

const DEFAULT_DEADLINE_MILLIS = 30_000;
const INTERNAL_ERROR_MESSAGE = "The request failed unexpectedly.";
const INTERRUPTED_MESSAGE = "The request was interrupted.";
const REQUEST_TIMEOUT_MESSAGE = "The request exceeded its deadline.";

/** Generates request identifiers when callers do not provide stable headers. */
export interface EffectHttpRequestIdGenerator {
  readonly nextId: () => EffectValue<string>;
}

/** Effect service for deterministic request identifier generation. */
export const EffectHttpRequestIdGenerator =
  Context.Service<EffectHttpRequestIdGenerator>(
    "@ecommerce/api/EffectHttpRequestIdGenerator"
  );

/** Request-scoped values installed before endpoint handlers run. */
export interface EffectHttpRequestContext {
  readonly deadlineAtEpochMillis: number;
  readonly identity: EffectHttpRequestIdentity;
  readonly method: string;
  readonly path: string;
  readonly startedAtEpochMillis: number;
}

/** Effect service containing the current HTTP request context. */
export const CurrentEffectHttpRequestContext =
  Context.Service<EffectHttpRequestContext>(
    "@ecommerce/api/CurrentEffectHttpRequestContext"
  );

/** Auth context installed after the auth adapter validates the current request. */
export interface EffectHttpAuthContext {
  readonly actor: AuthActor;
  readonly session: AuthSession;
}

/** Effect service containing the current authenticated actor/session context. */
export const CurrentEffectHttpAuthContext =
  Context.Service<EffectHttpAuthContext>(
    "@ecommerce/api/CurrentEffectHttpAuthContext"
  );

/** Expected failure when a request lacks authenticated identity. */
export class EffectHttpUnauthorized extends Schema.TaggedErrorClass<EffectHttpUnauthorized>()(
  "EffectHttpUnauthorized",
  {
    message: Schema.NonEmptyString,
    requestId: Schema.NonEmptyString,
  }
) {}

/** Expected failure when an authenticated actor lacks a required permission. */
export class EffectHttpForbidden extends Schema.TaggedErrorClass<EffectHttpForbidden>()(
  "EffectHttpForbidden",
  {
    message: Schema.NonEmptyString,
    permission: Schema.NonEmptyString,
    requestId: Schema.NonEmptyString,
  }
) {}

/** Expected failure when request execution exceeds its request-scoped deadline. */
export class EffectHttpDeadlineExceeded extends Schema.TaggedErrorClass<EffectHttpDeadlineExceeded>()(
  "EffectHttpDeadlineExceeded",
  {
    deadlineAtEpochMillis: Schema.Int,
    message: Schema.NonEmptyString,
    requestId: Schema.NonEmptyString,
  }
) {}

export type EffectHttpMiddlewareFailure =
  | EffectHttpDeadlineExceeded
  | EffectHttpForbidden
  | EffectHttpUnauthorized;

/** Adapter seam for authenticating the current request without leaking Better Auth types. */
export interface EffectHttpAuthService {
  readonly authenticate: (
    context: EffectHttpRequestContext
  ) => EffectValue<EffectHttpAuthContext, EffectHttpUnauthorized>;
}

/** Effect service for the request auth adapter used by HTTP middleware. */
export const EffectHttpAuthService = Context.Service<EffectHttpAuthService>(
  "@ecommerce/api/EffectHttpAuthService"
);

/** Adapter seam for checking permissions against the current authenticated context. */
export interface EffectHttpPermissionService {
  readonly requirePermission: (input: {
    readonly auth: EffectHttpAuthContext;
    readonly context: EffectHttpRequestContext;
    readonly permission: CommercePermissionInput;
  }) => EffectValue<void, EffectHttpForbidden>;
}

/** Effect service for HTTP permission checks. */
export const EffectHttpPermissionService =
  Context.Service<EffectHttpPermissionService>(
    "@ecommerce/api/EffectHttpPermissionService"
  );

export interface CreateEffectHttpRequestContextOptions {
  readonly defaultDeadlineMillis?: number;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly method: string;
  readonly path: string;
}

const getHeader = (
  headers: Readonly<Record<string, string | undefined>>,
  name: string
): string | undefined => {
  const value = headers[name.toLowerCase()] ?? headers[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
};

const getTraceId = (
  headers: Readonly<Record<string, string | undefined>>
): string | undefined => {
  const explicitTraceId = getHeader(headers, "x-trace-id");
  if (explicitTraceId) {
    return explicitTraceId;
  }

  const traceparent = getHeader(headers, "traceparent");
  const traceId = traceparent?.split("-")[1];
  return traceId && traceId.length > 0 ? traceId : undefined;
};

const getRequestPath = (request: HttpServerRequest): string => {
  const url = new URL(request.url, "http://effect-http.local");
  return url.pathname;
};

/** Creates a validated request context from serialized HTTP request metadata. */
export const createEffectHttpRequestContext = ({
  defaultDeadlineMillis = DEFAULT_DEADLINE_MILLIS,
  headers,
  method,
  path,
}: CreateEffectHttpRequestContextOptions): EffectValue<
  EffectHttpRequestContext,
  never,
  EffectHttpRequestIdGenerator
> =>
  Effect.gen(function* createContext() {
    const generator = yield* EffectHttpRequestIdGenerator;
    const generatedRequestId = yield* generator.nextId();
    const requestId = getHeader(headers, "x-request-id") ?? generatedRequestId;
    const correlationId = getHeader(headers, "x-correlation-id") ?? requestId;
    const startedAtEpochMillis = yield* Clock.currentTimeMillis;

    return {
      deadlineAtEpochMillis: startedAtEpochMillis + defaultDeadlineMillis,
      identity: {
        correlationId,
        requestId,
        traceId: getTraceId(headers),
      },
      method,
      path,
      startedAtEpochMillis,
    };
  });

/** Derives request context from the active Effect HTTP request service. */
export const createEffectHttpRequestContextFromServerRequest = (
  defaultDeadlineMillis?: number
): EffectValue<
  EffectHttpRequestContext,
  never,
  EffectHttpRequestIdGenerator | HttpServerRequest
> =>
  HttpServerRequest.pipe(
    Effect.flatMap((request) =>
      createEffectHttpRequestContext({
        defaultDeadlineMillis,
        headers: request.headers,
        method: request.method,
        path: getRequestPath(request),
      })
    )
  );

/** Installs request context into a handler Effect. */
export const withEffectHttpRequestContext = <A, E, R>(
  effect: EffectValue<A, E, R>,
  context: EffectHttpRequestContext
): EffectValue<A, E, Exclude<R, EffectHttpRequestContext>> =>
  Effect.provideService(effect, CurrentEffectHttpRequestContext, context);

/** Creates and installs request context from the active Effect HTTP request. */
export const withEffectHttpRequestContextFromServerRequest = <A, E, R>(
  effect: EffectValue<A, E, R>,
  options: { readonly defaultDeadlineMillis?: number } = {}
): EffectValue<
  A,
  E,
  | Exclude<R, EffectHttpRequestContext>
  | EffectHttpRequestIdGenerator
  | HttpServerRequest
> =>
  Effect.flatMap(
    createEffectHttpRequestContextFromServerRequest(
      options.defaultDeadlineMillis
    ),
    (context) => withEffectHttpRequestContext(effect, context)
  );

/** Authenticates the request and installs the resulting auth context. */
export const withEffectHttpAuth = <A, E, R>(
  effect: EffectValue<A, E, R>
): EffectValue<
  A,
  E | EffectHttpUnauthorized,
  | EffectHttpRequestContext
  | EffectHttpAuthService
  | Exclude<R, EffectHttpAuthContext>
> =>
  Effect.gen(function* authenticateRequest() {
    const context = yield* CurrentEffectHttpRequestContext;
    const auth = yield* EffectHttpAuthService;
    const authContext = yield* auth.authenticate(context);
    return yield* Effect.provideService(
      effect,
      CurrentEffectHttpAuthContext,
      authContext
    );
  });

/** Requires a permission before the wrapped endpoint handler runs. */
export const withEffectHttpPermission = <A, E, R>(
  effect: EffectValue<A, E, R>,
  permission: CommercePermissionInput
): EffectValue<
  A,
  E | EffectHttpForbidden,
  | EffectHttpAuthContext
  | EffectHttpRequestContext
  | EffectHttpPermissionService
  | R
> =>
  Effect.gen(function* requirePermission() {
    const auth = yield* CurrentEffectHttpAuthContext;
    const context = yield* CurrentEffectHttpRequestContext;
    const permissions = yield* EffectHttpPermissionService;
    yield* permissions.requirePermission({ auth, context, permission });
    return yield* effect;
  });

const deadlineExceeded = (
  context: EffectHttpRequestContext
): EffectHttpDeadlineExceeded =>
  new EffectHttpDeadlineExceeded({
    deadlineAtEpochMillis: context.deadlineAtEpochMillis,
    message: REQUEST_TIMEOUT_MESSAGE,
    requestId: context.identity.requestId,
  });

const mapTimeoutFailure =
  (context: EffectHttpRequestContext) =>
  <E>(error: E | Cause.TimeoutError): E | EffectHttpDeadlineExceeded =>
    Cause.isTimeoutError(error) ? deadlineExceeded(context) : error;

/** Applies the current request deadline and maps timeout failures to a schema-backed API error. */
export const withEffectHttpDeadline = <A, E, R>(
  effect: EffectValue<A, E, R>
): EffectValue<
  A,
  E | EffectHttpDeadlineExceeded,
  EffectHttpRequestContext | R
> =>
  Effect.gen(function* enforceDeadline() {
    const context = yield* CurrentEffectHttpRequestContext;
    const now = yield* Clock.currentTimeMillis;
    const remainingMillis = context.deadlineAtEpochMillis - now;
    if (remainingMillis <= 0) {
      return yield* Effect.fail(deadlineExceeded(context));
    }

    return yield* effect.pipe(
      Effect.timeout(`${remainingMillis} millis`),
      Effect.mapError(mapTimeoutFailure(context))
    );
  });

/** Adds request correlation to the shared telemetry helper. */
export const withEffectHttpTelemetry = <A, E, R>(
  effect: EffectValue<A, E, R>,
  options: Omit<OperationTelemetryOptions, "correlation">
): EffectValue<A, E, EffectHttpRequestContext | R> =>
  CurrentEffectHttpRequestContext.pipe(
    Effect.flatMap((context) =>
      withOperationTelemetry(effect, {
        ...options,
        attributes: sanitizeTelemetryAttributes({
          ...options.attributes,
          httpMethod: context.method,
          httpPath: context.path,
        }),
        correlation: {
          operationId: context.identity.correlationId,
          requestId: context.identity.requestId,
          traceId: context.identity.traceId,
        } satisfies CorrelationContext,
      })
    )
  );

/** Serializes a safe transport error from an expected middleware failure. */
export const serializeEffectHttpMiddlewareFailure = (
  failure: EffectHttpMiddlewareFailure
): EffectHttpSerializedError => {
  if (failure._tag === "EffectHttpForbidden") {
    return {
      error: {
        code: failure._tag,
        details: { permission: failure.permission },
        message: failure.message,
        request: {
          correlationId: failure.requestId,
          requestId: failure.requestId,
        },
      },
      success: false,
    };
  }

  return {
    error: {
      code: failure._tag,
      message: failure.message,
      request: {
        correlationId: failure.requestId,
        requestId: failure.requestId,
      },
    },
    success: false,
  };
};

/** Serializes defects and interruptions without exposing Cause internals. */
export const serializeSanitizedEffectHttpCause = <E>(
  cause: Cause.Cause<E>,
  context: EffectHttpRequestContext
): EffectHttpSerializedError => {
  const interruptedOnly = Cause.hasInterruptsOnly(cause);

  return {
    error: {
      code: interruptedOnly ? "RequestInterrupted" : "InternalServerError",
      message: interruptedOnly ? INTERRUPTED_MESSAGE : INTERNAL_ERROR_MESSAGE,
      request: context.identity,
    },
    success: false,
  };
};

/** Contract-level middleware that installs the shared request context service. */
export class EffectHttpRequestContextMiddleware extends HttpApiMiddleware.Service<
  EffectHttpRequestContextMiddleware,
  {
    provides: EffectHttpRequestContext;
    requires: EffectHttpRequestIdGenerator | HttpServerRequest;
  }
>()("@ecommerce/api/EffectHttpRequestContextMiddleware") {}

/** Contract-level middleware that authenticates and provides request auth context. */
export class EffectHttpAuthMiddleware extends HttpApiMiddleware.Service<
  EffectHttpAuthMiddleware,
  {
    provides: EffectHttpAuthContext;
    requires: EffectHttpRequestContext | EffectHttpAuthService;
  }
>()("@ecommerce/api/EffectHttpAuthMiddleware", {
  error: EffectHttpUnauthorized,
}) {}

/** Contract-level middleware that applies request deadline and telemetry wrappers. */
export class EffectHttpExecutionMiddleware extends HttpApiMiddleware.Service<
  EffectHttpExecutionMiddleware,
  {
    requires: EffectHttpRequestContext;
  }
>()("@ecommerce/api/EffectHttpExecutionMiddleware", {
  error: EffectHttpDeadlineExceeded,
}) {}

/** Layer implementation for request context middleware. */
export const effectHttpRequestContextMiddlewareLayer = Layer.succeed(
  EffectHttpRequestContextMiddleware,
  (
    httpEffect: EffectValue<
      HttpServerResponse,
      unhandled,
      EffectHttpRequestContext
    >
  ) => withEffectHttpRequestContextFromServerRequest(httpEffect)
);

/** Layer implementation for auth middleware. */
export const effectHttpAuthMiddlewareLayer = Layer.succeed(
  EffectHttpAuthMiddleware,
  (
    httpEffect: EffectValue<
      HttpServerResponse,
      unhandled,
      EffectHttpAuthContext
    >
  ) => withEffectHttpAuth(httpEffect)
);

/** Layer implementation for deadline and telemetry middleware. */
export const effectHttpExecutionMiddlewareLayer = Layer.succeed(
  EffectHttpExecutionMiddleware,
  (
    httpEffect: EffectValue<
      HttpServerResponse,
      unhandled,
      EffectHttpRequestContext
    >,
    options: { readonly endpoint: { readonly name: string } }
  ) =>
    withEffectHttpTelemetry(withEffectHttpDeadline(httpEffect), {
      name: "unknown",
      attributes: {
        endpoint: options.endpoint.name,
      },
    })
);

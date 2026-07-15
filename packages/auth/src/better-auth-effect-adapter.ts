import { Effect, Schema } from "effect";

import {
  decodeAdapterPermissionKeys,
  getAdapterBooleanField,
  getAdapterDateField,
  getAdapterStringField,
  normalizeAdapterRole,
  toAdapterRecord,
} from "./auth-adapter-utils";
import {
  AuthAdapterFailure,
  AuthPermissionDenied,
  AuthSession,
  AuthSessionExpired,
  AuthUnauthenticated,
} from "./auth-contracts";
import type { AuthAdapterFailureReason } from "./auth-contracts";
import {
  EffectAuthService,
  effectAuthServiceLayer,
  makeAnonymousAuthRequestContext,
  makeAuthenticatedAuthRequestContext,
} from "./effect-auth-service";
import type { AuthRequestContext } from "./effect-auth-service";

interface BetterAuthCompatibleSessionApi {
  readonly getSession: (input: {
    readonly headers: Headers;
    readonly query?: {
      readonly disableCookieCache?: boolean;
    };
  }) => Promise<unknown> | unknown;
}

export interface BetterAuthCompatibleService {
  readonly api: BetterAuthCompatibleSessionApi;
}

const adapter = "better-auth";
const getSessionOperation = "get-session";

const makeBetterAuthAdapterFailure = (
  reason: AuthAdapterFailureReason
): AuthAdapterFailure =>
  new AuthAdapterFailure({
    adapter,
    operation: getSessionOperation,
    reason,
  });

const createBetterAuthGetSessionRequest = (headers: Headers) => ({
  headers: new Headers(headers),
});

const decodeBetterAuthSession = (rawSession: unknown) =>
  Effect.gen(function* decodeBetterAuthSessionGenerator() {
    if (rawSession === null || rawSession === undefined) {
      return makeAnonymousAuthRequestContext();
    }

    const root = toAdapterRecord(rawSession);
    const session = toAdapterRecord(root?.session);
    const user = toAdapterRecord(root?.user);

    if (!root || !session || !user) {
      return yield* makeBetterAuthAdapterFailure("invalid-response");
    }

    const sessionId = getAdapterStringField(session, "id");
    const userId = getAdapterStringField(user, "id");
    const email = getAdapterStringField(user, "email");
    const emailVerified = getAdapterBooleanField(user, "emailVerified");
    const name = getAdapterStringField(user, "name");
    const issuedAt =
      getAdapterDateField(session, "createdAt") ??
      getAdapterDateField(session, "updatedAt");
    const expiresAt = getAdapterDateField(session, "expiresAt");

    const decoded = yield* Schema.decodeUnknownEffect(AuthSession)({
      expiresAt,
      id: sessionId,
      identity: {
        email,
        emailVerified,
        id: userId,
        name,
        role: normalizeAdapterRole(user.role),
      },
      issuedAt,
      permissionKeys: decodeAdapterPermissionKeys(user.permissions),
    }).pipe(
      Effect.mapError(() => makeBetterAuthAdapterFailure("invalid-response"))
    );

    if (decoded.expiresAt.getTime() <= Date.now()) {
      return yield* new AuthSessionExpired({
        expiredAt: decoded.expiresAt,
        sessionId: decoded.id,
      });
    }

    return makeAuthenticatedAuthRequestContext(decoded);
  });

const getBetterAuthRequestContext = (
  auth: BetterAuthCompatibleService,
  headers: Headers
) =>
  Effect.tryPromise({
    catch: () => makeBetterAuthAdapterFailure("provider-rejected"),
    try: () =>
      Promise.resolve(
        auth.api.getSession(createBetterAuthGetSessionRequest(headers))
      ),
  }).pipe(Effect.flatMap(decodeBetterAuthSession));

const requireAuthenticatedContext = (
  context: AuthRequestContext
): Effect.Effect<AuthRequestContext, AuthUnauthenticated> =>
  context.isAuthenticated
    ? Effect.succeed(context)
    : Effect.fail(new AuthUnauthenticated({ reason: "missing-session" }));

export const makeBetterAuthEffectAuthService = (
  auth: BetterAuthCompatibleService
) =>
  EffectAuthService.of({
    getRequestContext: ({ headers }) =>
      getBetterAuthRequestContext(auth, headers),
    requireAuthenticated: ({ headers }) =>
      getBetterAuthRequestContext(auth, headers).pipe(
        Effect.flatMap(requireAuthenticatedContext)
      ),
    requirePermission: ({ headers, permission }) =>
      getBetterAuthRequestContext(auth, headers).pipe(
        Effect.flatMap(requireAuthenticatedContext),
        Effect.flatMap((context) => {
          if (context.permissionKeys.includes(permission)) {
            return Effect.succeed(context);
          }

          return Effect.fail(
            new AuthPermissionDenied({
              permission,
              reason: "missing-permission",
            })
          );
        })
      ),
  });

export const betterAuthEffectAuthLayer = (auth: BetterAuthCompatibleService) =>
  effectAuthServiceLayer(makeBetterAuthEffectAuthService(auth));

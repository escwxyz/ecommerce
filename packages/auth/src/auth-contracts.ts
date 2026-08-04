/* eslint-disable max-classes-per-file -- auth expected failures are one shared schema-backed vocabulary */
import { Schema } from "effect";

const authPermissionKeyPattern =
  /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*(?::[a-z][a-z0-9-]*)?$/u;
const authPermissionSegmentPattern = /^[a-z][a-z0-9-]*$/u;
const authEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

/** Stable user identifier owned by the Effect auth boundary. */
export const AuthUserId = Schema.NonEmptyString.pipe(
  Schema.brand("AuthUserId")
);
export type AuthUserId = typeof AuthUserId.Type;

/** Stable session identifier owned by the Effect auth boundary. */
export const AuthSessionId = Schema.NonEmptyString.pipe(
  Schema.brand("AuthSessionId")
);
export type AuthSessionId = typeof AuthSessionId.Type;

/** Role vocabulary exposed to modules, APIs, workflows, and plugins. */
export const AuthRole = Schema.Literals([
  "anonymous",
  "customer",
  "store-admin",
  "system",
]);
export type AuthRole = typeof AuthRole.Type;

/** Permission resource segment used to build portable commerce permission keys. */
export const AuthPermissionResource = Schema.NonEmptyString.pipe(
  Schema.check(Schema.isPattern(authPermissionSegmentPattern)),
  Schema.brand("AuthPermissionResource")
);
export type AuthPermissionResource = typeof AuthPermissionResource.Type;

/** Permission action segment used to build portable commerce permission keys. */
export const AuthPermissionAction = Schema.NonEmptyString.pipe(
  Schema.check(Schema.isPattern(authPermissionSegmentPattern)),
  Schema.brand("AuthPermissionAction")
);
export type AuthPermissionAction = typeof AuthPermissionAction.Type;

/** Optional permission scope segment for future tenant, channel, or actor scoping. */
export const AuthPermissionScope = Schema.NonEmptyString.pipe(
  Schema.check(Schema.isPattern(authPermissionSegmentPattern)),
  Schema.brand("AuthPermissionScope")
);
export type AuthPermissionScope = typeof AuthPermissionScope.Type;

/** Serialized permission key accepted by the Effect auth boundary. */
export const AuthPermissionKey = Schema.NonEmptyString.pipe(
  Schema.check(Schema.isPattern(authPermissionKeyPattern)),
  Schema.brand("AuthPermissionKey")
);
export type AuthPermissionKey = typeof AuthPermissionKey.Type;

/** Structured permission representation before key normalization. */
export const AuthPermission = Schema.Struct({
  action: AuthPermissionAction,
  resource: AuthPermissionResource,
  scope: Schema.optional(AuthPermissionScope),
});

/** Public identity shape exposed by the Effect auth boundary. */
export const AuthIdentity = Schema.Struct({
  email: Schema.NonEmptyString.pipe(
    Schema.check(Schema.isPattern(authEmailPattern))
  ),
  emailVerified: Schema.Boolean,
  id: AuthUserId,
  name: Schema.NonEmptyString,
  role: AuthRole,
});
export type AuthIdentity = typeof AuthIdentity.Type;

/** Authenticated session shape exposed by the Effect auth boundary. */
export const AuthSession = Schema.Struct({
  expiresAt: Schema.Date,
  id: AuthSessionId,
  identity: AuthIdentity,
  issuedAt: Schema.Date,
  permissionKeys: Schema.Array(AuthPermissionKey),
});
export type EffectAuthSession = typeof AuthSession.Type;

export const createAuthPermissionKey = ({
  action,
  resource,
  scope,
}: typeof AuthPermission.Type): AuthPermissionKey =>
  AuthPermissionKey.make(
    scope === undefined
      ? `${resource}:${action}`
      : `${resource}:${action}:${scope}`
  );

export const AuthUnauthenticatedReason = Schema.Literals([
  "missing-session",
  "invalid-session",
  "missing-identity",
]);
export type AuthUnauthenticatedReason = typeof AuthUnauthenticatedReason.Type;

/** Expected auth failure when a request cannot resolve an authenticated actor. */
export class AuthUnauthenticated extends Schema.TaggedErrorClass<AuthUnauthenticated>()(
  "AuthUnauthenticated",
  {
    reason: AuthUnauthenticatedReason,
  }
) {}

/** Expected auth failure when a resolved session is past its accepted lifetime. */
export class AuthSessionExpired extends Schema.TaggedErrorClass<AuthSessionExpired>()(
  "AuthSessionExpired",
  {
    expiredAt: Schema.Date,
    sessionId: AuthSessionId,
  }
) {}

export const AuthPermissionDeniedReason = Schema.Literals([
  "missing-permission",
  "unsupported-permission",
]);
export type AuthPermissionDeniedReason = typeof AuthPermissionDeniedReason.Type;

/** Expected auth failure when an actor lacks a required commerce permission. */
export class AuthPermissionDenied extends Schema.TaggedErrorClass<AuthPermissionDenied>()(
  "AuthPermissionDenied",
  {
    permission: AuthPermissionKey,
    reason: AuthPermissionDeniedReason,
  }
) {}

export const AuthAdapterFailureReason = Schema.Literals([
  "provider-rejected",
  "invalid-response",
]);
export type AuthAdapterFailureReason = typeof AuthAdapterFailureReason.Type;

/** Expected auth failure when a private provider adapter cannot satisfy auth. */
export class AuthAdapterFailure extends Schema.TaggedErrorClass<AuthAdapterFailure>()(
  "AuthAdapterFailure",
  {
    adapter: Schema.NonEmptyString,
    operation: Schema.NonEmptyString,
    reason: Schema.optional(AuthAdapterFailureReason),
  }
) {}

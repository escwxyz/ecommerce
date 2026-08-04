export {
  assertPermission,
  createAuthorizationEvaluator,
  evaluatePermission,
  getSessionPermissionKeys,
  hasPermission,
  resolveAuthActor,
} from "./authorization";
export type {
  AuthActor,
  AuthActorKind,
  AuthPermissionInput,
  AuthorizationDecision,
  AuthorizationDenialReason,
  CreateAuthorizationEvaluatorOptions,
} from "./authorization";
export {
  commerceAccessControl,
  commerceAccessControlStatement,
  commerceAuthRoles,
  customerRole,
  storeAdminRole,
  createCommerceAuthAccessControl,
} from "./access-control";
export {
  assertSupportedPermission,
  createPermissionKey,
  emptyPermissionStatement,
  isSupportedPermissionKey,
  normalizePermission,
  normalizePermissionKey,
} from "./permissions";
export type {
  AuthPermission,
  AuthPermissionKey,
  AuthPermissionStatement,
} from "./permissions";

export {
  AuthAdapterFailure,
  AuthAdapterFailureReason,
  AuthIdentity,
  AuthPermission as AuthPermissionSchema,
  AuthPermissionAction,
  AuthPermissionDenied,
  AuthPermissionDeniedReason,
  AuthPermissionKey as AuthPermissionKeySchema,
  AuthPermissionResource,
  AuthPermissionScope,
  AuthRole,
  AuthSession as EffectAuthSessionSchema,
  AuthSessionExpired,
  AuthSessionId,
  AuthUnauthenticated,
  AuthUnauthenticatedReason,
  AuthUserId,
  createAuthPermissionKey,
} from "./auth-contracts";
export type {
  AuthAdapterFailureReason as EffectAuthAdapterFailureReason,
  AuthIdentity as EffectAuthIdentity,
  EffectAuthSession,
  AuthPermissionDeniedReason as EffectAuthPermissionDeniedReason,
  AuthRole as EffectAuthRole,
  AuthSessionId as EffectAuthSessionId,
  AuthUnauthenticatedReason as EffectAuthUnauthenticatedReason,
  AuthUserId as EffectAuthUserId,
} from "./auth-contracts";
export {
  CurrentAuthRequestContext,
  EffectAuthService as EffectAuthServiceTag,
  authRequestContextLayer,
  effectAuthServiceLayer,
  getCurrentAuthRequestContext,
  makeAnonymousAuthRequestContext,
  makeAuthenticatedAuthRequestContext,
} from "./effect-auth-service";
export type {
  AuthRequestContext,
  AuthRequestFailure,
  AuthRequestInput,
  AuthServiceFailure,
  EffectAuthService as EffectAuthServiceShape,
} from "./effect-auth-service";

export type { AuthService, CreateAuthOptions } from "./factory";
export { createAuth } from "./factory";

export type { AuthSession, AuthUser } from "./types";

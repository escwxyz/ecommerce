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

export type { AuthService, CreateAuthOptions } from "./factory";
export { createAuth } from "./factory";

export type { AuthSession, AuthUser } from "./types";

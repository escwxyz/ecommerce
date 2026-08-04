import { Context, Effect, Layer } from "effect";
import type { Effect as EffectValue } from "effect/Effect";

import type {
  AuthAdapterFailure,
  AuthIdentity,
  AuthPermissionDenied,
  AuthPermissionKey,
  AuthSessionExpired,
  AuthUnauthenticated,
  EffectAuthSession,
} from "./auth-contracts";

export interface AuthRequestInput {
  readonly headers: Headers;
}

export type AuthServiceFailure =
  | AuthAdapterFailure
  | AuthPermissionDenied
  | AuthSessionExpired
  | AuthUnauthenticated;

export type AuthRequestFailure =
  | AuthAdapterFailure
  | AuthSessionExpired
  | AuthUnauthenticated;

export interface AuthRequestContext {
  readonly identity?: AuthIdentity;
  readonly isAuthenticated: boolean;
  readonly permissionKeys: readonly AuthPermissionKey[];
  readonly session: EffectAuthSession | null;
}

/**
 * Effect-native auth service contract used by modules, APIs, workflows, and
 * platform adapters. Concrete providers such as Better Auth are private Layers
 * that translate into this contract.
 */
export interface EffectAuthService {
  readonly getRequestContext: (
    input: AuthRequestInput
  ) => EffectValue<AuthRequestContext, AuthAdapterFailure | AuthSessionExpired>;
  readonly requireAuthenticated: (
    input: AuthRequestInput
  ) => EffectValue<AuthRequestContext, AuthRequestFailure>;
  readonly requirePermission: (input: {
    readonly headers: Headers;
    readonly permission: AuthPermissionKey;
  }) => EffectValue<AuthRequestContext, AuthServiceFailure>;
}

/** Request-scoped auth context made available after authentication middleware. */
export const CurrentAuthRequestContext = Context.Service<AuthRequestContext>(
  "@ecommerce/auth/CurrentAuthRequestContext"
);

/** Provider-independent Effect auth service tag. */
export const EffectAuthService = Context.Service<EffectAuthService>(
  "@ecommerce/auth/EffectAuthService"
);

export const makeAnonymousAuthRequestContext = (): AuthRequestContext => ({
  isAuthenticated: false,
  permissionKeys: [],
  session: null,
});

export const makeAuthenticatedAuthRequestContext = (
  session: EffectAuthSession
): AuthRequestContext => ({
  identity: session.identity,
  isAuthenticated: true,
  permissionKeys: session.permissionKeys,
  session,
});

/** Creates a request-scoped Layer for already-resolved auth context. */
export const authRequestContextLayer = (context: AuthRequestContext) =>
  Layer.succeed(CurrentAuthRequestContext, context);

/** Creates a Layer for an Effect-native auth service implementation. */
export const effectAuthServiceLayer = (service: EffectAuthService) =>
  Layer.succeed(EffectAuthService, service);

/** Reads the current request auth context inside an Effect program. */
export const getCurrentAuthRequestContext = CurrentAuthRequestContext.use(
  (context) => Effect.succeed(context)
);

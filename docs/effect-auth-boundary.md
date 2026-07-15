# Effect Auth Boundary

The target auth architecture is an Effect-native service boundary with Better
Auth retained as a private adapter. Modules, Effect HTTP handlers, workflows,
plugins, and SDK-facing contracts must depend on the schemas and errors in
`@ecommerce/auth/auth-contracts`, not on Better Auth inferred types.

## Task 5.1 contract baseline

`packages/auth/src/auth-contracts.ts` owns the first Effect Schema auth
contracts:

- branded `AuthUserId`, `AuthSessionId`, and `AuthPermissionKey` values;
- `AuthRole` as the portable role vocabulary exposed outside the adapter;
- structured `AuthPermission` segments plus `createAuthPermissionKey`;
- `AuthIdentity` and `AuthSession` as the Effect auth boundary data model;
- schema-backed tagged errors for unauthenticated requests, expired sessions,
  permission denial, and private adapter failure.

The existing Better Auth factory remains available during migration, but its
`$Infer` types and provider-specific errors must not cross the new Effect auth
boundary. Future tasks wire the service and adapter Layers on top of these
contracts.

## Task 5.2 service baseline

`packages/auth/src/effect-auth-service.ts` defines the provider-independent
Effect service and request context:

- `EffectAuthService` is the permanent service contract shape for auth
  providers. Better Auth, another provider, or a deterministic test
  implementation must translate into this shape.
- `CurrentAuthRequestContext` is the request-scoped context provided after auth
  middleware resolves the current actor.
- `authRequestContextLayer` and `effectAuthServiceLayer` make both surfaces
  replaceable in tests and runtime composition.
- `makeAnonymousAuthRequestContext` and
  `makeAuthenticatedAuthRequestContext` provide deterministic constructors for
  future middleware, module, and adapter tests.

The root package currently exports the new service tag as
`EffectAuthServiceTag` and the service shape as `EffectAuthServiceShape` to
avoid colliding with the temporary Better Auth factory type named
`AuthService`. Later cleanup tasks can remove or rename the legacy type after
the adapter is the only auth entrypoint.

## Task 5.3 private Better Auth adapter baseline

`packages/auth/src/better-auth-effect-adapter.ts` wraps the existing Better
Auth `api.getSession({ headers })` behavior behind an Effect `Layer`:

- the adapter accepts only a structural Better Auth-compatible service shape,
  keeping Better Auth concrete types private to the adapter implementation;
- `betterAuthEffectAuthLayer` provides the provider-independent
  `EffectAuthService` tag for runtime composition;
- `makeBetterAuthEffectAuthService` is available for deterministic adapter
  tests without exposing Better Auth as the public auth boundary;
- `packages/auth/src/auth-adapter-utils.ts` owns reusable provider-boundary
  helpers for unknown-record access, scalar field reads, permission-key
  decoding, and simple provider-role normalization;
- anonymous Better Auth sessions become anonymous request contexts, successful
  sessions decode into `AuthSession`, and rejected provider calls become
  `AuthAdapterFailure`;
- permission checks run through the same `EffectAuthService` contract, so
  callers depend on `AuthPermissionKey` and tagged Effect failures rather than
  provider-specific role or permission objects.

The adapter is intentionally not exported from the package root. Server/runtime
composition can import it by path while the public package surface continues to
prefer `auth-contracts` and `effect-auth-service`.

## Task 5.4 translation baseline

Better Auth request, result, and failure translation stays inside
`packages/auth/src/better-auth-effect-adapter.ts`:

- inbound `Headers` are cloned before calling `auth.api.getSession`, so the
  provider receives a Better Auth-compatible request without retaining mutable
  request objects owned by callers;
- provider session responses are decoded from `unknown` into the Effect
  `AuthSession` schema before any authenticated context is constructed;
- malformed provider responses fail as `AuthAdapterFailure` with
  `reason: "invalid-response"`;
- rejected provider calls fail as `AuthAdapterFailure` with
  `reason: "provider-rejected"`;
- expired but otherwise valid provider sessions fail as `AuthSessionExpired`;
- adapter failure reasons are owned by `auth-contracts`, not by Better Auth
  error classes or response shapes.

This keeps Better Auth result and error details private while still exposing
typed recovery semantics to middleware, modules, and future providers.

## Task 5.5 Effect HTTP integration baseline

Effect HTTP protected routes now consume the provider-independent auth boundary
instead of legacy auth or Better Auth types:

- `packages/api/src/effect-http-middleware.ts` bridges
  `EffectAuthServiceTag` into `EffectHttpAuthService`, so HTTP auth middleware
  authenticates with `{ headers }` and installs `CurrentEffectHttpAuthContext`.
- `EffectHttpPermissionService` checks decoded `AuthPermissionKey` values from
  the resolved auth request context. Handlers call `withEffectHttpPermission`
  and do not re-read Better Auth provider state.
- `apps/server/src/effect-http-worker-runtime.ts` composes the private Better
  Auth adapter Layer only at Worker runtime assembly. If no auth provider is
  supplied, the runtime uses a fail-closed anonymous auth Layer for protected
  groups.
- Protected API groups remain ordinary `HttpApiGroup` contributions that attach
  request-context and auth middleware to the group contract.
- `packages/auth/package.json` exposes the private
  `@ecommerce/auth/better-auth-effect-adapter` subpath for runtime composition
  without adding Better Auth adapter exports to the public package root.

The covered runtime path is: Cloudflare Worker request → Effect request context
middleware → Effect auth middleware → Better Auth adapter → provider-neutral
auth context → permission guard → protected handler.

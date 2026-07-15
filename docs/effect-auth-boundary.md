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

## Task 5.6 temporary auth persistence seam

Better Auth persistence remains a temporary provider-owned seam while commerce
modules migrate away from Kysely:

- `packages/auth/src/factory.ts` continues to own the Better Auth server
  factory and persistence configuration.
- `packages/db-d1/src/migrations/sql/0000_auth.sql` remains the generated
  Better Auth D1 table baseline. Regenerate it only through
  `bun run --cwd packages/auth auth:gen` after Better Auth configuration
  changes.
- `apps/server/src/effect-http-worker-runtime.ts` may keep passing
  `database.authDatabase` to the Better Auth factory for Cloudflare-first
  runtime composition.
- Business modules must not import Better Auth database tables, Better Auth
  inferred types, D1 auth bindings, or Kysely auth types. They should use
  `EffectAuthServiceTag`, `AuthUserId`, `AuthSession`, and
  `AuthPermissionKey` from the Effect auth boundary instead.
- Module persistence may store auth references such as `AuthUserId`, but auth
  session, account, verification, and provider tables stay outside module
  repositories.
- Do not migrate Better Auth-owned tables to the Effect SQL/Drizzle commerce
  schema during module migration tasks. That belongs to a follow-up auth
  provider decision.

This seam is intentionally narrow: Better Auth may own its private storage, but
it may not become a shared persistence abstraction for commerce modules.

Deletion criteria:

1. the follow-up auth-provider research change chooses direct wrapping,
   `effectify`, official support, or a replacement provider path;
2. Cloudflare Worker tests cover session cookie reads, rejected/expired
   sessions, permission checks, and sanitized adapter failures for the chosen
   path;
3. the selected path provides an Effect boundary equivalent to
   `EffectAuthServiceTag`;
4. the legacy Better Auth D1/Kysely migration seam and `auth:gen` workflow are
   removed or explicitly retained as provider-private infrastructure.

## Better Auth organization plugin and commerce tenancy

The Better Auth organization plugin is a useful candidate for multi-tenant
identity, but it must remain behind the auth boundary:

- Organization, member, invitation, team, active organization, active team, and
  organization-role persistence are auth-provider-owned records.
- Commerce modules may receive a decoded active organization or organization
  membership through `EffectAuthServiceTag` or a future provider-neutral
  `CommerceActorContext`.
- Commerce modules must not import Better Auth organization plugin schemas,
  tables, generated migrations, client types, or server API types.
- A Better Auth organization can be linked to a commerce merchant, vendor,
  business account, market operator, or platform admin context, but it is not
  itself a `Store`.
- A commerce `Store` remains a domain record for store settings and defaults.
  Future marketplace or multi-store behavior should link stores to merchants,
  vendors, markets, or organizations through module-owned references.

This preserves two extension paths:

1. normal single-store or multi-store commerce, where one authenticated
   organization can manage one or more commerce stores;
2. marketplace commerce, where a marketplace module or plugin links vendors,
   products, orders, stores, workflows, settlement policies, and admin/vendor
   surfaces without coupling domain records to Better Auth internals.

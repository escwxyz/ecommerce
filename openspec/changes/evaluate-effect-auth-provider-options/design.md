## Context

The active Effect 4 migration has introduced a provider-neutral auth boundary:

- `packages/auth/src/auth-contracts.ts` owns Effect Schema identity, session,
  permission, and auth error contracts.
- `packages/auth/src/effect-auth-service.ts` owns `EffectAuthServiceTag`.
- `packages/auth/src/better-auth-effect-adapter.ts` privately adapts Better
  Auth-compatible `api.getSession({ headers })` behavior into Effect.
- `apps/server/src/effect-http-worker-runtime.ts` composes the private adapter
  at the Cloudflare Worker boundary.
- Better Auth persistence remains provider-private through the existing auth
  factory and generated D1 migration while commerce modules move to
  Effect SQL / Drizzle PostgreSQL.

The current adapter is deliberately narrow. It proves the boundary, not the
long-term provider strategy.

## Goals / Non-Goals

**Goals:**

- Compare direct Better Auth wrapping, `@effectify/node-better-auth`, and
  future official Better Auth / Effect support against the same criteria.
- Decide whether the project should retain, replace, or delete the current
  private Better Auth adapter.
- Decide what happens to Better Auth-owned persistence after Kysely removal.
- Require Cloudflare Worker compatibility as the first deployment target.
- Preserve the provider-neutral `EffectAuthServiceTag` boundary for modules,
  APIs, workflows, and plugins.

**Non-Goals:**

- Reimplement Better Auth.
- Add new auth providers before the evaluation is complete.
- Change the current login/session behavior during research.
- Move Better Auth tables into commerce module repositories.
- Broaden the public API surface to expose provider-specific Better Auth types.

## Evaluation candidates

### Candidate A: Direct Better Auth wrapping

Continue wrapping Better Auth directly behind `EffectAuthServiceTag`.

Required evidence:

- Better Auth’s current session API can be called in Cloudflare Workers using
  standard `Headers` / `Request` data without Node-only APIs.
- Provider responses can be decoded into `AuthSession` without leaking Better
  Auth inferred types across package boundaries.
- Provider failures can be mapped to schema-backed auth errors without exposing
  secrets, database details, or provider internals.
- Persistence remains explicitly provider-private, or a replacement persistence
  path is documented.

### Candidate B: `@effectify/node-better-auth`

Evaluate the community `effectify` Better Auth integration.

Current research notes:

- The package is published as `@effectify/node-better-auth` and describes a
  Node.js integration for Better Auth and Effect.
- Its documented basic usage wraps a Better Auth handler for
  `@effect/platform-node` / Node HTTP server execution.
- Its implementation converts Effect HTTP requests to Node
  `IncomingMessage` / `ServerResponse` shapes and therefore appears Node-first
  rather than Cloudflare Worker-first.

Required evidence:

- The current package version supports Effect 4 beta used by this repository.
- The package can run in Cloudflare Workers without Node HTTP shims, or the
  required shim cost and compatibility risk are acceptable.
- Its service/handler model can be kept behind `EffectAuthServiceTag` without
  exposing Better Auth provider types to modules or API contracts.
- It handles errors and cookies without weakening the current sanitized-error
  and session-cookie tests.

### Candidate C: Future official support

Monitor Better Auth and Effect ecosystem support for official or maintained
provider integration.

Required evidence:

- The support is available in released packages compatible with the repository’s
  Effect 4 beta cohort or a documented upgrade path.
- It supports Cloudflare Workers as a first-class runtime, not only Node.js.
- It has clear persistence and migration semantics for existing Better Auth
  data.
- It can be wrapped behind or directly provide the same provider-neutral Effect
  service contract.

## Decision criteria

The selected path must satisfy all hard criteria:

1. Cloudflare Worker compatibility without requiring Node HTTP runtime APIs.
2. Provider-neutral public boundary through `EffectAuthServiceTag` and Effect
   Schema auth contracts.
3. Sanitized failures for unauthenticated, expired-session, permission-denied,
   and provider-rejected cases.
4. Explicit session-cookie behavior for browser HTTP and Service Binding paths.
5. Explicit persistence ownership and migration/deletion plan for Better
   Auth-owned tables.
6. No dependency from commerce modules to Better Auth runtime, Better Auth
   inferred types, D1 auth tables, or Kysely auth types.

Soft criteria:

- minimum custom adapter code;
- maintained upstream package;
- low runtime overhead on Cloudflare;
- easy deterministic test Layer construction;
- compatibility with future providers.

## Decision record format

The research change should conclude by updating this design with:

- selected candidate;
- rejected candidates and concrete reasons;
- persistence decision;
- migration/deletion tasks for the temporary auth seam;
- verification evidence and gaps;
- follow-up implementation change name if implementation is deferred.

## Risks / Trade-offs

- [Risk] `effectify` may look attractive but remain Node-only.
  -> [Mitigation] Require a Cloudflare Worker spike before adoption.
- [Risk] Direct wrapping can accumulate custom glue.
  -> [Mitigation] Keep the wrapper limited to `EffectAuthServiceTag` and shared
  adapter utilities.
- [Risk] Waiting for official support can freeze the temporary D1 auth seam.
  -> [Mitigation] Define a time-boxed re-evaluation and keep module code
  independent of provider persistence.
- [Risk] Provider persistence decisions can collide with the PostgreSQL-first
  commerce storage plan.
  -> [Mitigation] Treat auth persistence as provider-private until a documented
  auth storage change supersedes it.

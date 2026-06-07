## Context

The repository has already bootstrapped the core runtime kernel and Cloudflare deployment baseline. The current auth implementation is functional, but the boundary is still too coupled to runtime wiring:

- `packages/auth` currently constructs the Better Auth instance directly and reads environment/runtime dependencies itself.
- `apps/server` mounts the auth handler and also depends on the auth factory.
- `packages/api` constructs auth again inside request context creation instead of consuming a shared instance or shared auth contract.
- `apps/web` relies on the auth client and session shape, but the shared auth contract is not yet codified as the single source of truth for downstream consumers.

The blueprint and roadmap both require `packages/auth` to become the shared auth contract boundary for session, user, permission, and auth service types, while `apps/server` remains responsible only for HTTP mounting and runtime provisioning.

This change is the first auth-boundary implementation slice. It does not introduce new auth providers or new product permissions. Its job is to move the runtime seam to the server and make the shared auth surface explicit enough for modules, API composition, and future plugin policies.

## Goals / Non-Goals

**Goals:**

- Make `packages/auth` the shared source of truth for auth/session/user/permission contracts and auth service interfaces.
- Keep runtime-specific provisioning in `apps/server`, where env, database access, and HTTP mounting already live.
- Remove local auth construction from `packages/api` so request context consumes a shared auth instance instead of rebuilding it.
- Define the first permission model for the platform so later modules and admin surfaces can depend on a stable vocabulary.
- Preserve the current login/session behavior while tightening the package boundary.

**Non-Goals:**

- Add new authentication providers, social login, or MFA.
- Introduce a complete roles and policy engine.
- Rework Better Auth itself or swap auth libraries.
- Implement module-specific authorization rules beyond the shared permission vocabulary.
- Move auth client logic in `apps/web` unless the shared contract needs a narrow type export for consistency.

## Decisions

1. Keep `packages/auth` as the shared contract and factory package, but make it runtime-parameterized instead of runtime-owned.

   `packages/auth` should export the reusable auth types, permission vocabulary, and a factory that accepts runtime dependencies such as database access, secret, base URL, and trusted origins. That lets the package remain the source of truth for auth shape without owning environment reads or server composition.

   Alternative considered: keep `packages/auth` as the place that reads env and creates its own database client. Rejected because that keeps runtime provisioning inside the shared boundary and forces other packages to depend on hidden server-like behavior.

2. Let `apps/server` own auth instantiation and HTTP mounting.

   The Worker entrypoint should gather runtime bindings, create the auth instance once, mount the Better Auth handler, and provide the same auth instance to any server-side context builders that need it.

   Alternative considered: leave auth instantiation in `packages/auth` and have the server call a no-argument factory. Rejected because that still hides runtime wiring inside the shared package and makes the server less explicit about its composition role.

3. Inject auth into `packages/api` context creation instead of reconstructing it per request.

   The API package should accept the auth instance or an auth accessor as an input to context construction. That keeps the API layer transport-focused and avoids coupling request handling to database/client bootstrap logic.

   Alternative considered: have `packages/api` continue calling `createAuth()` directly. Rejected because it duplicates construction logic and mixes API composition with runtime provisioning.

4. Use resource/action permission strings as the first permission model.

   The first shared permission vocabulary should be stable, compact, and easy for modules and admin UI to extend. Resource/action strings such as `product:read` or `order:create` are a better fit than role-only authorization because they map cleanly to module surfaces, admin operations, and future plugin capabilities.

   Alternative considered: role-only authorization. Rejected because roles alone are too coarse for module-level policies and do not compose well across future admin and plugin surfaces.

5. Keep auth-session typing shared, but defer policy enforcement mechanics.

   The boundary should define the reusable session and permission types now, while leaving enforcement strategy to the future module and admin authorization slices.

   Alternative considered: fully implement a policy engine in this slice. Rejected because it expands scope beyond the boundary refactor and would force premature decisions on module-specific access control.

6. Verify the boundary with package-level tests and import checks.

   This change should add coverage that proves the shared auth package remains the source of truth and that server/API packages do not leak runtime construction back into shared code.

   Alternative considered: rely on code review alone. Rejected because this boundary is architectural and should fail loudly in CI when it regresses.

## Risks / Trade-offs

- [Risk] Runtime parameterization can make auth setup look more verbose
  -> [Mitigation] Keep the shared factory narrow and provide a single server composition helper so call sites stay simple.
- [Risk] Permission strings may underspecify future policy needs
  -> [Mitigation] Define a consistent namespace convention now and allow later policy layers to interpret the same strings without changing the contract.
- [Risk] API context injection can ripple through tests and route helpers
  -> [Mitigation] Thread the auth instance through a small number of context construction points and preserve current request behavior with targeted tests.
- [Risk] Shared types could drift if exported informally
  -> [Mitigation] Make the public exports explicit and cover them with import-boundary and type-level checks.

## Migration Plan

1. Add explicit auth/session/user/permission types and a runtime-parameterized auth factory in `packages/auth`.
2. Update `apps/server` to instantiate auth from runtime inputs and mount the Better Auth handler from that instance.
3. Update `packages/api` context creation to accept the shared auth instance rather than constructing auth internally.
4. Add tests or import checks that confirm:
   - `packages/auth` remains the shared contract source
   - `apps/server` owns runtime auth provisioning
   - `packages/api` does not import server-only composition code
5. Verify affected packages with targeted typecheck and test runs.
6. If later work expands permissions beyond resource/action strings, add a new auth-policy change rather than mutating this boundary in place.

Rollback is straightforward because this change only moves the auth seam and adds shared contracts. Reverting the package exports and server wiring restores the prior behavior without data migration.

## Open Questions

- Should the shared auth package export plain data types only, or also a small auth-service interface that wraps `getSession` and permission checks?
- Should the permission vocabulary namespace be `resource:action` only, or allow scoped variants such as `resource:action:scope` from the start?
- Should `apps/web` consume shared session/user types directly, or keep using the Better Auth client types until the admin auth slice lands?

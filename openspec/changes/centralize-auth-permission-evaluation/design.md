## Context

The current auth direction is split across the Cloudflare commerce blueprint, `refactor-shared-auth-boundary`, and `add-basic-auth-admin-model`. Together they establish that `packages/auth` owns shared session, user, and permission contracts while `apps/server` owns runtime Better Auth mounting.

The remaining issue is evaluation locality. `packages/auth/src/permissions.ts` defines a simple resource/action vocabulary, but call sites still parse session shape directly. Product routes and admin metadata composition both read `session.user.permissions` and filter string arrays locally. That pattern will not scale once more modules, plugin admin metadata, and sandbox bridge policy need authorization checks.

Better Auth's admin plugin supports custom permissions through `createAccessControl`, resource/action statements, custom roles, and server/client admin plugin configuration. The docs also note that default admin roles and permissions are overridden when custom roles are supplied unless the default admin statements are explicitly merged. This change uses that Better Auth capability as an implementation adapter, while keeping commerce modules coupled only to shared auth contracts.

## Goals / Non-Goals

**Goals:**

- Make `packages/auth` the only package that understands how to extract and evaluate permissions from authenticated sessions.
- Define a shared authorization service interface that modules, API context, admin metadata, and sandbox bridge policy can consume.
- Keep the first model simple: authenticated customers, admin-capable store administrators, and resource/action permission checks.
- Represent commerce permission vocabulary through Better Auth custom access-control statements and roles without forcing modules to import Better Auth internals.
- Provide test helpers that construct actors and authorization contexts without recreating production session internals at call sites.

**Non-Goals:**

- Build a complete policy engine, ABAC system, or multi-store scoped authorization model.
- Add new auth providers, login flows, MFA, organizations, teams, or customer account enrichment.
- Let modules or plugins define Better Auth roles directly.
- Make sandboxed plugins receive raw Better Auth sessions, database handles, or privileged admin APIs.
- Finalize all future commerce permissions before the relevant modules exist.

## Decisions

1. Introduce a shared authorization evaluator contract in `packages/auth`.

   `packages/auth` should export a small evaluator interface such as `resolveAuthActor`, `getActorPermissionKeys`, `hasPermission`, and `assertPermission` or equivalent service methods. The exact names can follow the local code style, but the boundary must make permission evaluation a shared capability rather than a helper copy.

   Alternative considered: keep string extraction helpers in each module. Rejected because each call site would need to track Better Auth session shape, admin role behavior, future custom roles, and plugin policy nuances independently.

2. Keep permission descriptors resource/action first.

   The existing `AuthPermission` and admin metadata permission descriptors already map well to Better Auth custom access-control statements, where resources map to statement keys and actions map to allowed operations. Scoped variants can remain a future extension.

   Alternative considered: model permissions as opaque strings only. Rejected because Better Auth custom permissions and admin metadata both benefit from a structured resource/action form for statement generation and test assertions.

3. Treat Better Auth custom access control as an adapter behind shared auth exports.

   The shared auth package should define the commerce permission statement and role construction used by the Better Auth admin plugin. Runtime factories can pass the access controller and roles to the server plugin, and the admin client can receive the matching client plugin configuration when needed. Modules should never import `better-auth/plugins/access` or `better-auth/plugins/admin/access` directly.

   Alternative considered: ask each module to contribute Better Auth statement fragments directly. Rejected for this first slice because Better Auth role composition has override semantics, and distributed role mutation would make startup behavior order-dependent.

4. Centralize actor resolution before authorization checks.

   The evaluator should classify a request as anonymous, customer, or store administrator according to the baseline admin model, then apply permission checks from that actor context. A missing user remains authentication failure; an authenticated user without the required permission remains authorization failure.

   Alternative considered: check permissions without actor classification. Rejected because module routes, admin surfaces, and future customer account APIs need distinct authentication versus authorization outcomes.

5. Reuse the same evaluator for admin metadata filtering and backend enforcement.

   Admin metadata discovery can use the evaluator to decide which surfaces are visible, but backend route handlers must still enforce the same permission requirements independently. Visibility filtering is a UX optimization, not a security boundary.

   Alternative considered: let frontend metadata filtering decide access. Rejected because clients can call APIs directly and sandbox policy also needs server-side authorization.

6. Keep plugin and sandbox policy integration read-only in this slice.

   The evaluator should expose enough shape for plugin manifests and sandbox bridge policy to ask whether an actor has a required permission. It should not grant sandboxed plugins direct session mutation, role management, or raw Better Auth admin operations.

   Alternative considered: expose Better Auth `userHasPermission` directly to plugins. Rejected because sandboxed plugins must go through host bridge policy with capability checks and auditability.

## Risks / Trade-offs

- [Risk] The evaluator can become a policy engine too early -> Mitigation: keep inputs to actor, permission descriptor, and optional reason metadata; defer scopes and policy conditions.
- [Risk] Better Auth custom role override semantics can accidentally remove default admin user/session powers -> Mitigation: explicitly merge default admin statements when extending default roles and cover this with tests.
- [Risk] Admin metadata filtering and backend route checks can drift -> Mitigation: both surfaces must consume shared permission descriptors and evaluator helpers, with tests covering the same fixture actors.
- [Risk] Future modules may need permissions not declared in the central statement -> Mitigation: add a typed registration or static vocabulary extension point in `packages/auth` only after more modules require it; do not let modules bypass the evaluator.
- [Risk] Test fixtures may continue using raw session permission arrays -> Mitigation: expose auth test helpers that create actor contexts through the shared contract.

## Migration Plan

1. Add shared permission descriptor normalization and authorization evaluator APIs to `packages/auth`.
2. Define the Better Auth custom access-control statement and baseline roles in `packages/auth`, preserving default admin user/session permissions where required.
3. Thread the evaluator through API context construction or module route context so route fragments can authorize without parsing raw session data.
4. Replace product route and admin metadata local permission extraction with shared auth helpers.
5. Add tests for actor classification, permission extraction, allowed/forbidden module operations, admin metadata filtering, and Better Auth custom-role composition.
6. Rollback by restoring the previous call-site helpers and default admin plugin setup; no data migration is expected beyond the admin plugin schema already owned by `add-basic-auth-admin-model`.

## Open Questions

- Should the first evaluator return booleans only, or a typed authorization decision with denial reason for audit logging and sandbox policy?
- Should custom role definitions be static in `packages/auth` for now, or should this change introduce a narrow module permission registration contract?
- Should `AuthPermissionKey` remain exactly `resource:action`, or should this slice reserve a `resource:action:scope` parser without enabling scoped checks?

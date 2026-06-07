## Context

`centralize-auth-permission-evaluation` moved permission evaluation behind `packages/auth`, wired the Better Auth admin plugin, and replaced call-site permission parsing. That improved locality for evaluation, but it left the permission vocabulary itself in a shallow shape:

- `packages/auth/src/permissions.ts` hardcodes `product:read` and `product:write`.
- `packages/modules/product/src/admin/product-admin-surfaces.ts` independently declares the same product permission descriptors for admin metadata.
- Product routes receive a structural evaluator from API context to avoid a product -> auth dependency cycle.
- Better Auth custom access control still needs a complete statement object and roles at auth construction time.

The desired architecture is:

```text
modules declare permission descriptors -> composition layer collects descriptors -> auth builder receives composed statement/roles
```

This keeps the auth module deep for evaluation and adapter construction while preventing auth from importing commerce modules. It also lets module/plugin permission vocabulary grow without duplicating declarations or reintroducing dependency cycles.

The architecture review report for this decision was written to `/private/var/folders/bh/4z9jyg6d1bvgvjb4pp49gpdc0000gn/T/architecture-review-20260605153443.html`.

## Goals / Non-Goals

**Goals:**

- Add a module-owned permission descriptor contribution that can be collected during platform composition.
- Build Better Auth custom access-control statements and roles from composed permission descriptors plus Better Auth admin defaults.
- Remove hardcoded product commerce permissions from `packages/auth`.
- Keep dependency direction acyclic: modules can depend on core descriptor types; auth cannot depend on modules; API/server composition can bridge them.
- Make duplicate, malformed, or unsupported permission descriptors fail during composition before runtime request handling.
- Clarify that `add-basic-auth-admin-model` is mostly superseded by current implementation, with only schema/migration verification left if not already handled elsewhere.

**Non-Goals:**

- Add store-scoped, tenant-scoped, or condition-based authorization.
- Add a full policy engine or ABAC model.
- Make modules own Better Auth roles directly.
- Allow sandboxed plugins to mutate the host permission statement at request time.
- Implement customer account permissions beyond the baseline customer actor model.

## Decisions

1. Put permission descriptor types in `packages/core`.

   Module declarations already live in core, and modules already depend on core for admin metadata and module contribution types. Adding a `CommercePermissionDescriptor` or equivalent core type keeps module declarations independent from `packages/auth`.

   Alternative considered: put descriptor types in `packages/auth`. Rejected because module packages would need an auth dependency, recreating the cycle pressure that this change is meant to remove.

2. Add permissions to module contributions.

   `CommerceModuleContributions` should gain a `permissions` field. Product should declare product permission descriptors there, and admin metadata/route permission references should reuse those descriptors or their keys.

   Alternative considered: infer permissions only by scanning admin metadata. Rejected because route-only or workflow-only permissions may exist without admin surfaces, and inference would make the interface implicit.

3. Compose permission descriptors outside auth.

   A composition module should collect module and plugin permission descriptors, normalize resource/action keys, deduplicate ownership, and produce a composed permission statement. This module can live in `packages/core` if it is pure descriptor composition, or `packages/api` if it needs route/module assembly context. It must not import Better Auth.

   Alternative considered: let `packages/auth` import installed modules and build the statement directly. Rejected because that makes auth depend on commerce modules and creates circular package dependencies as modules grow.

4. Keep Better Auth adapter construction in auth.

   `packages/auth` should receive a composed commerce statement and produce the Better Auth `ac`/roles adapter by merging Better Auth `defaultStatements` into the statement and `adminAc.statements` into admin roles. Customer/user roles must remain empty unless descriptors explicitly grant customer permissions in a later accepted change.

   Alternative considered: have the composition layer call Better Auth `createAccessControl` directly. Rejected because Better Auth adapter details should remain local to auth and should not leak into core or module packages.

5. Treat plugin permissions as host-validated contributions.

   Native plugins may contribute permission descriptors through plugin/module contribution contracts. Sandboxed plugin manifests may declare permission requirements, but host composition must validate those requirements against composed descriptors before exposing admin surfaces or bridge actions.

   Alternative considered: let sandboxed plugins add new permission resources dynamically. Rejected because the host must know and audit the permission vocabulary before runtime composition.

6. Narrow `add-basic-auth-admin-model` instead of implementing it as written.

   The previous change's tasks for admin plugin wiring, actor classification, shared helpers, product route migration, and tests are already covered by `centralize-auth-permission-evaluation`. The remaining meaningful work is to verify/generate the D1 schema/migration fields required by the Better Auth admin plugin, or close that change as superseded if the schema work is handled elsewhere.

   Alternative considered: implement `add-basic-auth-admin-model` unchanged. Rejected because it would duplicate completed work and preserve stale task state.

## Risks / Trade-offs

- [Risk] Composition can become another shallow pass-through -> Mitigation: make the interface collect, validate, deduplicate, and produce the exact statement shape used by auth tests.
- [Risk] Modules and admin metadata can drift -> Mitigation: product permissions must be declared once by the product module and reused by route/admin declarations.
- [Risk] Plugin permissions can collide with module permissions -> Mitigation: composition must reject duplicate resource/action ownership unless an explicit override contract is accepted later.
- [Risk] Auth tests may no longer cover real module permissions -> Mitigation: add integration tests that compose product permissions and assert Better Auth role statements include product only through the composed input.
- [Risk] D1 admin schema work remains ambiguous -> Mitigation: explicitly audit `add-basic-auth-admin-model` and either narrow it to schema/migration verification or mark it superseded in OpenSpec.

## Migration Plan

1. Add core permission descriptor and module contribution types.
2. Add pure composition helpers that collect descriptors from modules/plugins and emit a composed permission statement.
3. Move product permission descriptors into the product module contribution and reuse them from admin metadata/router code.
4. Refactor auth access-control construction to accept the composed statement while retaining Better Auth default admin resources and admin-only role grants.
5. Update API/server composition to pass module-composed permissions into auth construction or a factory option.
6. Add tests for duplicate descriptors, product composition, auth role construction, and plugin/sandbox validation.
7. Audit `add-basic-auth-admin-model`; mark superseded tasks complete or create a narrower follow-up for D1 admin schema/migration verification.

Rollback is straightforward if kept type-level and factory-level: restore the current hardcoded product statement in auth and remove the composition input. No data migration is introduced by this change.

## Open Questions

- Should descriptor ownership be per resource (`product`) or per resource/action (`product:read`) in the first implementation?
- Should product admin metadata import named permission constants from the product module, or should module declaration export them through a dedicated `permissions` module?
- Should narrowing/superseding `add-basic-auth-admin-model` happen inside this implementation or as a separate OpenSpec archive/sync step?

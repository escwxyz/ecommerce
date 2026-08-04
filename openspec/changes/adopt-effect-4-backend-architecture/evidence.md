# adopt-effect-4-backend-architecture evidence audit

Date: 2026-08-03

## Verification commands

Passed:

- `bun run test`
  - Result: 24/24 Turbo test tasks successful.
  - Coverage: unit, contract, API assembly, SDK transport, workflow, plugin,
    telemetry, module boundary, server Worker, storefront SDK, and
    credential-free Cloudflare smoke tests.
- `bun run build`
  - Result: 2/2 Turbo build tasks successful.
  - Notes: server build still reports expected externalization warnings for
    `cloudflare:workers`; web build still reports existing bundle-size and
    browser-externalization warnings.
- `bun run --cwd packages/core check-types`
- `bun run --cwd packages/db-postgres check-types`
- `bun run --cwd packages/api check-types`
- `bun run --cwd packages/storefront-sdk check-types`
- `bun run --cwd apps/server check-types`
- `bun run --cwd packages/modules/order check-types`
- `bun run --cwd packages/modules/payment check-types`
- `bun run --cwd packages/modules/tax check-types`
- `bun x oxlint packages/core/src/testing/index.ts packages/db-postgres/src/modules/tax/repository.ts packages/modules/order/src/repositories/in-memory-order.repository.ts packages/modules/payment/src/providers/index.ts packages/modules/payment/src/webhooks/index.ts`
- `bun x oxfmt --check packages/core/src/testing/index.ts packages/db-postgres/src/modules/tax/repository.ts packages/modules/order/src/repositories/in-memory-order.repository.ts packages/modules/payment/src/providers/index.ts packages/modules/payment/src/webhooks/index.ts`
- `POSTGRES_URL=postgres://postgres:postgres@127.0.0.1:5432/ecommerce bun run --cwd packages/db-postgres db:status`
  - Result: adapter `effect-postgres`, 14 applied migrations, 0 pending, 0
    failed.
  - Note: requires running outside the sandbox to reach the local
    OrbStack/Docker PostgreSQL port.
- `POSTGRES_URL=postgres://postgres:postgres@127.0.0.1:5432/ecommerce bun run --cwd packages/db-postgres test:live`
  - Result: 5 pass, 0 fail.
  - Coverage: live migration baseline, outbox commit/rollback, duplicate
    constraint surfacing, outbox row decoding, concurrent claim splitting.

Not clean due to pre-existing or untracked workspace surfaces outside this
task:

- `bun run check`
  - Fails only on formatting for `.vscode/settings.json` and untracked
    `apps/web/src/routeTree.gen.ts`.
  - Leaves one warning in `packages/ui/src/components/label.tsx`
    (`jsx-a11y(label-has-associated-control)`).
- `bun run check-types`
  - 26/27 Turbo tasks successful.
  - Fails in untracked `apps/web` on dashboard/oRPC type errors and the web
    TypeScript target seeing `Array.prototype.toSorted` from
    `@ecommerce/core`.

## Requirement coverage

The following requirements are covered by implementation plus the verification
commands above:

- effect-backend-conventions
  - Effect 4 backend foundation
  - Exact Effect dependency governance
  - Boundary-specific Effect Schemas
  - Typed error and defect policy
  - Mandatory Effect telemetry
  - Runtime-neutral test Layers
- effect-sql-persistence
  - Effect PostgreSQL and Drizzle persistence foundation
  - Module repository contracts
  - Local transaction ownership
  - PostgreSQL-first clean schema baseline
- effect-http-api-sdk
  - Canonical Effect HTTP APIs
  - Derived API documentation
  - Storefront SDK dual transport
- shared-auth-boundary
  - Shared auth contracts
  - Server-owned auth provisioning
  - Auth context injection
  - Auth organizations remain provider-neutral
- commerce-platform-architecture
  - Core runtime remains platform independent
  - Server Worker composes runtime only
  - Effect-based service composition
- commerce-data-adapters
  - Database service contract
  - PostgreSQL-first Cloudflare adapter
  - Explicit adapter packages
  - Dialect-aware migrations
- module-api-assembly
  - Shared route fragment contract
  - Deterministic route assembly
  - Server transport stays composition-only
  - Shared root router typing
- api-route-validation-contracts
  - Schema-backed route procedures
  - Validation-aware route fragment contributions
  - Response contracts stay explicit
- commerce-admin-extensibility
  - Admin uses shared API typing
  - Admin composition remains frontend-only
- workflow-event-primitives
  - Workflow definitions declare executable orchestration boundaries
  - Workflow runs support idempotent execution state
  - Workflow lifecycle events use the shared event publisher contract
  - Workflow runtime remains adapter-based with Cloudflare primitives first
- stateful-runtime-primitives
  - Platform-free stateful coordination contracts
  - Durable Object adapter boundary
  - Workflow, Queue, and Durable Object adapter verification
- native-plugin-contracts
  - Native plugin registration contract
  - Native plugin contribution surfaces
  - Native plugin boundary safety
- cloudflare-plugin-sandbox
  - Sandboxed plugin manifest contract
  - Capability-enforcing bridge
  - Sandboxed plugin observability
- effect-migration-governance
  - Verified vertical-slice migration
  - Legacy deletion gate
  - Temporary bridge accountability
  - Store tracer preserves marketplace extensibility

## Completion judgment

The backend architecture migration is implemented and verified for the scoped
backend, API, SDK, PostgreSQL, workflow, plugin, server Worker, and
credential-free Cloudflare surfaces.

The repository-wide root `check` and `check-types` commands are not fully clean
because they include dirty/untracked frontend/editor work outside this task.
Those files were not modified during this audit to avoid overwriting unrelated
user work.

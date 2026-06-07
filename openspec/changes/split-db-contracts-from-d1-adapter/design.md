> Superseded storage note: `replace-drizzle-primary-storage-with-kysely` replaces the Drizzle-specific implementation details in this completed change with Kysely-based primary storage. Keep the package boundary decisions, but prefer the newer change for storage implementation.

## Context

The blueprint already defines the long-term database boundary:

- `packages/db` owns shared database contracts and schema coordination.
- `packages/db-d1` owns the Cloudflare D1 adapter, D1-specific Drizzle wiring, and D1 migration/runtime behavior.
- Future adapters such as `packages/db-libsql` or `packages/db-postgres` can be added without changing domain-facing contracts.

The current repo does not match that target yet. `packages/db` still reads `@ecommerce/env/server`, imports `drizzle-orm/d1` directly, and exports `createDb()` as a D1-only entry point. That means the package currently mixes three concerns that need to separate before more modules are added:

1. shared database vocabulary and adapter interfaces
2. Cloudflare runtime binding access
3. D1-specific Drizzle client creation and migration tooling

The core runtime kernel is already in place, so this change can now make database boundaries explicit without inventing a new dependency model. It needs to preserve D1 as the first production adapter while making later adapters, local tests, and server composition possible without importing D1-only code into shared packages.

## Goals / Non-Goals

**Goals:**

- Move the repo toward the blueprint package split by making `packages/db` the shared contract boundary and introducing a dedicated D1 adapter package.
- Define the first shared database service and adapter vocabulary that server composition, modules, and tests can consume without importing `drizzle-orm/d1` or Cloudflare bindings.
- Keep D1 as the first production adapter and preserve the current Drizzle-based schema ownership.
- Make migration ownership explicit so D1-specific schema or SQL differences stay reviewable instead of being hidden behind runtime branching.
- Add verification that proves shared DB code remains adapter-agnostic and that D1 behavior is covered by targeted adapter tests.

**Non-Goals:**

- Add PostgreSQL or libSQL runtime support in this slice.
- Redesign the domain schema beyond what is required to move files and contracts to the correct boundary.
- Replace Drizzle, Cloudflare D1, or the existing Worker composition model.
- Finalize every cross-adapter query abstraction for future commerce modules.
- Implement repository contracts for every future domain module.

## Decisions

1. Keep `packages/db` as the shared database boundary and move D1 runtime code into `packages/db-d1`.

   `packages/db` should own adapter-agnostic types, shared schema exports that do not require a concrete runtime, and any test helpers needed by downstream packages. `packages/db-d1` should own D1 binding access, `drizzle-orm/d1` imports, D1-flavored client creation, and D1 migration configuration.

   Alternative considered: keep everything in `packages/db` and only document the split. Rejected because the current package already leaks D1 imports and env access, and documentation alone will not stop new shared packages from depending on the wrong surface.

2. Make server composition inject database access instead of letting shared packages read runtime env directly.

   The server layer should remain responsible for runtime binding acquisition, then create or provide the D1 adapter explicitly. Shared packages should accept database services or adapter factories as inputs rather than calling `@ecommerce/env/server` themselves.

   Alternative considered: let `packages/db` continue reading env as a convenience. Rejected because it keeps a Cloudflare runtime dependency inside the shared boundary and blocks non-D1 tests or future adapters.

3. Define a minimal shared adapter contract before introducing more repository abstractions.

   This slice should define the smallest contract that unlocks the next steps: a shared database client/service type, adapter factory shape, and schema coordination exports. It does not need to model every repository pattern yet. The contract only needs to be stable enough that server composition and later module changes can depend on it without caring whether the backing adapter is D1 or something else.

   Alternative considered: wait until a future module change to define the contract. Rejected because module work would otherwise pick up the current D1-only API and make the later split more invasive.

4. Keep migration ownership with the concrete adapter package.

   D1 migration config, migration output, and dialect-specific schema handling should move with `packages/db-d1`, while `packages/db` keeps only adapter-agnostic schema coordination artifacts. This preserves the blueprint rule that dialect differences remain explicit and reviewable.

   Alternative considered: centralize all migration config in `packages/db`. Rejected because it would blur the same boundary this change is meant to enforce and make future adapter additions modify D1-owned files.

5. Verify the boundary with package-level tests and import checks.

   The repo already uses targeted boundary tests in other packages. This change should add the same discipline for the DB split: tests that fail if `packages/db` imports `drizzle-orm/d1`, `@ecommerce/env/server`, or Cloudflare runtime-only code, and tests that prove the D1 adapter still constructs a working client from explicit runtime inputs.

   Alternative considered: rely on review discipline alone. Rejected because this is an architectural seam that later changes will touch repeatedly.

6. Record the next-adapter decision as a follow-up, not an implementation obligation in this change.

   The proposal calls out “documenting the next adapter decision,” but this change should only preserve the decision point and the package boundary needed for that comparison. It should not pick between libSQL and PostgreSQL during the D1 split.

   Alternative considered: choose the second adapter now. Rejected because the repo has no current implementation pressure that justifies locking that choice yet.

## Risks / Trade-offs

- [Risk] Moving migrations and entry points can disrupt current scripts
  -> [Mitigation] keep root scripts working by retargeting them to the new D1 package and verify them with targeted smoke checks.
- [Risk] A too-thin contract may require follow-up reshaping once real modules land
  -> [Mitigation] keep the first contract intentionally small and align it to the already-accepted blueprint instead of speculative repository abstractions.
- [Risk] Shared schema coordination can become ambiguous after the split
  -> [Mitigation] document which files remain in `packages/db` versus `packages/db-d1`, and require adapter-specific migration artifacts to live with the adapter.
- [Risk] Existing packages may continue importing `@ecommerce/db` assuming it owns D1 construction
  -> [Mitigation] add explicit export boundaries and targeted tests so consumers migrate to the correct contract or adapter surface.

## Migration Plan

1. Introduce the shared contract surface in `packages/db` and move D1-specific runtime construction into a new `packages/db-d1` package.
2. Move D1 migration configuration and any D1-only schema/runtime artifacts to `packages/db-d1`, leaving only adapter-agnostic schema coordination in `packages/db`.
3. Update server composition and any current DB consumers to obtain database access from the D1 adapter through explicit wiring rather than env reads inside shared code.
4. Add targeted verification for:
   - `packages/db` import boundaries
   - D1 adapter construction from explicit runtime inputs
   - workspace scripts or package exports that still need to resolve DB generation or push commands
5. Leave second-adapter selection as a documented follow-up change once a concrete portability or deployment requirement exists.

Rollback is straightforward because the change only moves boundaries and scripts, not persisted production data. Reverting the new adapter package and restoring `packages/db` as the D1 owner returns the repo to its current structure.

## Open Questions

- Should `packages/db` export a concrete Drizzle database type alias as part of the shared contract, or only higher-level adapter interfaces?
- Which schema artifacts are truly adapter-agnostic enough to stay in `packages/db` versus moving wholesale into `packages/db-d1` for now?
- Should the next adapter comparison be tracked as a dedicated follow-up proposal, or added as an unchecked task in this change for roadmap visibility?

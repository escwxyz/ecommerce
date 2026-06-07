## Context

The repository already contains the first round of platform scaffolding that this change needs to build on: `packages/core` defines module and service contracts, `packages/api` assembles oRPC route fragments, `packages/db` and `packages/db-d1` provide shared schema export and the first Cloudflare adapter, `apps/server` mounts the assembled router, and `apps/web` consumes shared API types through the oRPC client. What is still missing is a real commerce module that proves those seams can carry a domain slice end to end.

The accepted commerce blueprint chose the first module slice as the validation point for module declarations, schema ownership, API composition, admin metadata, and import-boundary enforcement. This change must stay aligned with that blueprint: core and pure module code remain platform-independent, the server Worker stays composition-only, and the admin app stays frontend-only.

The product domain is the best first slice because it exercises the most important boundaries without dragging in cross-module orchestration. A minimal product slice can prove module registration, owned persistence, typed service contracts, API assembly, admin discovery, and request flow while avoiding pricing, inventory, search, and order dependencies.

## Goals / Non-Goals

**Goals:**

- Implement the first real commerce module under the blueprint package boundaries.
- Add a `product` module that owns its schema contribution, repository contract, service contract, API fragment contribution, and admin metadata contribution.
- Prove the module can be composed into the existing `packages/api`, `apps/server`, and `apps/web` surfaces without importing runtime-specific code into core or module packages.
- Limit the first product workflow to foundation-level operations that validate both read and write flow for admin-facing product management.
- Add verification that protects the new boundaries and prevents regressions in composition.

**Non-Goals:**

- Implement full Medusa-level product modeling such as variants, options, collections, pricing, inventory availability, search indexing, or publishing workflows.
- Redesign the overall module system or plugin system beyond the smallest changes required to support a concrete module contribution.
- Add new database adapters, Cloudflare runtime features, or plugin runtime behavior.
- Build a polished admin product management suite; this slice only needs enough UI and metadata to prove discovery and typed end-to-end wiring.
- Introduce cross-module workflows with pricing, inventory, cart, or order modules.

## Decisions

1. Implement the product slice as a dedicated package under `packages/modules/product`.

   The product module should live in its own package so the first real commerce domain follows the target structure instead of growing inside `packages/api`, `packages/db`, or `apps/server`. The package will own the product module definition, domain types, repository interface, service implementation, API fragment factory, and admin metadata exports.

   Alternative considered: implement product logic directly in existing packages without creating the module package. Rejected because it would not validate the blueprint boundary that follow-up modules are expected to follow.

2. Keep the initial product model intentionally small and admin-oriented.

   The first slice should only require the fields needed to prove module-owned persistence and admin CRUD flow: stable product identifier, handle, title, status, and audit timestamps. The initial operations should cover listing products, reading a product by identifier, and creating or updating a draft-style product record. This is enough to validate end-to-end behavior without introducing pricing, inventory, or publication complexity.

   Alternative considered: design the full product catalog model up front. Rejected because it would expand scope into adjacent modules and slow down validation of the core module boundaries.

3. Let `packages/modules/product` own the canonical product schema contribution while `packages/db` remains the shared schema assembly surface.

   The module package should define the product table/schema contribution and repository-facing types. `packages/db` should continue to be the package that exports the assembled schema consumed by adapters such as `packages/db-d1`, but it should import and include the product schema contribution rather than redefining product tables itself. This preserves module ownership while fitting the repo's current adapter layout.

   Alternative considered: keep all schema definitions centralized in `packages/db`. Rejected because the blueprint requires module-owned data model boundaries, and centralizing product tables there would weaken that ownership from the first slice.

4. Introduce typed product contributions instead of relying on string-only placeholders.

   The existing core module contribution fields are string arrays that are sufficient for scaffolding but not for assembling a real module slice. This change should introduce the smallest typed contribution model needed for a concrete product module: typed API fragment references, typed admin surface metadata, and explicit service registration. The core change should remain narrow and driven by the needs of the product slice rather than a full registry redesign.

   Alternative considered: keep string keys and manually wire product routes and UI in downstream packages. Rejected because it would bypass the composition rules the first slice is supposed to prove.

5. Compose the product API through `packages/api` and consume it from `apps/web` through existing shared clients.

   The product module should define contract-first oRPC procedures inside `src/contracts` and implement them in `src/router`, where the package exports one or more route fragments that `packages/api` can merge into the root router using the existing assembly pattern. Each route contract should carry explicit API-documentation metadata such as method, path, summary, description, operation id, success description, and tags. `apps/server` should continue to mount only the assembled router. `apps/web` should consume the new procedures through the existing typed oRPC client and render module-provided admin metadata rather than importing backend runtime code.

   Alternative considered: add product-specific routes directly in the server Worker or hardcode product page data structures in the web app. Rejected because both approaches would violate the shared-composition goal of this slice.

6. Standardize a module package SOP around explicit source folders.

   The first module should establish a repeatable package structure for later commerce slices. The product package should separate domain contracts, oRPC contracts, implemented routers, services, repositories, admin metadata, module declaration, testing helpers, and package-local tests into dedicated folders. Package-local tests should live under `src/_tests` to keep the exported surfaces and implementation folders uncluttered.

   Alternative considered: let each module choose its own internal layout. Rejected because follow-up modules and plugins need a predictable layout for maintainability and reviewability.

7. Use contract tests and boundary tests as first-class acceptance criteria.

   This change is valuable only if it proves the boundaries stay intact while the first real module is added. Verification should include unit tests for product service and repository behavior, API assembly tests for the product fragment, UI-level tests for admin discovery or rendering of the product surface, and import-boundary checks that keep `packages/modules/product` free of Cloudflare bindings, Hono types, and direct D1 adapter imports.

   Alternative considered: rely on compile success alone. Rejected because compile-only checks would not prove the first module composes correctly or that boundary rules remain enforced.

## Risks / Trade-offs

- Adding typed module contributions can broaden the change beyond a single domain slice -> Mitigation: keep the contribution model narrowly scoped to the concrete product API/admin needs and avoid speculative abstractions.
- Module-owned schema composition may create temporary awkwardness between `packages/modules/product` and `packages/db` -> Mitigation: treat `packages/db` as schema assembly only and document the ownership boundary explicitly in code and tests.
- Even a minimal product write flow can pull in authorization and validation questions -> Mitigation: keep the first permissions model simple, reuse existing auth procedure patterns, and focus on internal/admin use cases only.
- Admin metadata discovery can be underpowered if the current web app lacks a registry mechanism -> Mitigation: implement the smallest metadata reader/renderer that proves module-driven navigation and screen selection without attempting a full extensibility framework.
- The first slice may reveal gaps in `packages/core` abstractions -> Mitigation: allow small, evidence-driven contract refinements in core, but defer wider redesign to follow-up changes unless product implementation cannot proceed cleanly.

## Migration Plan

1. Extend `packages/core` only where the product slice needs stronger typed module contribution contracts.
2. Add `packages/modules/product` with the standard module SOP folders, domain types, schema contribution, repository contract, service implementation, contract-first API definitions, implemented route fragment export, and admin metadata export.
3. Update `packages/db` schema assembly and `packages/db-d1` adapter wiring so the product schema is part of the shared D1 schema surface.
4. Register the product fragment in `packages/api`, keep `apps/server` on the same composition path, and add `apps/web` product-facing admin surface consumption through the existing oRPC client.
5. Add or update tests for module composition, product service behavior, API assembly, admin rendering, and boundary restrictions.
6. Roll back by removing the product package, unregistering its schema and API contributions, and reverting the small core contract extensions; no external migration path beyond D1 schema reversal is required for this planning change.

## Open Questions

- Should the first write operation be limited to product creation only, or should the foundation also include update/status editing in the same slice?
- Should admin metadata discovery in this change power a generic registry in `apps/web`, or is a module-exported product navigation contract plus one host-rendered screen sufficient for the first proof?
- Do product repository tests need a dedicated in-memory adapter in this slice, or can they rely on the existing shared database service contract with lightweight test doubles?

## Context

The blueprint change `define-cloudflare-commerce-blueprint` assigns `packages/api` a narrow role: assemble typed API surfaces from shared auth, commerce modules, and future plugins while leaving HTTP transport composition in `apps/server`.

The current repository is not at that boundary yet:

- `packages/api` exposes procedure helpers, request context creation, and one hardcoded `appRouter`.
- `apps/server` imports that router directly and constructs the oRPC/OpenAPI handlers inline.
- There is no contract yet for module-owned or plugin-owned route fragments to participate in the API surface.
- The admin extensibility blueprint already assumes shared router typing will be available for downstream clients.

This change is the API-composition slice of the blueprint roadmap. It does not introduce new commerce endpoints. Its job is to turn the current single-router package into an assembly boundary that later module and plugin changes can extend without pushing business procedures back into the Worker app.

Constraints:

- Hono remains the transport layer owned by `apps/server`.
- oRPC remains the typed procedure/router system.
- The auth boundary established by `refactor-shared-auth-boundary` remains the source of shared auth/session typing.
- The design must support future module and plugin contributions without requiring `apps/server` to know each route implementation directly.

## Goals / Non-Goals

**Goals:**

- Refactor `packages/api` into a router assembly layer instead of a single hardcoded router export.
- Define a shared route fragment contract that auth, modules, and plugins can implement consistently.
- Keep request context, procedure helpers, and root router typing centralized in `packages/api`.
- Preserve `apps/server` as the owner of Hono app creation, auth handler mounting, CORS, and edge handler wiring.
- Add verification that detects route-key collisions, keeps transport concerns out of `packages/api`, and prevents server-local business procedure definitions from reappearing.

**Non-Goals:**

- Implement the first real commerce module routes in this change.
- Add plugin sandbox dispatch or plugin lifecycle behavior beyond the route contribution contract needed for future changes.
- Replace oRPC, Hono, Better Auth, or OpenAPI generation.
- Finalize the full admin client or metadata-discovery flow.

## Decisions

1. `packages/api` will expose an explicit API assembly contract instead of a prebuilt app router.

   The package should define a root assembly entry point that accepts route fragments from built-in surfaces such as auth/system routes and later module/plugin contributors. The assembled result should include the root oRPC router plus any transport-facing handler inputs the server needs.

   Alternative considered: keep exporting a single mutable `appRouter` object and let later changes append to it ad hoc. Rejected because it hides contributor ownership and makes duplicate route keys or assembly order hard to validate.

2. Route contributions will be modeled as named fragments with stable ownership metadata.

   Each contributor should provide a fragment key, a router record, and optional metadata such as whether it is built-in, module-owned, or plugin-owned. The first implementation only needs enough metadata to support deterministic assembly, debugging, and collision reporting.

   Alternative considered: accept anonymous plain objects and merge them directly. Rejected because later module and plugin debugging needs ownership data when a contribution conflicts or fails.

3. Assembly will be deterministic and fail closed on conflicts.

   The assembler should merge contributors in a stable order and reject duplicate top-level procedure keys or mount aliases before the server starts handling requests. Conflict errors should identify the contributor keys involved so the failure is actionable during development and CI.

   Alternative considered: last-writer-wins merging. Rejected because silent overrides would make module and plugin behavior non-obvious and unsafe.

4. `apps/server` will consume an assembled API surface but remain the transport owner.

   The server app should create Hono, mount Better Auth under `/api/auth/*`, and wire the assembled oRPC/OpenAPI handlers using the shared request context. `apps/server` should not define module procedures or duplicate router typing locally.

   Alternative considered: move all handler creation into `packages/api`. Rejected because the blueprint keeps HTTP/runtime composition in `apps/server`, where bindings, CORS policy, and Worker-specific wiring belong.

5. Shared router typing will be exported from the assembled root surface.

   `packages/api` should remain the source of root router and client types derived from the final assembled surface so `apps/web` and other downstream consumers can depend on one typed contract. The public export surface should stay narrow and explicit.

   Alternative considered: let every consumer infer router types from local imports of fragment files. Rejected because it breaks the package boundary and couples consumers to implementation layout.

6. Verification will combine assembly tests and architectural boundary checks.

   This change should add tests that prove:
   - route fragments assemble into a root router
   - duplicate contribution keys fail with clear errors
   - protected procedures continue to use the shared auth-aware context
   - `apps/server` consumes assembled routes rather than defining business procedures locally

   Alternative considered: rely on the eventual first module implementation to validate the design. Rejected because the API boundary itself is the deliverable of this change.

## Risks / Trade-offs

- [Risk] The fragment contract could be too narrow for future module or plugin needs
  -> [Mitigation] keep the first shape minimal but include contributor identity and room for future metadata without forcing transport details into contributors.
- [Risk] Deterministic assembly may add boilerplate for simple built-in routes
  -> [Mitigation] provide small helpers for built-in fragments so the common case stays concise.
- [Risk] Moving server imports to an assembled surface can ripple through tests
  -> [Mitigation] preserve the existing health/private route behavior during the refactor and update tests around the new assembly entry point.
- [Risk] API typing could sprawl if every fragment is exported publicly
  -> [Mitigation] keep fragment internals private by default and export only the stable root surface plus any intentional contributor contract types.

## Migration Plan

1. Define the route fragment and assembly types in `packages/api`, alongside the existing context and procedure helpers.
2. Convert the current hardcoded `appRouter` into one or more built-in fragments that exercise the new assembly path.
3. Add an assembly entry point that produces the root router and shared router/client types from registered fragments.
4. Update `apps/server` to import the assembled API surface and continue mounting Better Auth, RPC, and OpenAPI handlers with the shared request context.
5. Add targeted tests and boundary checks for collision detection, protected procedure behavior, and server/package ownership.
6. Leave future module and plugin changes to register their own fragments through the new contract rather than editing server transport code directly.

Rollback is straightforward because this change only reorganizes route ownership and package boundaries. Reverting the assembler and restoring the direct `appRouter` import returns the repo to its current behavior without data migration.

## Open Questions

- Should built-in auth/session-related RPC procedures live in `packages/auth`, `packages/api`, or be split between both once module composition grows?
- Should route fragments support nested namespaces from the first slice, or is flat top-level composition sufficient until the first real module lands?
- How much contributor metadata is worth standardizing now beyond key and owner type before native plugin registration exists?

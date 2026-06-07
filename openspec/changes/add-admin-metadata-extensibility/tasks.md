## 1. Contract Placement

- [x] 1.1 Decide the owning package for shared admin metadata contracts and document the boundary in the implementation notes.
- [x] 1.2 Add source identity and stable ID conventions for module and plugin admin metadata contributors.
- [x] 1.3 Add simple permission descriptor types that can be shared by admin metadata, API operations, and auth authorization checks.

## 2. Metadata Schema

- [x] 2.1 Define typed metadata contracts for navigation entries, resources, widgets, actions, forms, tables, and API operation references.
- [x] 2.2 Define the approved host-rendered primitive descriptor set for sandboxed plugin admin contributions.
- [x] 2.3 Add validation helpers that reject unsupported primitives, missing required IDs, invalid operation references, and duplicate contribution IDs.
- [x] 2.4 Add representative module and plugin metadata fixtures for tests and future implementation examples.

## 3. Metadata Composition

- [x] 3.1 Implement a metadata registry or composition function that accepts module and plugin contributions.
- [x] 3.2 Normalize metadata with deterministic ordering, grouping, source identity, and source-scoped IDs.
- [x] 3.3 Fail composition with actionable errors when duplicate global IDs or invalid contributor metadata are detected.
- [x] 3.4 Filter inactive plugin contributions before exposing the normalized admin model.

## 4. API and Authorization

- [x] 4.1 Expose a typed admin metadata discovery operation through the shared API layer.
- [x] 4.2 Ensure metadata operation references use shared oRPC/router typing rather than backend service imports.
- [x] 4.3 Apply permission-aware filtering to the discovery operation for the current admin user.
- [x] 4.4 Ensure referenced backend operations still enforce required permissions when called directly.

## 5. Admin App Rendering

- [x] 5.1 Add admin app adapters that consume the normalized metadata discovery response through typed API clients.
- [x] 5.2 Render metadata-driven navigation entries, resource shells, simple tables/forms, widgets, and actions through approved UI primitives.
- [x] 5.3 Hide, disable, or reject unauthorized surfaces based on declared metadata permissions.
- [x] 5.4 Add import-boundary checks that prevent `apps/web` from importing Effect runtime services, Cloudflare bindings, Hono server types, or concrete backend module internals.

## 6. Tests and Verification

- [x] 6.1 Add contract tests for valid module and plugin contribution discovery.
- [x] 6.2 Add contract tests for invalid metadata, unsupported sandboxed plugin primitives, and duplicate global IDs.
- [x] 6.3 Add permission tests for metadata filtering and backend operation rejection when permissions are missing.
- [x] 6.4 Add type-level or compile-time checks for API operation reference typing.
- [x] 6.5 Run targeted tests plus project typecheck and Ultracite checks.

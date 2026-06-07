## Context

The architecture blueprint defines admin extensibility as a metadata-driven surface. Commerce modules and plugins need a way to contribute navigation, resource screens, forms, tables, dashboard widgets, permissions, and API operation references without making `apps/web` import backend runtime services or plugin code directly.

The current change narrows that blueprint into a first implementation slice: shared TypeScript contracts, discovery behavior, host-rendered admin primitives, permission gating, and contract tests. It is intentionally a contract-first change so future module and plugin work can target a stable admin contribution shape.

## Goals / Non-Goals

**Goals:**

- Define a typed admin metadata contract for module and plugin contributions.
- Keep the TanStack Start admin app frontend-only: no Effect runtime imports, Cloudflare binding imports, or concrete backend service imports.
- Allow modules and plugins to contribute navigation, resource definitions, actions, forms, tables, dashboard widgets, and API operation references through metadata.
- Support permission-aware discovery and rendering while preserving backend authorization as the source of enforcement.
- Require sandboxed plugin contributions to render through approved host primitives until a separate UI isolation boundary is designed.
- Add tests that lock metadata normalization, contribution discovery, permission filtering, and shared API reference typing.

**Non-Goals:**

- Build complete product, order, customer, or plugin admin screens in this change.
- Add unrestricted plugin-supplied frontend bundles or iframe/webview isolation.
- Implement the full plugin runtime, Worker Loader sandbox, or bridge API.
- Replace the existing TanStack Start app shell or oRPC client strategy.
- Define every possible future component primitive for rich admin UI customization.

## Decisions

1. Define admin metadata as shared contracts, not app-local route config.

   Admin contribution types should live in shared package boundaries that modules, plugins, API assembly, and the admin app can all import without circular runtime coupling. The contract should include stable IDs, labels, navigation placement, resource descriptors, operation references, permissions, and primitive render descriptors.

   Alternative considered: keep admin routes as hardcoded `apps/web` route configuration. Rejected because it prevents modules and plugins from contributing surfaces independently.

2. Use operation references instead of direct service imports.

   Metadata should reference typed API operations by stable route/procedure identifiers. Admin surfaces call those operations through the shared oRPC client and shared auth/session/permission types, not through Effect services, Cloudflare bindings, or module internals.

   Alternative considered: let admin metadata include service tags or module service method names. Rejected because that would leak backend runtime concepts into the frontend and weaken deployment boundaries.

3. Normalize contributions before exposing them to the admin app.

   The server/API composition layer should gather module and plugin metadata, validate unique IDs, normalize ordering and grouping, attach source identity, and omit inactive or unauthorized contributions before the admin shell renders them. The frontend may still perform defensive hiding, but backend-side metadata filtering is required.

   Alternative considered: have the frontend merge raw module and plugin exports. Rejected because plugin lifecycle, permission context, and sandbox capability policy belong on the host side.

4. Model permissions at the surface and operation level.

   Navigation entries, resources, actions, widgets, and referenced operations should declare required permissions. The admin app uses those declarations to hide or disable unavailable surfaces, while the backend still enforces permissions on every operation.

   Alternative considered: permission checks only inside rendered components. Rejected because unavailable surfaces would still be discoverable and inconsistent with backend authorization.

5. Restrict sandboxed plugin UI to host-rendered primitives.

   Sandboxed plugin metadata may describe approved primitives such as links, tables, forms, statistic widgets, and action buttons. It must not ship arbitrary frontend code until a later change defines a safe UI isolation boundary.

   Alternative considered: allow plugin-provided React components in the admin app. Rejected because sandboxed plugin code requires an explicit browser-side isolation and trust model that is outside this slice.

6. Keep the first schema intentionally small and extensible.

   The first metadata schema should cover core vertical-slice needs: navigation, resources, list/detail forms, simple widgets, actions, permissions, and API references. Rich layout composition, custom visualizations, and embedded app surfaces should be represented as future extension points rather than fully specified now.

   Alternative considered: design a comprehensive page-builder schema up front. Rejected because it would delay useful module slices and likely overfit before real admin screens exist.

## Risks / Trade-offs

- Metadata schema is too narrow -> Mitigation: include versioned descriptors and explicit extension slots so later changes can add primitives without breaking existing contributors.
- Permission filtering drifts from backend enforcement -> Mitigation: add contract tests that verify metadata permissions and API authorization both exist for contributed operations.
- Plugin contributions become too powerful -> Mitigation: require sandboxed plugin metadata to use host-rendered primitive descriptors and reject arbitrary component/module references.
- Shared contracts become a dumping ground -> Mitigation: keep contracts transport- and runtime-neutral, and keep TanStack-specific rendering adapters inside `apps/web` or shared UI primitives.
- ID conflicts between modules and plugins cause unstable navigation -> Mitigation: normalize contributions with source-scoped IDs and fail composition on duplicate global IDs.

## Migration Plan

1. Add shared admin metadata types in the appropriate contract package, aligned with module and plugin contribution types.
2. Add a metadata registry/composition function that accepts module and plugin contributions, validates them, and returns a normalized admin model.
3. Expose the normalized admin model through typed API operations consumed by `apps/web`.
4. Add frontend rendering primitives for navigation, resource lists/details, simple forms/tables, widgets, and actions.
5. Add permission-aware filtering and unauthorized fallback behavior in both metadata discovery and operation calls.
6. Add contract tests for contribution discovery, duplicate IDs, permission filtering, API operation references, and sandboxed plugin primitive restrictions.

Rollback is straightforward because this change is additive. Disable the metadata API and app rendering path, then remove the new contracts and tests if the design is replaced before module/plugin consumers depend on it.

## Open Questions

- Which package should own the shared admin metadata contracts if the core package already owns module declarations and plugin contracts?
- Should metadata IDs be globally unique strings or source-scoped tuples normalized into global IDs?
- What is the minimum form/table descriptor needed for the first vertical module slice?
- Should permission expressions start as simple resource/action strings or a richer policy expression shape?
- Should the normalized metadata endpoint return only authorized surfaces or both all surfaces and authorization state for disabled UI affordances?

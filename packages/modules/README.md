# Module Package SOP

Each commerce module package under `packages/modules/*` should follow the same
source layout so domain slices stay predictable and composable.

## Required folders

- `src/contracts`: oRPC contracts and route-definition helpers.
- `src/domain`: schema, domain types, and repository-facing contracts.
- `src/services`: domain services and Effect service registrations.
- `src/repositories`: local repository implementations and test doubles.
- `src/router`: implemented route fragments exported to `packages/api`.
- `src/admin`: typed admin metadata contributions.
- `src/module`: the `defineCommerceModule` declaration.
- `src/testing`: explicit test helpers exported for other packages.
- `src/_tests`: package-local tests and boundary checks.

## Export guidance

- Public package subpaths should map to the folders above.
- `packages/api` should import route fragments from `./router`, not from a
  module-local catch-all `./api` surface.
- Modules should export Kysely table type and migration contributions from
  `./domain` or `./schema`, while concrete database runtime adapters stay
  outside module packages.

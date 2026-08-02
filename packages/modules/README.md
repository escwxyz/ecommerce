# Module Package SOP

Each commerce module package under `packages/modules/*` should follow the same
source layout so domain slices stay predictable and composable.

## Required folders

- `src/domain`: schema, domain types, and repository-facing contracts.
- `src/services`: domain services and Effect service registrations.
- `src/repositories`: local repository implementations and test doubles.
- `src/admin`: typed admin metadata contributions.
- `src/module`: the `defineCommerceModule` declaration.
- `src/testing`: explicit test helpers exported for other packages.
- `src/__tests__`: package-local tests and boundary checks.

## Export guidance

- Public package subpaths should map to the folders above.
- Module packages own Effect domain/API/storage schemas, schema-backed tagged
  errors, Effect services/Layers, repository contracts, admin metadata, module
  declarations, and deterministic test helpers.
- `packages/api` composes module Effect HTTP group contributions from canonical
  module exports. Do not add module-local oRPC router fragments or Hono route
  helpers.
- PostgreSQL Drizzle schemas, migrations, and adapter Layers live in adapter
  packages such as `packages/db-postgres`; module packages export repository
  contracts and test doubles, not Kysely table types or concrete database
  runtime adapters.

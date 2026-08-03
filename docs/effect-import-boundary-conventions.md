# Effect Import Boundary Conventions

Migrated backend packages must enable import-boundary tests before their legacy
paths are considered deleted. The shared helpers live in
`@ecommerce/core/testing`.

## Default legacy backend ban

Use `createLegacyBackendImportBoundary` for runtime-neutral packages that have
completed an Effect migration slice. Its default rule bans imports from:

- Hono
- oRPC
- Zod
- Kysely and Kysely D1
- Cloudflare Worker runtime packages
- `@ecommerce/platform-cloudflare`

Package tests may add `extraForbiddenSpecifiers` for package-local adapters such
as `@ecommerce/db-d1`, `@ecommerce/server`, or old app-relative paths.

## Repository-wide completion gate

Task 12.6 adds a tracked-file repository gate in
`packages/core/src/testing/__tests__/repo-backend-boundaries.test.ts`. The gate
is intentionally broader than the package-local slice tests:

- production backend source in `apps/server/src` and `packages/*/src` must not
  import Hono, oRPC, Zod, Kysely, Kysely D1, or the removed shared D1/Kysely
  packages;
- backend package manifests must not declare those legacy backend dependencies;
- runtime-neutral production packages must not import Cloudflare Worker runtime
  modules or `@ecommerce/platform-cloudflare`;
- browser and runtime-neutral production source must not import the server-only
  `@ecommerce/storefront-sdk/cloudflare` transport.

The scan uses `git ls-files`, so it covers committed project files and ignores
local untracked scaffolding. Newly tracked backend files automatically enter the
gate.

## Exceptions

Use `allowedSpecifiers` only for documented temporary bridges or unrelated
packages whose names share a prefix with a banned library. Every temporary
bridge still needs an owner, removal task, and deletion criterion in the active
OpenSpec change.

## Test placement

New boundary tests belong under a package-local `__tests__/` folder. Existing
historical boundary tests may remain until touched, but migrated packages should
prefer the shared scanner over bespoke string matching.

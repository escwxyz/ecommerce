## Why

The local Cloudflare stack now starts reliably, but developers still lack a repeatable dataset for exercising the complete commerce path. Deterministic seed data is needed before runtime smoke tests and broader admin dashboard work can produce trustworthy results.

## What Changes

- Add an idempotent development seed workflow owned by the D1 adapter package.
- Seed the minimum connected records required for a golden checkout path: store defaults, region and sales channel, product and variant, pricing, inventory and stock location, tax configuration, customer, and fulfillment configuration.
- Use stable identifiers and convergent writes so rerunning the seed does not duplicate records or change references.
- Add package-local and root commands for applying local D1 migrations and seeding development data.
- Add automated coverage that applies all migrations, runs the seed twice, and verifies stable cross-module relationships.

## Capabilities

### New Capabilities

- `deterministic-development-data`: Defines the repeatable local migration and seed workflow, the golden checkout fixture, idempotency requirements, and verification expectations.

### Modified Capabilities

- None.

## Impact

- Affected code: `packages/db-d1`, root and package scripts, seed tests, and development documentation where command usage is recorded.
- Affected systems: local Cloudflare D1 only; production deployment data is not seeded automatically.
- Affected module data: store, region/sales-channel, product, pricing, inventory, tax, customer, and fulfillment tables through their existing database contracts and migrations.
- Dependencies: no new runtime dependency is expected; the implementation should use the existing Kysely and D1 tooling.

## MODIFIED Requirements

### Requirement: Shared database contracts live outside D1 runtime code

The platform SHALL expose shared database contracts from `packages/db` without importing Cloudflare runtime bindings, `@ecommerce/env/server`, D1-specific Kysely dialect wrappers, `drizzle-orm/d1`, or concrete D1 adapter packages.

#### Scenario: Shared package consumes database contracts

- **WHEN** a shared package, test, or future module needs database-facing types or services
- **THEN** it MUST be able to import them from `packages/db` without pulling in D1-only runtime dependencies

### Requirement: D1 runtime code lives in a dedicated adapter package

The platform SHALL provide Cloudflare D1 runtime wiring from a dedicated adapter package that creates D1-backed Kysely instances rather than from the shared database contract package.

#### Scenario: Server Worker provisions database access

- **WHEN** the Worker composes runtime services for a request or process
- **THEN** it MUST obtain the concrete D1-backed Kysely implementation from the D1 adapter package instead of constructing it from `packages/db`

### Requirement: D1 migration ownership is explicit

The platform SHALL keep D1 migration configuration, D1-compatible Kysely dialect setup, and D1-specific SQL artifacts with the D1 adapter package so dialect differences remain reviewable.

#### Scenario: D1 migration command is updated

- **WHEN** a contributor changes D1 migration execution or push behavior
- **THEN** the affected configuration and migration artifacts MUST live under the D1 adapter package rather than the shared contract package

### Requirement: Database boundary regressions are verified

The repository SHALL include targeted verification that fails if shared database code regresses back to D1-specific runtime imports or if the D1 adapter stops constructing its Kysely client from explicit runtime inputs.

#### Scenario: Shared DB package reintroduces D1 import

- **WHEN** a follow-up change adds `drizzle-orm/d1`, D1-specific Kysely dialect wrappers, `@ecommerce/env/server`, or equivalent runtime-only imports to `packages/db`
- **THEN** boundary verification MUST fail before the change is accepted

> Superseded storage note: `replace-drizzle-primary-storage-with-kysely` replaces Drizzle-specific adapter requirements with Kysely-based primary storage requirements.

## ADDED Requirements

### Requirement: Shared database contracts live outside D1 runtime code

The platform SHALL expose shared database contracts from `packages/db` without importing Cloudflare runtime bindings, `@ecommerce/env/server`, or `drizzle-orm/d1`.

#### Scenario: Shared package consumes database contracts

- **WHEN** a shared package, test, or future module needs database-facing types or services
- **THEN** it MUST be able to import them from `packages/db` without pulling in D1-only runtime dependencies

### Requirement: D1 runtime code lives in a dedicated adapter package

The platform SHALL provide Cloudflare D1 runtime wiring from a dedicated adapter package rather than from the shared database contract package.

#### Scenario: Server Worker provisions database access

- **WHEN** the Worker composes runtime services for a request or process
- **THEN** it MUST obtain the concrete D1 database implementation from the D1 adapter package instead of constructing it from `packages/db`

### Requirement: Database provisioning is explicitly injected

The platform SHALL require runtime database provisioning to be passed through explicit composition inputs rather than hidden environment reads inside shared database code.

#### Scenario: Non-D1 test provisions database access

- **WHEN** a test or local helper needs to provide a database implementation without Cloudflare bindings
- **THEN** it MUST be able to construct or substitute that implementation through explicit inputs rather than relying on env reads inside `packages/db`

### Requirement: D1 migration ownership is explicit

The platform SHALL keep D1 migration configuration and D1-specific schema or SQL artifacts with the D1 adapter package so dialect differences remain reviewable.

#### Scenario: D1 migration command is updated

- **WHEN** a contributor changes D1 migration generation or push behavior
- **THEN** the affected configuration and migration artifacts MUST live under the D1 adapter package rather than the shared contract package

### Requirement: Database boundary regressions are verified

The repository SHALL include targeted verification that fails if shared database code regresses back to D1-specific runtime imports or if the D1 adapter stops constructing its client from explicit runtime inputs.

#### Scenario: Shared DB package reintroduces D1 import

- **WHEN** a follow-up change adds `drizzle-orm/d1`, `@ecommerce/env/server`, or equivalent runtime-only imports to `packages/db`
- **THEN** boundary verification MUST fail before the change is accepted

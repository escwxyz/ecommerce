## MODIFIED Requirements

### Requirement: Core runtime remains platform independent

The commerce kernel SHALL avoid direct imports from Cloudflare bindings, Hono server code, TanStack admin UI code, or concrete database adapter runtime packages. Commerce modules SHALL depend on Effect services, module contracts, Kysely-compatible database/repository contracts, and plugin contracts rather than concrete D1, libSQL, PostgreSQL, or Worker runtime implementations.

#### Scenario: Core package is imported in a non-Cloudflare test

- **WHEN** a test imports the core runtime package without Cloudflare bindings
- **THEN** the package MUST load without requiring Worker globals, Hono server instances, frontend build artifacts, or concrete database adapter runtime code

#### Scenario: Runtime composes concrete platform services

- **WHEN** the server Worker starts
- **THEN** concrete Cloudflare bindings, Hono routing, and database adapter runtime instances MUST be composed outside the core runtime package and injected through explicit contracts

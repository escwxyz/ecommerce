## MODIFIED Requirements

### Requirement: Admin uses shared API typing
The admin dashboard SHALL consume types and clients derived from Effect HTTP and Effect Schema contracts rather than oRPC router types.

#### Scenario: Admin invokes a backend operation
- **WHEN** frontend code calls an admin endpoint
- **THEN** the request, success, and expected error types MUST derive from the canonical Effect API contract

### Requirement: Admin composition remains frontend-only
Admin UI composition SHALL remain free of backend Effect runtime execution and Cloudflare binding imports even though its API types derive from Effect schemas.

#### Scenario: Admin application is built
- **WHEN** the frontend bundle is analyzed
- **THEN** it MUST NOT contain backend runtime Layers, SQL clients, Cloudflare bindings, or server-only storefront SDK transports


## MODIFIED Requirements

### Requirement: Shared route fragment contract
Modules SHALL contribute Effect `HttpApiGroup` contracts and handler Layers without importing Cloudflare runtime bindings.

#### Scenario: Module declares endpoints
- **WHEN** a module exports its API contribution
- **THEN** the contribution MUST compose through the shared Effect API assembly contract

### Requirement: Deterministic route assembly
The API package SHALL assemble admin and storefront groups deterministically and SHALL reject duplicate method/path definitions.

#### Scenario: Two contributions conflict
- **WHEN** two groups declare the same method and path
- **THEN** assembly verification MUST fail before deployment

### Requirement: Server transport stays composition-only
The server Worker SHALL serve the assembled Effect HTTP application and SHALL NOT own reusable business handlers or API schemas.

#### Scenario: Endpoint behavior is implemented
- **WHEN** a handler invokes commerce logic
- **THEN** that handler and its service dependencies MUST live in reusable packages

### Requirement: Shared root router typing
The canonical Effect API contract SHALL be the source for OpenAPI and typed SDK clients.

#### Scenario: Frontend consumes storefront API
- **WHEN** the storefront SDK is built
- **THEN** its types MUST derive from the canonical Effect API and Schema definitions


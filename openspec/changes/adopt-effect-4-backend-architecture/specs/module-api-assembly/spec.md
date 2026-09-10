## MODIFIED Requirements

### Requirement: Executable module definition contract
Built-in modules SHALL contribute their application services, Effect
`HttpApiGroup` contracts, handler Layers, workflows, event handlers,
permissions, admin metadata, schema ownership, dependencies, and lifecycle
hooks through one `CommerceModuleDefinition` without importing Cloudflare
runtime bindings.

#### Scenario: Module declares endpoints
- **WHEN** a module is selected for an application
- **THEN** all of its executable and metadata contributions MUST compose from
  the selected definition and MUST disappear together when it is disabled

### Requirement: Deterministic route assembly
The API package SHALL assemble admin and storefront groups from the validated
module and plugin contributions deterministically and SHALL reject duplicate
group identifiers or method/path definitions before Layer acquisition.

#### Scenario: Two contributions conflict
- **WHEN** two groups declare the same method and path
- **THEN** assembly verification MUST fail before deployment

### Requirement: Server transport stays composition-only
The server Worker SHALL select one built-in module catalog, provide host adapter
Layers, and serve the assembled Effect HTTP application. It SHALL NOT maintain
parallel built-in module HTTP-group or service-registration arrays and SHALL
NOT own reusable business handlers or API schemas.

#### Scenario: Endpoint behavior is implemented
- **WHEN** a handler invokes commerce logic
- **THEN** that handler and its service dependencies MUST live in reusable packages

### Requirement: Shared root router typing
The canonical Effect API contract SHALL be the source for OpenAPI and typed SDK clients.

#### Scenario: Frontend consumes storefront API
- **WHEN** the storefront SDK is built
- **THEN** its types MUST derive from the canonical Effect API and Schema definitions

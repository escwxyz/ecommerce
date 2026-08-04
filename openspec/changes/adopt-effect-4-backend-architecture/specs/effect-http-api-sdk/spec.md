## ADDED Requirements

### Requirement: Canonical Effect HTTP APIs
Admin and storefront APIs SHALL be defined as composable Effect `HttpApi` contracts using Effect Schema for inputs, outputs, and declared errors.

#### Scenario: Module contributes an endpoint
- **WHEN** a module adds an admin or storefront endpoint
- **THEN** it MUST contribute a typed API group and handler Layer to the canonical application

### Requirement: Derived API documentation
OpenAPI documentation SHALL be derived from the canonical Effect HTTP contract rather than maintained as a parallel definition.

#### Scenario: API contract changes
- **WHEN** an endpoint schema or error changes
- **THEN** generated OpenAPI output MUST reflect that same contract

### Requirement: Storefront SDK dual transport
The storefront SDK SHALL expose one typed contract with browser HTTP and server-only Cloudflare Service Binding transports.

#### Scenario: Browser invokes storefront API
- **WHEN** browser code uses the SDK
- **THEN** it MUST call the public HTTP transport without bundling Cloudflare bindings or backend runtime code

#### Scenario: Cloudflare SSR invokes storefront API
- **WHEN** server-side Cloudflare code uses the SDK
- **THEN** it MUST call the backend Worker through a Service Binding while preserving the same validation, authorization, telemetry, result, and error contract


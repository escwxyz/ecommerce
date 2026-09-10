## MODIFIED Requirements

### Requirement: Core runtime remains platform independent
The core commerce runtime SHALL use Effect 4 and SHALL NOT depend on Cloudflare bindings, frontend UI code, concrete database adapters, Hono, oRPC, Zod, or Kysely.

#### Scenario: Core runtime is built
- **WHEN** core or a runtime-neutral module is typechecked
- **THEN** import-boundary tests MUST reject platform, frontend, legacy HTTP/schema, and legacy persistence dependencies

### Requirement: Server Worker composes runtime only
The Cloudflare server Worker SHALL provide runtime bindings and platform Layers to the assembled Effect HTTP application while shared API contracts, domain logic, workflows, auth contracts, and repositories remain in packages.

#### Scenario: Worker handles a request
- **WHEN** a request enters the backend Worker
- **THEN** Effect HTTP MUST execute it using the composed Cloudflare Layers

### Requirement: Effect-based service composition
The platform SHALL use Effect 4 services and Layers for module dependencies, platform resources, request scope, transactions, auth, telemetry, plugins, workflows, actors, and test overrides.

#### Scenario: Runtime requirement is replaced in a test
- **WHEN** a test provides a deterministic Layer for a service
- **THEN** business logic MUST run without production bindings or global mutation

### Requirement: Executable module catalog
The running built-in module set SHALL come from one immutable catalog of
executable `CommerceModuleDefinition` values. Composition SHALL validate module
dependencies and contribution collisions before resource acquisition, order
same-level modules by stable key, and run shutdown in reverse dependency order.

#### Scenario: Required module is disabled
- **WHEN** a selected module depends on a definition absent from the catalog
- **THEN** composition MUST fail before any module Layer or lifecycle hook runs

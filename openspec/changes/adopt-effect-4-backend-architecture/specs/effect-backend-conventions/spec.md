## ADDED Requirements

### Requirement: Effect 4 backend foundation
Backend business and platform logic SHALL use Effect 4 for typed effects, dependency requirements, resource scopes, configuration, concurrency, and runtime composition.

#### Scenario: Backend service declares behavior
- **WHEN** a backend service exposes an operation
- **THEN** the operation MUST expose its success, typed failure, and service requirements through Effect

### Requirement: Exact Effect dependency governance
The workspace SHALL exact-pin one mutually compatible Effect 4 package set and SHALL upgrade it only through a dedicated verified change.

#### Scenario: Effect dependency is declared
- **WHEN** an Effect package is added or upgraded
- **THEN** its version MUST be exact, centrally cataloged, and verified by the Effect architecture canary

### Requirement: Boundary-specific Effect Schemas
Modules SHALL define separate Effect Schemas for domain values, API representations, and storage representations and SHALL explicitly transform between them.

#### Scenario: Untrusted value enters the backend
- **WHEN** a value arrives from HTTP, configuration, SQL, a queue, event, workflow state, actor, provider, or plugin
- **THEN** it MUST be decoded before entering domain logic

### Requirement: Typed error and defect policy
Expected failures SHALL be schema-backed tagged error unions, while invariant violations, programming failures, and interruptions SHALL retain their distinct Effect Cause semantics.

#### Scenario: Adapter operation fails
- **WHEN** a database or provider adapter produces a foreign failure
- **THEN** the owning module MUST translate it to a declared module error before returning it across the module boundary

### Requirement: Mandatory Effect telemetry
Backend operations SHALL use structured Effect logging, metrics, tracing, correlation, redaction, and Cause-aware failure classification.

#### Scenario: Commerce operation executes
- **WHEN** an HTTP, SQL, workflow, queue, actor, plugin, or provider operation runs
- **THEN** it MUST emit the configured structured telemetry without exposing protected data

### Requirement: Runtime-neutral test Layers
Every runtime-neutral service contract SHALL provide a deterministic test or in-memory Layer.

#### Scenario: Module is tested outside Cloudflare
- **WHEN** a module test composes its requirements
- **THEN** it MUST run without Cloudflare bindings or a production runtime


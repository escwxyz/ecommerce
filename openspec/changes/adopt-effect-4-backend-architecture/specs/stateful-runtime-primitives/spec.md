## MODIFIED Requirements

### Requirement: Platform-free stateful coordination contracts
Core packages SHALL define Effect services and Effect Schema messages for keyed actors, serialized commands, timers, workflow coordination, and state persistence without importing Cloudflare or Rivet runtime APIs.

#### Scenario: Module requires serialized coordination
- **WHEN** a module coordinates mutable state by key
- **THEN** it MUST depend on the platform-free Effect actor contract

### Requirement: Durable Object adapter boundary
Cloudflare Durable Objects SHALL be the first actor adapter, and PostgreSQL SHALL remain authoritative relational storage unless a separate accepted design assigns ownership to actor-local storage.

#### Scenario: Durable Object stores local state
- **WHEN** an actor persists coordination, cache, or workflow state
- **THEN** its ownership and recovery relationship to PostgreSQL MUST be explicit and tested

### Requirement: Workflow, Queue, and Durable Object adapter verification
Cloudflare stateful adapters SHALL pass schema, typed-error, interruption, retry, recovery, idempotency, and telemetry tests against their platform-neutral contracts.

#### Scenario: Rivet adapter is proposed
- **WHEN** Rivet is evaluated as an alternate actor runtime
- **THEN** it MUST demonstrate parity for consistency, timers, recovery, placement, latency, deployment, operations, and cost before adoption

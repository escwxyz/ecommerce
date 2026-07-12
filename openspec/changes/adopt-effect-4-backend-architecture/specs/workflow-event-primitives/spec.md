## MODIFIED Requirements

### Requirement: Workflow definitions declare executable orchestration boundaries
Cross-module operations SHALL be Effect workflows with schema-versioned inputs, typed step failures, declared requirements, retry policy, compensation, and observable execution identity.

#### Scenario: Checkout coordinates multiple modules
- **WHEN** checkout invokes inventory, payment, fulfillment, and order operations
- **THEN** each operation MUST execute as a declared idempotent workflow step rather than a distributed transaction

### Requirement: Workflow runs support idempotent execution state
Workflow runtimes SHALL persist step attempts and outcomes so replay after interruption does not duplicate completed side effects.

#### Scenario: Workflow resumes after interruption
- **WHEN** persisted state shows that a step completed
- **THEN** the runtime MUST reuse the recorded outcome or invoke an idempotent provider operation rather than repeat an unsafe side effect

### Requirement: Workflow lifecycle events use the shared event publisher contract
Module state changes and their outbox events SHALL commit atomically, and workflow/event delivery SHALL expose Effect-native typed failures and telemetry.

#### Scenario: Module mutation commits
- **WHEN** the mutation requires downstream event delivery
- **THEN** its outbox record MUST commit in the same local Effect SQL transaction

### Requirement: Workflow runtime remains adapter-based with Cloudflare primitives first
Workflow contracts SHALL remain platform-neutral while Cloudflare Queues, Workflows, and Durable Objects provide the first production runtime Layers.

#### Scenario: Workflow is tested locally
- **WHEN** a workflow test provides deterministic runtime services
- **THEN** it MUST execute retry, compensation, and recovery behavior without Cloudflare bindings


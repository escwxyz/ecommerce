# Workflow Event Primitives

## Purpose

Synced from completed OpenSpec changes. This spec captures the current accepted requirements for this capability.

## Requirements

### Requirement: Workflow definitions declare executable orchestration boundaries

The platform SHALL define workflow contracts in `packages/core` that allow a workflow to declare a stable workflow key, ordered step definitions, stable step identifiers, typed input/output boundaries, and optional step compensation handlers without importing Cloudflare runtime bindings or concrete database adapter packages.

#### Scenario: New cross-module workflow is introduced

- **WHEN** a later change introduces a workflow for cart completion, order creation, or another cross-module process
- **THEN** the workflow MUST be expressible through the shared workflow definition contract rather than a module-private orchestration shape

### Requirement: Workflow runs support idempotent execution state

The platform SHALL define a workflow run contract that records a durable run identifier, workflow key, workflow version, status, execution history or adapter-backed history reference, correlation metadata, optional causation metadata, and an optional idempotency key so duplicate triggers or retries can be recognized deterministically.

#### Scenario: Duplicate workflow trigger arrives

- **WHEN** the same workflow trigger is received again with an idempotency key that matches an existing durable run
- **THEN** the system MUST resolve the duplicate against the existing run state instead of starting a second independent run silently

### Requirement: Compensation follows reverse completed-step order

The platform SHALL define compensation behavior for compensatable workflow steps such that, after a failure in a later step, compensation runs only for previously completed compensatable steps and runs in reverse completed-step order.

#### Scenario: Later step fails after earlier side effects succeed

- **WHEN** a workflow step fails after one or more earlier compensatable steps have completed
- **THEN** the workflow contract MUST represent the run as failed or compensating and MUST require compensation to execute in reverse order for the completed compensatable steps

### Requirement: Event envelopes carry orchestration trace metadata

The platform SHALL define a shared event envelope contract that includes a stable event identifier, event name, payload, emitted timestamp, source module, correlation identifier, optional causation identifier, and optional workflow run identifier so domain and workflow events can be traced across module boundaries.

#### Scenario: Workflow emits a lifecycle or domain event

- **WHEN** a workflow step or module publishes an event during orchestration
- **THEN** the published event MUST carry the shared trace metadata needed to connect it to the originating workflow or triggering action

### Requirement: Workflow lifecycle events use the shared event publisher contract

The platform SHALL publish workflow lifecycle events through the shared event publisher service contract instead of a separate workflow-only transport contract.

#### Scenario: Workflow run changes state

- **WHEN** a workflow run starts, completes a step, fails, begins compensation, or completes compensation
- **THEN** the runtime MUST be able to publish a corresponding lifecycle event through the same publisher contract used for domain events

### Requirement: Workflow runtime remains adapter-based with Cloudflare primitives first

The platform SHALL define workflow execution as a core runtime contract with an in-memory implementation for tests and a Cloudflare adapter that wraps native Workflow, Queue, and Durable Object primitives behind the shared API.

#### Scenario: Workflow primitives are executed on Cloudflare

- **WHEN** the platform runs a workflow in the primary Cloudflare deployment target
- **THEN** it MUST execute through the shared workflow runtime contract rather than exposing raw Cloudflare workflow primitives directly to commerce modules

### Requirement: Workflow runtime operations use one Effect execution model

The workflow runtime, durable state store, metadata projection store, and
lifecycle publication contracts SHALL expose typed Effects. Lookup absence SHALL
succeed with `Option.none`, and workflow step requirements SHALL remain visible
until supplied by host Layer composition. Runtime-neutral workflow code SHALL
NOT execute a nested Effect runtime or accept Promise-or-value store operations.

#### Scenario: Running workflow is interrupted

- **WHEN** an executing workflow fiber is interrupted during a step or retry delay
- **THEN** completed outcomes MUST remain resumable without recording a false failed step or triggering compensation solely because of interruption

#### Scenario: Duplicate starts race

- **WHEN** concurrent starts use the same workflow and idempotency key
- **THEN** atomic registration MUST converge on one logical run

#### Scenario: Adapter reports stale metadata

- **WHEN** durable state contains more complete execution progress than metadata
- **THEN** recovery MUST use durable state as the replay authority

#### Scenario: Dispatch or lifecycle publication is interrupted

- **WHEN** a registered Cloudflare run or persisted lifecycle checkpoint is retried
- **THEN** the adapter MUST resume from the last durable dispatch stage and lifecycle publishers MUST deduplicate the stable event envelope ID

#### Scenario: Workflow implementation and payload schema evolve independently

- **WHEN** a workflow implementation version or its persisted payload schema version changes independently
- **THEN** the runtime MUST persist and validate both versions as distinct values

#### Scenario: Cloudflare platform operation rejects

- **WHEN** a Workflow, Queue, coordinator, state, metadata, or lifecycle operation rejects
- **THEN** the Cloudflare adapter MUST translate it to a sanitized, operation-specific workflow failure at the platform seam

#### Scenario: Workflow telemetry fails

- **WHEN** observational telemetry fails
- **THEN** the workflow result, persisted state, and compensation decision MUST remain unchanged

#### Scenario: Runtime adapters are verified

- **WHEN** deterministic or Cloudflare runtime behavior changes
- **THEN** both adapters MUST satisfy shared service-level conformance cases in addition to their adapter-specific recovery and platform tests

### Requirement: Workflow metadata storage is optional and database-agnostic

The platform SHALL allow workflow adapters to persist supplemental metadata, indexes, or projections in a database when needed, but database storage MUST NOT be the defining execution source of truth for the workflow contract.

#### Scenario: Deployment uses PostgreSQL instead of D1 for metadata

- **WHEN** a deployment chooses PostgreSQL or another supported database for workflow metadata or reporting
- **THEN** the workflow runtime contract MUST remain valid without requiring workflow execution semantics to be redefined around that database

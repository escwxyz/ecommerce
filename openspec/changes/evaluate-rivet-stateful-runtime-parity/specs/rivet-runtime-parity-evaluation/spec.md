## ADDED Requirements

### Requirement: Portable contract conformance
The Rivet evaluation adapter SHALL implement the existing platform-neutral
keyed actor, timer, state persistence, and workflow coordination contracts
without exposing Rivet types to core or commerce modules.

#### Scenario: Rivet prototype is composed
- **WHEN** the evaluation runtime is built and its import boundaries are checked
- **THEN** core and module packages MUST remain free of Rivet SDK and runtime imports

### Requirement: Consistency and idempotency parity
The evaluation SHALL run identical concurrency and at-least-once delivery tests
against Rivet and the current Cloudflare Durable Object adapter.

#### Scenario: Concurrent duplicate commands target one actor
- **WHEN** commands with the same idempotency identity arrive concurrently or are redelivered
- **THEN** each adapter MUST produce one serialized mutation and the same durable result for every duplicate

### Requirement: Recovery semantics parity
The evaluation SHALL prove interruption, typed retry, replay, compensation,
actor restart, state recovery, and timer recovery behavior against the shared
task-9.9 recovery fixtures.

#### Scenario: Runtime stops after a durable outcome
- **WHEN** execution resumes on a new runtime or actor instance
- **THEN** completed side effects MUST NOT repeat and pending retry, compensation, or timer work MUST recover from durable state

#### Scenario: Effect work is interrupted
- **WHEN** an executing step or adapter operation is interrupted
- **THEN** interruption MUST remain distinct from typed failure and defect and MUST NOT trigger terminal compensation solely because of the interruption

### Requirement: State ownership safety
The evaluation SHALL preserve PostgreSQL authority and the accepted
stateful-workload ownership matrix.

#### Scenario: Prototype persists actor-local state
- **WHEN** Rivet stores coordination, cache, workflow-history, timer, or fanout state
- **THEN** its recovery source and ownership classification MUST match the accepted matrix and commerce relational records MUST remain PostgreSQL-owned

### Requirement: Placement and latency evidence
The evaluation SHALL collect comparable placement and latency evidence using
documented commerce workloads, payloads, concurrency, regions, sample counts,
warm/cold conditions, percentile distributions, and error rates.

#### Scenario: Runtime latency is compared
- **WHEN** Cloudflare and Rivet benchmark results are published
- **THEN** the evidence MUST disclose the placement and methodology needed to reproduce the comparison and MUST mark non-comparable results as unknown

### Requirement: Deployment and operations evidence
The evaluation SHALL compare local development, staging, deployment, rollback,
resource migration, timers, observability, incident diagnosis, capacity limits,
availability behavior, and ongoing operational ownership.

#### Scenario: Operator evaluates production readiness
- **WHEN** the operations evidence is reviewed
- **THEN** it MUST identify required tooling, credentials, runbooks, failure modes, recovery actions, and unsupported operational gaps for each runtime

### Requirement: Cost evidence
The evaluation SHALL compare request, compute or duration, storage, timer,
network or egress, minimum-spend, and operational-labor costs using one
documented workload model and pricing date.

#### Scenario: Runtime cost is compared
- **WHEN** the cost model is published
- **THEN** it MUST state workload assumptions, unit prices, exclusions, uncertainty, and projected totals for both runtimes

### Requirement: Evidence-gated decision
The evaluation SHALL treat consistency, schema-boundary safety, idempotency,
interruption classification, restart recovery, and timer recovery as mandatory
gates and SHALL conclude with an explicit adopt, defer, or reject decision.

#### Scenario: Evaluation concludes
- **WHEN** all available evidence is reviewed
- **THEN** the decision record MUST identify each passed, failed, or unknown gate and an adopt decision MUST create a separate production-adoption change

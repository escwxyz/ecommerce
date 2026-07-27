## Context

The platform currently implements its portable keyed-actor contracts with
Cloudflare Durable Objects and keeps PostgreSQL authoritative for commerce
records. The task-9.9 recovery suite establishes the minimum behavioral
baseline: interruption does not become failure, retry/replay retain durable
outcomes, duplicate delivery does not repeat mutation, compensation is
idempotent, and actor/timer state survives host restart.

Rivet may offer a less vendor-specific actor runtime and additional deployment
options, but the project has not yet proven that its consistency, recovery, and
operational model matches the accepted commerce workloads. Rivet and its APIs
may also evolve before this deferred change starts.

## Goals / Non-Goals

**Goals:**

- Compare Rivet and the current Durable Object adapter with the same portable
  contracts, message schemas, workloads, failure injection, and recovery
  assertions.
- Produce reproducible evidence for consistency, recovery, placement, latency,
  deployment, observability, operations, and cost.
- Keep the evaluation adapter isolated from commerce modules and the production
  composition.
- End with an explicit adopt, defer, or reject decision and the evidence behind
  it.

**Non-Goals:**

- Replacing Durable Objects or changing production traffic during evaluation.
- Transferring relational authority from PostgreSQL to actor-local storage.
- Redesigning the platform-neutral actor/workflow contracts to mirror a Rivet
  SDK.
- Treating a successful prototype as production adoption without a separate
  accepted change.

## Decisions

### 1. Evaluate contract parity, not SDK feature count

The prototype SHALL implement the existing keyed actor, timer, state-store, and
workflow coordination services. Both adapters run the same conformance suite,
including concurrent commands, duplicate delivery, interruption, retry,
replay, compensation, process/actor restart, timer recovery, invalid messages,
and storage corruption.

Alternative considered: compare vendor feature matrices. Rejected because
feature availability does not prove commerce behavior or recovery semantics.

### 2. Preserve current state ownership

PostgreSQL remains authoritative for commerce records and queryable workflow
metadata. Rivet actor-local state is limited to the classifications already
accepted for actor-local coordination, cache, workflow history, timers, and
fanout. Any proposed ownership transfer fails this evaluation and requires its
own design.

Alternative considered: use the prototype to redesign state ownership.
Rejected because it would make runtime parity impossible to isolate.

### 3. Use representative workload fixtures

The evaluation covers at least:

- serialized cart mutation with idempotent duplicate delivery;
- inventory or checkout coordination under concurrent commands;
- workflow interruption, retry, replay, and compensation;
- durable timers across actor eviction/restart and delayed delivery;
- notification fanout or subscription coordination;
- malformed and obsolete durable messages.

Workloads use fixed payload sizes and concurrency levels for correctness runs,
then a documented load matrix for latency and cost measurements.

Alternative considered: benchmark a no-op actor only. Rejected because it
understates storage, recovery, serialization, and message-boundary costs.

### 4. Separate hard gates from scored trade-offs

Correctness and boundary safety are hard gates. Rivet MUST pass schema
decoding, single-writer consistency, idempotency, restart/timer recovery,
interruption classification, and no-runtime-leak import checks before
performance or cost can justify adoption.

Latency, placement, deployment ergonomics, observability, operational burden,
and cost are measured and scored against a documented baseline. No single
favorable score can override a failed correctness gate.

Alternative considered: use a weighted score for all criteria. Rejected
because consistency or recovery failures cannot be compensated by lower cost.

### 5. Measure comparable environments and disclose uncertainty

Latency evidence records region/placement, warm and cold samples, payload size,
concurrency, percentile distribution, error rate, and sample count. Cost
evidence states pricing date, workload assumptions, storage, requests,
compute/duration, egress, minimum spend, and operational labor assumptions.
Deployment and operations evidence covers local development, staging,
rollbacks, migrations, alarms/timers, observability, incident diagnosis,
capacity limits, and vendor outage handling.

Measurements that cannot be made comparably are marked unknown rather than
estimated silently.

### 6. Adoption requires a follow-up change

The evaluation concludes with one of:

- `adopt`: parity gates pass and a separate production-adoption proposal is
  recommended;
- `defer`: evidence is incomplete or ecosystem maturity is insufficient;
- `reject`: a hard gate fails or trade-offs are unacceptable.

The prototype remains non-production and removable until a distinct adoption
change is accepted.

## Risks / Trade-offs

- [Rivet APIs or pricing change during the deferred period] → Pin the evaluated
  version/date and refresh external facts at execution time.
- [Cloud environments are not directly comparable] → Record placement,
  resource limits, sample methodology, and uncertainty with every result.
- [A prototype accidentally becomes a production dependency] → Isolate it in
  an adapter/prototype package and prohibit imports from production
  composition.
- [Benchmarks optimize synthetic behavior] → Require the representative
  commerce fixtures before load measurements.
- [Operational cost is understated] → Include deployment, diagnosis,
  observability, on-call, and migration effort in the decision record.
- [Vendor portability weakens contract design] → Change core contracts only
  through a separate accepted proposal based on proven cross-runtime needs.

## Migration Plan

1. Refresh Rivet documentation, support status, pricing, limits, and deployment
   options at evaluation time.
2. Freeze the Durable Object baseline version and shared workload/load matrix.
3. Build an isolated Rivet adapter prototype for the existing portable
   contracts.
4. Run correctness, recovery, boundary, and failure-injection gates.
5. Run comparable latency, placement, deployment, operations, and cost
   measurements only after correctness passes.
6. Publish the evidence matrix and adopt/defer/reject decision.
7. Remove the prototype after a reject decision, retain it as explicitly
   experimental after defer, or create a separate adoption change after adopt.

Rollback is deletion of the isolated prototype and evaluation resources; the
Cloudflare production composition remains unchanged throughout.

## Open Questions

- Which Rivet product/API surface and deployment modes are supported when the
  deferred evaluation starts?
- Which Cloudflare and Rivet regions or placement controls form the fairest
  comparison?
- What production-shaped request, storage, timer, and concurrency assumptions
  should drive the cost model?
- Which operational requirements are mandatory before an alternate runtime can
  enter the production support matrix?

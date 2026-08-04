## 1. Evaluation Baseline

- [ ] 1.1 Refresh and record the evaluated Rivet version, supported runtimes, deployment modes, limits, pricing date, and operational prerequisites from official sources
- [ ] 1.2 Freeze the Cloudflare Durable Object baseline and define representative cart, inventory/checkout, workflow, timer, and notification-fanout fixtures
- [ ] 1.3 Define the correctness gates, load matrix, placement assumptions, evidence format, and adopt/defer/reject decision rubric

## 2. Isolated Rivet Prototype

- [ ] 2.1 Create an experimental adapter package that implements the existing keyed actor, timer, state-store, and workflow coordination contracts
- [ ] 2.2 Keep Rivet dependencies and runtime types out of core, commerce modules, public API contracts, and production composition through import-boundary tests
- [ ] 2.3 Implement schema decoding, typed adapter failures, telemetry correlation, resource lifecycle, and test configuration for the prototype

## 3. Correctness and Recovery Parity

- [ ] 3.1 Run identical serialized mutation and concurrent duplicate-delivery contract suites against Durable Objects and Rivet
- [ ] 3.2 Verify Effect interruption remains distinct from typed failure and defect in both adapters
- [ ] 3.3 Verify retry, replay, completed-side-effect deduplication, and compensation recovery across runtime restart
- [ ] 3.4 Verify actor eviction/restart, durable state recovery, timer recovery, delayed alarms, and malformed or obsolete durable messages
- [ ] 3.5 Audit every prototype workload against the accepted PostgreSQL versus actor-local ownership matrix

## 4. Performance and Operational Evidence

- [ ] 4.1 Measure warm and cold latency percentiles, throughput, error rate, and placement behavior with documented payload, concurrency, region, and sample parameters
- [ ] 4.2 Compare local development, deployment, rollback, resource migration, observability, incident diagnosis, capacity limits, availability behavior, and required runbooks
- [ ] 4.3 Build a dated cost model covering requests, compute or duration, storage, timers, network or egress, minimum spend, and operational labor
- [ ] 4.4 Mark non-comparable or unavailable evidence as unknown and document the uncertainty rather than substituting assumptions

## 5. Decision and Cleanup

- [ ] 5.1 Publish the requirement-by-requirement evidence matrix with every hard gate marked passed, failed, or unknown
- [ ] 5.2 Record an adopt, defer, or reject decision with rationale and operational ownership
- [ ] 5.3 Remove evaluation resources after rejection, document retained experimental scope after deferral, or create a separate production-adoption change after adoption
- [ ] 5.4 Run OpenSpec validation and sync the roadmap and stateful runtime documentation with the final decision

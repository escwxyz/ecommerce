## MODIFIED Requirements

### Requirement: Workflow definitions declare executable orchestration boundaries
Cross-module operations SHALL be Effect workflows with schema-versioned inputs, typed step failures, declared requirements, retry policy, compensation, and observable execution identity.

#### Scenario: Checkout coordinates multiple modules
- **WHEN** checkout invokes inventory, payment, fulfillment, and order operations
- **THEN** each operation MUST execute as a declared idempotent workflow step rather than a distributed transaction

### Requirement: Checkout exposes one Effect-native orchestration seam
Checkout SHALL consume participating commerce modules through their public Effect services and SHALL NOT require callers to construct Promise facades, execute nested Effect runtimes, translate development seed identifiers, or cast broad records into module inputs.

#### Scenario: Checkout completes or compensates a cart
- **WHEN** a caller invokes `CheckoutService.completeCheckout`
- **THEN** sequencing, typed expected-error translation, idempotency, event publication, interruption, and compensation MUST remain inside that Effect

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

#### Scenario: Checkout completion event publication is interrupted
- **WHEN** Checkout records a terminal completion but its completion event has not yet been durably accepted by the outbox
- **THEN** a retry MUST replay the stored completion event with the same event identity and MUST NOT repeat completed commerce side effects

#### Scenario: Checkout terminal persistence is uncertain
- **WHEN** terminal completion persistence fails after Checkout has invoked committed commerce side effects
- **THEN** the completion claim MUST remain recoverable and uncertain, and retries MUST NOT reacquire the idempotency key or repeat those side effects

#### Scenario: Checkout is interrupted after acquiring its claim
- **WHEN** cancellation arrives after Checkout acquires its idempotency claim but before it starts orchestration
- **THEN** cleanup MUST release the claim so a later checkout can acquire it

### Requirement: Workflow runtime remains adapter-based with Cloudflare primitives first
Workflow contracts SHALL remain platform-neutral while Cloudflare Queues, Workflows, and Durable Objects provide the first production runtime Layers.

#### Scenario: Workflow is tested locally
- **WHEN** a workflow test provides deterministic runtime services
- **THEN** it MUST execute retry, compensation, and recovery behavior without Cloudflare bindings

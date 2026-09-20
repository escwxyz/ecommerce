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

#### Scenario: Checkout taxes a promotion-discounted cart
- **WHEN** Checkout calculates a nonzero promotion discount for priced cart lines
- **THEN** the discounted line subtotals MUST be the authoritative tax basis
- **AND THEN** Checkout MUST allocate the discount across those same lines before tax calculation, preserve each line identity and quantity, and reconcile the allocated tax bases exactly to the discounted cart subtotal

#### Scenario: Checkout stores an inexact unit-price division
- **WHEN** a calculated checkout line total cannot be divided evenly by its quantity in minor currency units
- **THEN** the Order line MUST retain that calculated total as authoritative and persist `Math.round(total / quantity)` as its integer unit price, using nearest-integer rounding with half values toward positive infinity
- **AND THEN** line metadata MUST record `unitPriceRemainderMinorUnits = total - (roundedUnitPrice * quantity)` as a signed integer so `total = (unitPrice * quantity) + unitPriceRemainderMinorUnits`
- **AND THEN** a total of `100` with quantity `3` MUST persist unit price `33` and remainder `1`

#### Scenario: Checkout fails after payment authorization
- **WHEN** Checkout fails after authorizing a payment session and before capture
- **THEN** it MUST void or cancel that authorization through a provider-backed, idempotent payment operation before releasing inventory reservations
- **AND THEN** the operation MUST accept the authorization payment identifier and a dedicated compensation idempotency key
- **AND THEN** Checkout MUST NOT mark compensation complete unless the provider confirms the authorization is canceled; a refund is not a substitute for canceling an uncaptured authorization

### Requirement: Workflow runs support idempotent execution state
Workflow runtimes SHALL persist step attempts and outcomes so replay after interruption does not duplicate completed side effects.

The durable Checkout claim SHALL use these states and transitions:

| State | Meaning | Allowed transitions |
| --- | --- | --- |
| `pre-orchestration` | The idempotency key is owned, but no commerce orchestration has started. | `orchestration`, or release to no claim. |
| `orchestration` | Commerce orchestration has durably started for the stored workflow run. | `completed` after terminal result and completion event are persisted together, or `uncertain` when that terminal persistence cannot be confirmed. |
| `completed` | The terminal result and stable completion-event identity and payload are durable. | Remains `completed`; pending event publication may advance only the event status to persisted. |
| `uncertain` | Commerce side effects completed, but terminal result persistence was not confirmed. The state retains the same result and completion-event identity and payload. | `completed` after retry confirms terminal persistence, using the existing claim. |

Release SHALL be legal only from `pre-orchestration`. The adapter MUST reject or ignore release from `orchestration`, `completed`, or `uncertain`.

#### Scenario: Checkout begins orchestration
- **WHEN** Checkout has decoded pre-orchestration inputs and is ready to invoke its first commerce operation
- **THEN** it MUST durably transition the owned claim from `pre-orchestration` to `orchestration` before invoking that operation

#### Scenario: Checkout releases before orchestration
- **WHEN** Checkout is interrupted or input decoding fails while its claim remains `pre-orchestration`
- **THEN** it MUST release the claim only after verifying orchestration never started

#### Scenario: Checkout retry finds orchestration in progress
- **WHEN** a retry finds an `orchestration` claim
- **THEN** it MUST preserve the existing workflow run identity and resume through persisted workflow step outcomes rather than reacquire the idempotency key or start a new run

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
- **THEN** the completion claim MUST retain the result plus the stable completion-event identity and payload in `uncertain`
- **AND THEN** a retry MUST find that same claim, persist it as `completed`, and publish the retained pending event without reacquiring the idempotency key or repeating commerce side effects

#### Scenario: Checkout is interrupted after acquiring its claim
- **WHEN** cancellation arrives after Checkout acquires its idempotency claim but before it starts orchestration
- **THEN** cleanup MUST verify the claim is still `pre-orchestration` and release it so a later checkout can acquire it

### Requirement: Workflow runtime remains adapter-based with Cloudflare primitives first
Workflow contracts SHALL remain platform-neutral while Cloudflare Queues, Workflows, and Durable Objects provide the first production runtime Layers.

#### Scenario: Workflow is tested locally
- **WHEN** a workflow test provides deterministic runtime services
- **THEN** it MUST execute retry, compensation, and recovery behavior without Cloudflare bindings

### Requirement: Workflow runtime operations use one Effect execution model
`WorkflowRuntimeService` SHALL expose `start`, `get`, `dedupe`, and `reconcile` as typed Effects. Workflow state storage, metadata projections, and lifecycle publication SHALL also expose Effects. Lookup absence SHALL succeed with `Option.none`. Runtime-neutral workflow execution SHALL NOT invoke a nested Effect runtime or branch on Promise-or-value contracts.

#### Scenario: Caller starts a workflow requiring a service
- **WHEN** a workflow step declares an Effect requirement
- **THEN** the runtime start Effect MUST preserve that requirement until an enclosing Layer provides it

#### Scenario: Persistence fails during lookup
- **WHEN** the state or metadata adapter cannot read a workflow
- **THEN** lookup MUST return a schema-backed operation-specific failure rather than an empty optional result

#### Scenario: Running workflow is interrupted
- **WHEN** an executing fiber is interrupted during a step or retry delay
- **THEN** the runtime MUST preserve completed outcomes and the interruption Cause without recording a false failed step or triggering terminal compensation

#### Scenario: Workflow fails with a defect
- **WHEN** a step dies with a programming defect
- **THEN** the runtime MUST preserve the defect Cause rather than translate it to an expected business rejection

#### Scenario: Duplicate starts race
- **WHEN** concurrent starts use the same workflow and idempotency key
- **THEN** atomic registration MUST converge on one logical run

#### Scenario: Adapter reports stale metadata
- **WHEN** durable run state contains more complete execution progress than metadata
- **THEN** recovery MUST use durable state as the replay authority

#### Scenario: Dispatch or lifecycle publication is interrupted
- **WHEN** a registered Cloudflare run or persisted lifecycle checkpoint is retried
- **THEN** the adapter MUST resume from the last durable dispatch stage and lifecycle publishers MUST deduplicate the stable event envelope ID

#### Scenario: Workflow implementation and payload schema evolve independently
- **WHEN** a workflow definition changes its implementation version without changing its persisted payload schema, or changes its payload schema independently
- **THEN** the runtime MUST persist and validate the workflow version and schema version as distinct values

#### Scenario: Telemetry exporter fails
- **WHEN** a workflow telemetry exporter fails or does not complete within its bound
- **THEN** observation MUST NOT change the workflow result or compensation decision

#### Scenario: Platform request supports cancellation
- **WHEN** the enclosing workflow Effect is interrupted
- **THEN** the Cloudflare adapter MUST propagate cancellation to supported requests and release scoped resources
- **AND THEN** non-cancellable Workflow and Queue operations MUST remain subject to durable reconciliation

#### Scenario: Both runtime adapters are verified
- **WHEN** runtime changes are accepted
- **THEN** deterministic and Cloudflare adapters MUST run shared service conformance cases, with adapter-specific recovery, typed failure, and lifecycle tests preserving their execution semantics

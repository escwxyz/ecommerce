## Context

`define-cloudflare-commerce-blueprint` established that workflow and event primitives must exist before cart, checkout, and order orchestration can be added. The repository now has the early kernel artifacts from `bootstrap-core-runtime-kernel`: `packages/core` already defines minimal event envelopes, workflow step types, module contribution slots, and an event publisher service tag. Those types are intentionally thin and do not yet define the operational rules that later module slices need.

The next implementation slice must answer three concrete questions:

- what a workflow definition is allowed to declare
- how workflow execution state is stored and resumed
- what event metadata and publication guarantees modules can rely on

Constraints:

- Workflow and event contracts must stay inside `packages/core` and remain free of Cloudflare runtime bindings, Hono transport types, and concrete Drizzle adapter imports.
- The first execution adapter must align with the Cloudflare-first platform direction while still preserving a clean adapter seam for future non-Cloudflare implementations.
- Database storage may hold supplemental workflow metadata, but database choice must not define the core execution model for workflows.
- The change must be small enough to support the next vertical slices rather than attempting a full Medusa-grade orchestration engine.
- Domain modules and plugins need a shared vocabulary for causation, correlation, idempotency, compensation, and runtime capabilities before they add their own private conventions.

## Goals / Non-Goals

**Goals:**

- Define the baseline workflow definition, execution, and compensation contracts that cross-module commerce processes will use.
- Define a baseline domain event contract with consistent envelope metadata and publication expectations.
- Resolve the initial workflow runtime approach as a core contract plus a Cloudflare execution adapter that wraps native workflow primitives behind a cleaner API.
- Specify how workflows and events connect so module orchestration remains observable and replay-safe.
- Keep the design compatible with Effect service composition and the existing `packages/core` kernel layout.

**Non-Goals:**

- Implement checkout, cart completion, order placement, or any other product-facing workflow.
- Replace or reimplement Cloudflare-native orchestration primitives from scratch in this slice.
- Finalize every commerce event name or every future event subscription API detail.
- Add Cloudflare-specific execution semantics directly into `packages/core`.
- Guarantee exactly-once delivery across external infrastructure boundaries in the first slice.

## Decisions

1. Separate workflow definition contracts from workflow runtime adapters.

   `packages/core` should own the workflow vocabulary: workflow definitions, step definitions, compensation metadata, workflow run state enums, attempt records, runtime capability contracts, and service contracts for starting, observing, and reconciling workflow runs. Concrete execution and persistence remain outside core. This keeps orchestration semantics reusable by modules, the server composition layer, plugins, and tests without coupling them to a specific Cloudflare primitive or database adapter.

   Alternative considered: put runtime semantics directly into a Cloudflare-only package. Rejected because workflow semantics would become platform-defined instead of core-defined, making future adapters and plugin reuse harder.

2. Model workflows as named definitions with explicit execution identity and step-level idempotency.

   A workflow definition should declare:
   - workflow key
   - ordered step definitions
   - stable step names
   - optional compensation for each step
   - input/output contracts at the type level

   A workflow run should carry:
   - run id
   - workflow key and workflow version
   - correlation id
   - causation id when triggered by an event or another workflow
   - optional idempotency key scoped to the workflow trigger
   - step attempt history or adapter-backed execution history reference
   - observable status such as `pending`, `running`, `completed`, `failed`, `compensating`, and `compensated`

   The system does not need global exactly-once semantics, but it does need a deterministic way to recognize duplicate workflow triggers and duplicate step execution attempts.

   Alternative considered: keep idempotency as an application concern handled separately by each module. Rejected because checkout- and order-adjacent workflows would otherwise invent incompatible retry rules.

3. Define compensation as reverse-order recovery metadata, not a general saga engine.

   Compensation should be modeled only for steps that declare reversible side effects. When a workflow fails after one or more compensatable steps complete, compensation must run in reverse completed-step order using the recorded step outputs or adapter-managed compensation payload needed for reversal. This is enough to define the contract and test expectations without building a complex distributed workflow runtime.

   Alternative considered: defer compensation until order/checkout implementation. Rejected because workflow boundaries and emitted events depend on whether failed side effects can be reversed or must remain terminal.

4. Standardize event envelopes around traceability and orchestration metadata.

   The current event envelope should be extended to include the metadata that workflows and module integrations need:
   - event id
   - event name
   - payload
   - emitted timestamp
   - source module
   - optional subject or aggregate reference
   - correlation id
   - causation id
   - optional workflow run id

   The envelope is the shared contract for domain events, workflow lifecycle events, and adapter-published events. This makes downstream auditing and replay decisions possible without coupling modules to a transport implementation.

   Alternative considered: leave only `id`, `name`, and `payload` in the core contract and let each workflow/event producer add ad hoc metadata. Rejected because observability and replay safety require one shared minimum shape.

5. Publish workflow lifecycle and domain events through one event publisher contract.

   The first slice should not introduce separate event buses for workflow internals versus domain events. Instead, workflow execution emits lifecycle events such as `workflow.started`, `workflow.step-succeeded`, `workflow.failed`, and `workflow.compensated` through the same event publisher service contract used for domain events. Modules can then observe orchestration without a second event abstraction.

   Alternative considered: use a private workflow event stream distinct from domain events. Rejected because it duplicates infrastructure and hides orchestration evidence from modules and operators.

6. Use a Cloudflare execution adapter that wraps native workflows, queues, and Durable Objects behind a cleaner runtime API.

   The initial runtime plan should be:
   - a workflow runtime contract in `packages/core`
   - an in-memory implementation for tests and non-Cloudflare verification
   - a Cloudflare platform adapter that composes existing Workflow, Queue, and Durable Object primitives behind the shared runtime contract

   The Cloudflare adapter should treat native platform primitives as the execution substrate, not as the public application API. Workflows can own durable orchestration, Queues can handle asynchronous dispatch where needed, and Durable Objects can coordinate run-local serialization or recovery when platform semantics require it. This preserves the Cloudflare-first deployment target while keeping the public workflow surface portable.

   Alternative considered: make D1 the primary workflow engine and treat Cloudflare primitives as later optimizations. Rejected because database choice should not become the orchestration model, especially when the platform already offers workflow-native primitives.

7. Treat database storage as optional workflow metadata or indexing, not the execution source of truth.

   Database adapters may store searchable metadata such as run indexes, audit projections, plugin-facing lookup records, or business-level snapshots when needed. That storage must remain supplemental to the workflow runtime contract rather than defining workflow execution semantics. This keeps PostgreSQL, D1, or future adapters viable for metadata without forcing every runtime to use the same persistence engine for orchestration.

   Alternative considered: require a database-backed workflow run repository as the mandatory durable source of truth. Rejected because it overfits the workflow layer to one storage family and makes Cloudflare-native execution look like an afterthought.

8. Treat event publication guarantees as at-least-once with idempotent consumers and adapter-defined durability.

   The first slice should require stable event identity, correlation metadata, and idempotent consumer expectations. The Cloudflare runtime adapter is responsible for mapping lifecycle transitions onto platform durability semantics, while leaving room for future outbox-style or cross-platform guarantees without redefining the core contracts now.

   Alternative considered: require transactional event outbox semantics in the initial slice. Rejected because the repo is not yet ready to standardize that across runtime adapters, and doing so now would delay the workflow primitives change well beyond its intended scope.

## Risks / Trade-offs

- A Cloudflare-native execution adapter may expose platform-specific limits or semantics -> Mitigation: keep those details inside the adapter boundary and expose only portable workflow concepts from `packages/core`.
- At-least-once publication means consumers must be idempotent -> Mitigation: require stable event ids, correlation metadata, and explicit idempotency keys in the spec.
- Compensation can give a false sense of reversibility -> Mitigation: require compensation only for steps that declare reversible side effects and treat uncompensated failure as an explicit terminal state.
- Shared lifecycle events may create noisy observability streams -> Mitigation: standardize a small required lifecycle event set and allow later filtering/transport choices outside core.
- Adding workflow status and attempt models now may require later evolution -> Mitigation: define the minimum state machine that supports retries, compensation, auditability, and plugin-facing metadata rather than a fully generic orchestrator model.

## Migration Plan

1. Extend `packages/core` workflow and event contracts to include the new definition, metadata, runtime, and observation surfaces described here.
2. Add in-memory runtime test doubles and targeted tests that prove duplicate-trigger detection, state transitions, and reverse-order compensation expectations.
3. Add a Cloudflare runtime adapter that wraps native Workflow, Queue, and Durable Object primitives behind the shared runtime contract.
4. Add optional metadata projection hooks so runtime adapters can persist searchable workflow metadata in a database without making that database the execution source of truth.
5. Wire workflow lifecycle event publication through the existing event publisher service contract.
6. Keep current minimal kernel exports compatible where practical, then migrate internal consumers to the richer contracts.
7. Defer stronger cross-platform delivery guarantees and non-Cloudflare runtime adapters to follow-up changes once the first domain workflow exists.

Rollback is low-risk: revert the new workflow/event contracts and any Cloudflare runtime adapter additions. No customer-facing domain workflows depend on this change yet.

## Open Questions

- Which parts of run history should the Cloudflare adapter expose directly versus projecting into optional metadata storage?
- Should workflow lifecycle events live in the same namespace as domain events, or reserve a dedicated `workflow.*` prefix from the start?
- Which retry metadata belongs in the first contract: attempt count only, or also backoff hints and terminal failure classification?

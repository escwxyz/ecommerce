# Cloudflare Stateful Runtime Notes

Read this with the current `adopt-effect-4-backend-architecture` design and
stateful-runtime delta spec. The earlier
`define-cloudflare-stateful-runtime-primitives` change is historical context.

## Durable Object Role

Durable Objects are the first Cloudflare adapter for runtime-neutral Effect
actor and coordination services. They handle highly mutable commerce state
that needs serialized mutation, uniqueness, expiration, or local fanout. They
are not the default primary record store for long-lived commerce records.

Use a Durable Object-backed coordinator when a future module needs to protect a
small, high-contention state scope such as:

- cart mutation and cart expiration
- inventory reservation and release
- checkout attempt coordination
- webhook delivery cursor or retry state
- per-tenant event fanout or subscription state

Keep durable business records behind repository/database contracts unless a
module-specific design explicitly chooses a DO-owned primary record.

The normative per-workload owner and recovery matrix lives in
[`stateful-workload-ownership.md`](./stateful-workload-ownership.md). A platform
adapter choice such as key-value Durable Object storage, raw SQLite, or Effect
SQL SQLite does not change that ownership declaration.

## Effect SQL Durable Object SQLite

Task 9.7 approves `@effect/sql-sqlite-do` for actor-local state that benefits
from relational queries, indexes, migrations, or multi-statement
transactions. The reviewed beta.93 client must receive the full
`ctx.storage` handle when transactions are required; passing only
`ctx.storage.sql` provides queries without Cloudflare-managed transaction
support.

The current keyed-actor key-value layout remains in place because its command
results, single snapshot, and timer set do not yet justify another dependency
or storage migration. Notification realtime is the first concrete conversion
candidate because it already owns actor-local raw SQLite tables. Any adoption
must exact-pin the package to the workspace Effect cohort and pass the
task-9.9 restart and recovery suite.

## Merchant Reference Pattern

`refs/merchant/src/do.ts` is a useful Cloudflare-native reference, but its
schema is not the target module schema. Reuse these infrastructure lessons:

- one Durable Object owns serialized mutation for a scoped merchant/runtime key
- local SQL storage can support fast mutation and cleanup inside the DO
- cart expiration should release reserved inventory as part of one serialized
  operation
- event and webhook delivery state benefits from local sequencing and retries
- WebSocket/event fanout belongs behind a platform adapter, not in pure modules

Do not copy its cart, inventory, payment, discount, or order tables into module
packages. Future module changes must define their own domain schema and decide
which state is primary relational data versus coordination state.

## Queue Role

Queues carry asynchronous work with stable metadata:

- message id
- idempotency key
- correlation id
- optional causation id
- optional workflow run id
- optional subject

Consumers must decode messages with Effect Schema, assume at-least-once
delivery, and deduplicate by idempotency key or a stronger domain-specific key.
Typed rejections, defects, interruptions, retries, compensation, and poison
messages retain distinct `commerce_runtime_event_total` classifications.

## Workflow Relationship

Effect workflows remain the orchestration contract. Queue and Durable Object
Layers are runtime primitives called through portable Effect services.
PostgreSQL, accessed through Effect SQL and Drizzle, is the default
authoritative relational store and may persist workflow metadata or
transactional outbox records, but it is not by itself the workflow execution
engine.

As of tasks 9.1 through 9.5, `@ecommerce/core` owns the portable durable-message
schemas for workflow descriptors, run state, step outcomes, retry policy,
retry disposition, and compensation policy. Its deterministic in-memory runtime
persists that state, resumes by run id or idempotency key, skips already
completed step outcomes, and records failed plus compensated outcomes for
replay tests. `@ecommerce/platform-cloudflare` now exposes Cloudflare workflow
and queue adapters through runtime-neutral Effect service Layers, normalizes
Cloudflare binding, queue, coordinator, state, metadata, and lifecycle-event
failures to schema-backed tagged errors, records bounded telemetry events, and
persists workflow run state through the portable state-store contract when one
is provided. The runtime-neutral outbox delivery cycle now claims bounded
post-commit batches, preserves the outbox record id and domain idempotency key
in the Cloudflare queue envelope, acknowledges only after publish success, and
persists queue rejection as a typed failed delivery. Replay therefore produces
the same queue identity for at-least-once consumer deduplication. The Cloudflare
workflow adapter still delegates execution to Cloudflare Workflows, and the
deployed Worker still needs PostgreSQL-backed outbox Layer plus scheduled-drain
composition before production traffic uses this path.

Task 9.5 also defines the permanent keyed actor boundary in
`@ecommerce/core/stateful`:

- `KeyedActorCommandSchema` and `KeyedActorCommandResultSchema` carry
  schema-versioned actor identity, command identity, correlation,
  idempotency, optional causation/workflow/subject metadata, output, duplicate
  status, and state version.
- `KeyedActorTimerSchema` stores the complete command envelope with stable
  timer identity plus canonical scheduled and due timestamps.
- `KeyedActorStateSnapshotSchema` binds versioned state to an explicit
  `KeyedActorStateOwnershipSchema` declaration.
- `KeyedActorService`, `KeyedActorTimerService`, and
  `KeyedActorStateStoreService` are Effect service tags with schema-backed
  command, timer, and persistence failures.
- The deterministic in-memory test Layer scopes deduplication and timers by
  actor key, versions actor-local state, and requires no Cloudflare runtime.

Ownership declarations distinguish cache, coordination, workflow, and
relational-record state; name PostgreSQL or actor-local ownership; and declare
the recovery source. Actor-local relational authority is invalid unless an
accepted design reference explicitly transfers it. This guard prevents a
Durable Object adapter from silently becoming a second commerce system of
record.

Task 9.6 implements the first permanent Cloudflare actor adapter:

- `createCloudflareKeyedActorLayer` provides `KeyedActorService`,
  `KeyedActorTimerService`, and `KeyedActorStateStoreService` over a Durable
  Object namespace.
- The Layer derives a stable object name from actor type and key, decodes every
  response, and translates binding, HTTP, JSON, and schema failures to the
  corresponding schema-backed core error.
- `createKeyedActorDurableObjectHandler` is the reusable Effect host for a
  concrete actor class. It decodes all request and stored values, serializes
  turns, persists command results for durable idempotency, atomically stores a
  changed state snapshot with its result, and stores multiple timers while
  programming Cloudflare's single alarm to the earliest due time.
- `KeyedActorDurableObject` is the first coordination host. Its default command
  interpreter acknowledges commands with `null`; commerce-specific actors must
  provide their own typed handler rather than add command-name branching to
  runtime-neutral core.

The old Promise coordinator remains only at cart and inventory's temporary
migration input. Its Cloudflare facade now dispatches through the permanent
Effect Layer and schema protocol. Task 12.5 removes that facade, the legacy
core types, and the temporary class export alias.

As of the task-12 cleanup audit on 2026-08-03, those temporary stateful
bridges have been removed from the completed backend surface. Future
stateful-runtime work should compose through the permanent Effect workflow,
queue, outbox, and keyed-actor contracts rather than restoring Promise
coordinator aliases or legacy server-side route shims.

Task 9.9 completes the portable and Cloudflare recovery gate:

- actual Effect interruption leaves a workflow resumable and does not record a
  failed step or trigger compensation;
- declared retry policies execute up to their bounded attempt limit and persist
  retry dispositions plus scheduled backoff metadata;
- workflow replay reuses completed outcomes and terminal compensation;
- outbox replay preserves stable queue and domain idempotency identity;
- restarted actor hosts reuse durable command results and state snapshots; and
- due timers survive actor restart, dispatch once, and are removed only after a
  successful command result is durable.

As of tasks 8.1 through 9.8 in `adopt-effect-4-backend-architecture`, the
normative ownership matrix is maintained in
[`stateful-workload-ownership.md`](./stateful-workload-ownership.md). The
following module summary remains useful:

- PostgreSQL Drizzle owns durable cart, line-item, and adjustment persistence.
- PostgreSQL Drizzle owns durable promotion campaign, promotion, rule, usage
  limit, and redemption persistence.
- PostgreSQL Drizzle owns durable tax category, provider configuration, region,
  and rate persistence.
- PostgreSQL Drizzle owns durable fulfillment provider, fulfillment set,
  shipping profile, service zone, shipping option, fulfillment, shipment, and
  return-shipment-link persistence.
- PostgreSQL Drizzle owns durable payment provider, account-holder, method,
  collection, session, payment, capture, and refund persistence.
- PostgreSQL Drizzle owns durable notification-event outbox, dead-letter,
  provider, template, and dispatch persistence.
- The Cloudflare Durable Object cart cache implements the Effect-native
  active-cache port for hot aggregate reads, ownership checks, idempotency maps,
  and projection-sync failure recording.
- Promotion has no Durable Object or actor-local state owner yet; PostgreSQL is
  authoritative for the migrated promotion slice.
- Tax has no Durable Object or actor-local state owner yet; PostgreSQL is
  authoritative for the migrated tax slice.
- Fulfillment has no Durable Object or actor-local state owner yet; PostgreSQL
  is authoritative for the migrated fulfillment slice.
- Payment has no Durable Object or actor-local state owner yet; PostgreSQL is
  authoritative for the migrated payment slice. Provider calls remain behind the
  Effect-native payment-provider boundary rather than actor-local state.
- Checkout orchestration consumes migrated module services directly through an
  Effect Layer. The server-owned Promise facades and development seed
  substitutions are gone, and deterministic tests exercise success, failure,
  idempotency, compensation, and interruption through one
  `CheckoutService.completeCheckout` Effect. The in-memory completion store is
  test-only and implements atomic claim/complete/release behavior; production
  still requires a durable adapter before exposing the checkout HTTP
  contribution. Clock and identifier services remain explicit Layer
  requirements.
- Order has no Durable Object or actor-local state owner yet. PostgreSQL is
  authoritative for order records, line items, transactions, transitions, and
  post-purchase operations; the Effect Worker foundation currently uses an
  in-memory order Layer until Cloudflare runtime composition wires the
  PostgreSQL adapter.
- Notification-event queue and realtime Cloudflare bridges are platform
  delivery/fanout mechanisms. They are not durable ownership boundaries;
  PostgreSQL remains authoritative for outbox, dead-letter, provider, template,
  and dispatch state until a later accepted workflow/actor design changes that.

Workflow steps must be idempotent, persist replay-relevant outcomes, and define
retry, terminal rejection, and compensation behavior. Module mutations and
their outbox records commit in one local PostgreSQL transaction; cross-module
operations do not use distributed transactions.

## Portability and Rivet

Core actor contracts must not import Cloudflare or Rivet APIs and must have
deterministic test Layers. Rivet is deferred until it demonstrates parity for
consistency, timers, recovery, placement, latency, deployment, operations, and
cost. The apply-ready
`openspec/changes/evaluate-rivet-stateful-runtime-parity/` change defines the
shared workload fixtures, hard correctness gates, measurement evidence, and
adopt/defer/reject decision record. Completing that evaluation cannot replace
the production adapter directly; adoption requires a separate accepted change.

Backpine's Cloudflare Effect packages and `durable-effect` are implementation
references only. Adopted code must pass the selected Effect 4 version,
boundary, and recovery tests.

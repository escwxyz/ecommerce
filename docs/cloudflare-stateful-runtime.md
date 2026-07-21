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
Typed failures, defects, interruptions, retries, and poison messages retain
distinct Effect telemetry classifications.

## Workflow Relationship

Effect workflows remain the orchestration contract. Queue and Durable Object
Layers are runtime primitives called through portable Effect services.
PostgreSQL, accessed through Effect SQL and Drizzle, is the default
authoritative relational store and
may persist workflow metadata or transactional outbox records, but it is not by
itself the workflow execution engine.

As of task 8.1 in `adopt-effect-4-backend-architecture`, cart follows this
split: PostgreSQL Drizzle owns durable cart, line-item, and adjustment
persistence, while the Cloudflare Durable Object cart cache implements the
Effect-native active-cache port for hot aggregate reads, ownership checks,
idempotency maps, and projection-sync failure recording. The server still uses a
temporary checkout-only Promise facade over the Effect cart service until
checkout migrates in task 8.6.

Workflow steps must be idempotent, persist replay-relevant outcomes, and define
retry, terminal rejection, and compensation behavior. Module mutations and
their outbox records commit in one local PostgreSQL transaction; cross-module
operations do not use distributed transactions.

## Portability and Rivet

Core actor contracts must not import Cloudflare or Rivet APIs and must have
deterministic test Layers. Rivet is deferred until it demonstrates parity for
consistency, timers, recovery, placement, latency, deployment, operations, and
cost.

Backpine's Cloudflare Effect packages and `durable-effect` are implementation
references only. Adopted code must pass the selected Effect 4 version,
boundary, and recovery tests.

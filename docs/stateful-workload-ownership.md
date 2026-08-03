# Stateful Workload Ownership

This decision record completes tasks 9.7 and 9.8 of
`adopt-effect-4-backend-architecture`. It defines where durable state is
authoritative, what may be stored inside a Cloudflare Durable Object, and how
actor-local state recovers without becoming a second commerce system of
record.

## Effect SQL Durable Object SQLite decision

`@effect/sql-sqlite-do@4.0.0-beta.93` is compatible with the workspace Effect
cohort and is approved for platform-owned actor-local persistence when a
Durable Object needs relational queries, indexes, schema migrations, or
multi-statement atomic writes.

The reviewed beta.93 adapter:

- provides both the Durable Object-specific `SqliteClient` and generic
  `SqlClient`;
- scopes one SQLite database to one Durable Object identity;
- serializes access through one Effect semaphore;
- uses Cloudflare-managed transactions when constructed with the full
  `ctx.storage` handle;
- rejects nested transactions, does not support `updateValues`, and normalizes
  SQLite blob results from `ArrayBuffer` to `Uint8Array`.

Callers that require transactions must pass `ctx.storage`, not only
`ctx.storage.sql`. Transactions must stay short and must not span network or
provider calls.

The package is not added to the workspace in this task. The current generic
keyed-actor host stores a small command-result, snapshot, and timer keyspace
that does not yet benefit from a relational model. Adding a beta dependency
and migrating that layout without a concrete query or migration requirement
would increase the task-9.9 recovery surface without changing semantics.

Adopt the adapter when either of these concrete migrations occurs:

- the notification realtime Durable Object moves its existing raw SQLite
  tables behind an Effect service and Layer; or
- a commerce-specific actor needs indexed timer, lease, cursor, or
  idempotency records that are materially clearer than the current key-value
  layout.

Any adoption must exact-pin the package to the same Effect cohort, add a
startup/query/transaction canary, define actor-local migrations, and pass the
restart and recovery suite. It must not be used to move authoritative commerce
records out of PostgreSQL without a separate accepted OpenSpec design.

Reviewed source:
[`SqliteClient.ts` at the beta.93 release commit](https://github.com/Effect-TS/effect-smol/blob/c74babd0ad2d96fa6759a16a3f014e3f8d0bdacb/packages/sql/sqlite-do/src/SqliteClient.ts).

## Ownership rules

The words in the owner column are normative:

- **PostgreSQL** means repository-visible durable authority. Actor-local copies
  are caches or coordination projections and can be discarded.
- **Actor-local** means the Durable Object identity is the authority for that
  narrowly scoped coordination, cache, workflow, timer, or fanout state.
- **Transit** means the runtime transports a message but is never the state
  authority.
- **External provider** means a provider owns its remote execution state while
  the platform persists its local commerce record in PostgreSQL.

| Stateful workload                                                                                                      | Authoritative owner                                              | Actor-local role                                                                                 | Recovery source and invariant                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Store, customer, product, region, sales-channel, pricing, promotion, tax, fulfillment, order, and other module records | PostgreSQL                                                       | None by default                                                                                  | Restore through the module repository. A Durable Object cannot become authoritative without an accepted design reference.                                                            |
| Cart, line-item, and adjustment records                                                                                | PostgreSQL                                                       | Hot aggregate cache, ownership scope, mutation idempotency map, and projection-sync coordination | Rehydrate from PostgreSQL. Actor-local data may be dropped; a projection-sync failure must be reconciled against PostgreSQL rather than treated as the only durable mutation record. |
| Cart mutation serialization and duplicate command results                                                              | Actor-local coordination                                         | Serialize one cart key and retain bounded command results                                        | Recover from actor-local command results when present; otherwise replay the idempotent command and confirm the PostgreSQL result.                                                    |
| Inventory items, locations, levels, reservations, and adjustment events                                                | PostgreSQL                                                       | Optional per inventory-item/location serialization and duplicate command results                 | Rebuild coordination from PostgreSQL. Reservations and stock quantities never recover solely from actor-local state.                                                                 |
| Checkout attempt input, completed step outcomes, retries, and compensation progress                                    | Actor-local workflow history in the selected workflow runtime    | Coordinate one workflow run and resume completed steps                                           | Recover from workflow history. PostgreSQL remains authoritative for carts, reservations, payments, fulfillments, orders, notifications, and queryable workflow metadata.             |
| Queryable workflow metadata and state projection                                                                       | PostgreSQL                                                       | Optional actor-local execution cache only                                                        | Rebuild from PostgreSQL plus workflow history. The Cloudflare adapter must be given the PostgreSQL-backed state/metadata stores before production use.                               |
| Generic keyed-actor command results, snapshots, and timers                                                             | Actor-local                                                      | Durable deduplication, coordination state, and alarms for one actor key                          | Recover from actor-local storage when it is the declared owner; use PostgreSQL, workflow history, or recomputation when named by `KeyedActorStateOwnershipSchema`.                   |
| Transactional outbox claims, attempts, acknowledgements, and failure state                                             | PostgreSQL                                                       | None                                                                                             | Recover by reclaiming eligible PostgreSQL rows. Publishing and acknowledgement remain at-least-once.                                                                                 |
| Cloudflare Queue messages and dead-letter transport                                                                    | Transit                                                          | Delivery buffering only                                                                          | Redeliver from the queue or the PostgreSQL outbox/dispatch record. A queue message is never the sole business record.                                                                |
| Notification event outbox, dead letters, providers, templates, and dispatches                                          | PostgreSQL                                                       | None for durable records                                                                         | Recover through the notification-event repository. Queue and realtime adapters only deliver or fan out these records.                                                                |
| Notification realtime stream events, WebSocket attachments, and subscriptions                                          | Actor-local fanout                                               | Local replay window and active connection/subscription state                                     | Rebuild active subscriptions from reconnecting clients and durable notification records. Local stream rows are not an audit log or notification authority.                           |
| Payment sessions, payments, captures, refunds, and provider idempotency references                                     | PostgreSQL plus the external provider for remote execution state | Optional per-key call serialization only                                                         | Reconcile PostgreSQL records with the provider API. Actor-local state cannot prove that a provider side effect did or did not occur.                                                 |
| Webhook delivery cursors, retries, and poison-message disposition                                                      | PostgreSQL by default                                            | Optional short-lived per-endpoint serialization                                                  | Recover from outbox/dispatch/dead-letter records. Moving a cursor to actor-local authority requires a workload-specific accepted design.                                             |
| Sandboxed plugin metadata and durable plugin storage                                                                   | PostgreSQL by default; unresolved until section 10               | Actor-local cache, quota, lease, or session state only                                           | Section 10 must declare capability-specific ownership. Raw Durable Object SQLite is never exposed to plugin code.                                                                    |
| Better Auth sessions and identities during migration                                                                   | Temporary Better Auth D1 seam                                    | None                                                                                             | This is an explicit migration exception, not an actor ownership choice. The auth follow-up change owns its replacement decision.                                                     |

## Current deployment gaps

The table records the target authority even where the deployed Worker still
uses an in-memory adapter:

- the cart cache currently projects to an in-memory cart repository rather
  than the PostgreSQL cart repository;
- Cloudflare workflow metadata and state stores are optional and are not yet
  composed with PostgreSQL in the deployed Worker;
- cart and inventory now enter coordination through the permanent
  `KeyedActorService` contract;
- the generic keyed actor has a no-op command interpreter; module-specific
  actors have not yet been composed;
- notification realtime uses raw Durable Object SQLite rather than the
  approved Effect SQL adapter.

These are composition or migration gaps, not alternate ownership decisions.
Task 9.9 owns restart, interruption, replay, duplicate-delivery, compensation,
and timer-recovery evidence. The temporary coordinator facades were removed in
task 12.5.

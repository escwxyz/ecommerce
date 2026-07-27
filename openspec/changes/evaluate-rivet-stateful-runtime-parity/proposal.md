## Why

Cloudflare Durable Objects are the accepted first actor runtime, while Rivet is
only a portability candidate. Before another runtime is adopted, the project
needs a repeatable, commerce-specific comparison that proves equivalent
consistency and recovery behavior and makes operational, latency, and cost
trade-offs explicit.

## What Changes

- Define an evidence-gated parity evaluation between the current Cloudflare
  Durable Object adapter and a bounded Rivet adapter prototype.
- Reuse the platform-neutral keyed actor, timer, workflow, state ownership, and
  recovery contracts rather than introducing Rivet types into core or module
  packages.
- Require consistency, interruption, retry, replay, duplicate-delivery,
  compensation, restart, timer-recovery, placement, latency, deployment,
  observability, operations, and cost evidence.
- Record an explicit adopt, defer, or reject decision; this change does not
  authorize production adoption by itself.

## Capabilities

### New Capabilities

- `rivet-runtime-parity-evaluation`: Defines the workloads, evidence,
  acceptance gates, and decision record required before Rivet can become an
  alternate stateful runtime adapter.

### Modified Capabilities

None.

## Impact

- Adds a deferred evaluation track under `openspec/changes/` and future
  prototype/test work in platform adapter packages.
- Does not change the current Cloudflare-first deployment, PostgreSQL
  authority, public APIs, durable-message schemas, or runtime dependencies.
- Any future Rivet dependency remains isolated to an adapter/prototype package
  and requires a separate adoption change after this evaluation completes.

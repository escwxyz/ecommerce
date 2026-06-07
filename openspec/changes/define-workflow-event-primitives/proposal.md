## Why

This change implements the orchestration foundation defined by `define-cloudflare-commerce-blueprint`. The platform needs workflow and event primitives before cart, checkout, and order processes can be modeled safely.

## What Changes

- Define Effect-based workflow primitives, step boundaries, idempotency, and compensation rules.
- Define baseline domain event contracts and publication patterns.
- Resolve the initial workflow state storage approach.

## Capabilities

### New Capabilities

- `workflow-event-primitives`: Defines the baseline orchestration and domain event contracts for cross-module processes.

### Modified Capabilities

- None.

## Impact

- Affected areas: planned `packages/core`, event bus/service contracts, state storage decision, and test scaffolding.
- Blueprint traceability: derived from `define-cloudflare-commerce-blueprint` task `2.6` and the workflow-state open question.

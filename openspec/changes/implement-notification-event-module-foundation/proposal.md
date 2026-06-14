## Why

Domain events and notification dispatch need a separable foundation before module workflows rely on observable events and provider-backed messages. This change follows `notification-event-module-map`.

## What Changes

- Implement event distribution contracts for event envelopes, outbox/queue bridging, subscribers, retries, dead letters, and observability.
- Implement notification dispatch contracts for templates, channels, recipients, providers, dispatch state, retries, and delivery results as a separable surface.
- Contribute API/admin metadata and tests.

## Capabilities

### New Capabilities

- `notification-event-module-foundation`: Implements the first event and notification contracts from `notification-event-module-map`.

### Modified Capabilities

- None.

## Impact

- Affected areas: `packages/modules/notification-event` or separable event/notification packages, workflow/event contracts, queue/outbox integration, `packages/api`, `apps/web`, and tests.
- Map traceability: derived from `notification-event-module-map`.

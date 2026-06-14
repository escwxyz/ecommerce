## Context

Events and notifications may share an initial planning group, but event distribution must work without notification providers and notification dispatch must be able to consume events asynchronously.

## Scope

- Package boundary: `packages/modules/notification-event` initially or split event/notification packages if implementation requires it.
- Service contracts: event publication/subscription/outbox/queue/retry/dead-letter/observability and notification template/channel/recipient/provider/dispatch operations.
- Data ownership: event outbox/projections where needed, subscriber registrations, notification templates, dispatch records, provider records, retry state, and delivery results.
- Events/workflows: standard event envelope usage and notification workflow steps.
- API/admin metadata: event observability and notification management procedures, permissions, navigation, and screens.
- Tests: envelope shape, retry/dead-letter behavior, provider fake tests, API assembly, admin metadata, and import-boundary checks.

## Non-Goals

- Order-specific notification templates as hardcoded order logic, unrestricted provider SDK access, or replacing the shared workflow/event primitives.

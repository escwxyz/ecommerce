## Why

The server currently advertises queued email, SMS, webhook, and in-app providers without registering concrete delivery providers in the queue consumer, so accepted dispatches eventually fail or dead-letter. The platform needs one complete built-in notification channel now: an admin-only in-app inbox that works without external provider SDKs and leaves external channels to future plugin changes.

## What Changes

- Add a host-owned in-app notification provider that projects queued notification dispatches into persistent admin inbox records.
- Add admin-recipient identity, unread/read state, archive state, action metadata, and source traceability without treating delivery-audit rows as inbox records.
- Add typed APIs and permission-aware admin metadata for listing, counting, reading, and archiving the current authenticated administrator's notifications.
- Replace the admin shell's placeholder notification control with an unread-aware inbox popover and an authenticated notifications screen for reading and archiving owned records.
- Register only delivery-capable provider keys in request and queue-consumer composition; with this change, the built-in runtime exposes `in-app` and no longer hardcodes email, SMS, or webhook as available channels.
- Keep Cloudflare Queue processing asynchronous and idempotent, with the built-in delivery provider registered in the queue consumer rather than recursively invoking a queue-publishing wrapper.
- Reserve email, SMS, webhook, and other external delivery implementations for later native or sandboxed plugin-provider changes after plugin runtime composition is stable.

## Capabilities

### New Capabilities

- `admin-in-app-notifications`: Defines the built-in admin-only inbox, recipient scoping, lifecycle operations, queue delivery behavior, API contracts, permissions, and admin metadata.

### Modified Capabilities

None.

## Impact

- Affected packages: `packages/modules/notification-event`, `packages/db`, `packages/db-d1`, `packages/platform-cloudflare`, `packages/api`, `apps/server`, `apps/web`, and shared admin UI primitives where needed.
- Affected runtime behavior: notification provider registration, Cloudflare Queue publication/consumption, D1 migrations, authenticated admin request context, and notification-event realtime updates.
- Existing event outbox and notification dispatch audit records remain authoritative for delivery processing; new inbox records are module-owned admin presentation state.
- No external notification dependency or provider SDK is introduced.

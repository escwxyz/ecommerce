## Why

The plugin platform can collect generic native provider descriptors and execute sandbox entrypoints, but the server cannot normalize active plugin contributions into executable notification providers for request and queue-consumer composition. After the built-in admin inbox establishes the host provider registry, the platform needs a secure extension boundary so email, SMS, webhook, and future channels can be supplied by plugins without hardcoded server keys or provider-private imports.

## What Changes

- Define a typed notification provider contribution contract with stable contract identity, plugin-local provider keys, supported channels, and delivery metadata.
- Normalize active native plugin contributions into executable notification providers while validating implementation shape, lifecycle state, canonical provider identity, and collisions with built-in or other plugin providers.
- Add sandbox notification-provider declarations and delivery entrypoints that execute through Worker Loader and return validated serializable delivery results.
- Add a sandbox `notification:deliver` capability and enforce granted capability, plugin lifecycle, tenant scope, outbound-host policy, operation input, response validation, and audit events for provider delivery.
- Compose built-in, active native, and active sandbox notification providers into one registry snapshot used to derive request-side queue wrappers and queue-consumer delivery resolution.
- Fail closed when a provider is inactive, unavailable, duplicated, malformed, or lacks required platform capability; do not accept dispatch work for providers absent from the current executable registry.
- Preserve plugin identity, version, provider identity, correlation metadata, and delivery outcomes in queue/runtime diagnostics without exposing credentials or sensitive payloads in audit logs.
- Keep concrete email, SMS, webhook, vendor SDK, credential-management UI, and marketplace implementations out of scope; later provider-plugin changes consume this contract.

## Capabilities

### New Capabilities

- `notification-plugin-providers`: Defines typed native and sandbox notification provider contributions, lifecycle-aware registry composition, Worker Loader delivery adaptation, queue integration, security enforcement, and diagnostics.

### Modified Capabilities

None.

## Impact

- Depends on the provider-registry and queue-composition boundary established by `add-built-in-in-app-notifications`.
- Affected packages: `packages/core`, `packages/modules/notification-event`, `packages/platform-cloudflare`, `packages/api`, `apps/server`, and plugin/runtime tests.
- Affected contracts: native provider descriptors, sandbox manifests and entrypoint kinds, bridge capabilities, sandbox response validation, notification provider registry/resolution, and queue diagnostics.
- No provider SDK, external service dependency, raw secret binding, marketplace behavior, or unrestricted plugin frontend code is introduced.

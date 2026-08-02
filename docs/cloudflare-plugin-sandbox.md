# Cloudflare Plugin Sandbox

Sandboxed plugins are untrusted plugin bundles executed through the Cloudflare platform boundary. They do not receive raw D1, R2, KV, environment, secret, Hono, or module implementation bindings. Every host interaction goes through a request-scoped bridge with granted capabilities.

## Manifest

A sandbox manifest declares:

- `id` and `version`: stable plugin identity and semantic plugin version.
- `tier`: normalized to `sandbox`.
- `bundle`: immutable executable bundle metadata with R2 key, bundle version, main module, and `sha256` integrity.
- `entrypoints`: declared route, hook, workflow step, lifecycle, or admin metadata entrypoints.
- `capabilities`: requested bridge capabilities such as `bridge:log`, `bridge:events`, `bridge:storage`, `bridge:fetch`, `commerce:read`, `commerce:write`, and `route:respond`.
- `allowedHosts`: outbound host requests. Empty means network access is denied.
- `storage`: declared storage namespaces mediated by the host bridge.
- `contributions`: route, hook, workflow step, and admin metadata keys that can participate in dispatch when the plugin is active.

The manifest is decoded through `SandboxPluginManifestSchema` before
activation. Helper APIs keep normalizing hostnames and deterministic capability
order, but schema decoding owns the untrusted boundary and rejects malformed
identity, version, bundle, entrypoint, storage, and bridge capability values.

The host treats manifest capabilities as requested access. Activation creates the granted policy used at runtime, and activation fails if required capabilities, hosts, or storage namespaces are denied.

## Bridge Model

The bridge context contains plugin identity, plugin version, tenant/scope, lifecycle state, granted capabilities, granted hosts, granted storage namespaces, auth/session policy, and correlation ID. Bridge methods enforce that context before calling host services.

Bridge context, permission-check inputs, operations, audit events, runtime
errors, grant policies, and entrypoint responses are decoded through Effect
Schema before host policy logic consumes them. Capability-service execution,
deadlines, quotas, and durable audit persistence are implemented in the next
section of the plugin migration.

Initial bridge methods cover:

- logging and audit events
- event emission
- host-mediated outbound fetch
- host-mediated storage reads and writes
- selected commerce service actions
- typed route/entrypoint responses

Denied operations emit audit events with plugin identity, operation type, decision, reason, tenant/scope, lifecycle state, resource, and correlation ID. Audit events must not include secrets or sensitive payload values.

## Storage Model

The first implementation uses R2 for immutable plugin code bundles and D1 for plugin metadata:

- R2 stores opaque bundle objects addressed by key, bundle version, and integrity hash.
- D1 stores plugin manifests, lifecycle state, active bundle version, granted policy, storage declarations, and audit indexes.
- Plugin storage data is mediated by bridge methods and scoped by tenant, plugin ID, plugin version, namespace, and key.

Plugins never receive raw R2, D1, KV, environment, or secret bindings.

## Local Development

Local tests validate manifest normalization, activation grants, bridge authorization, egress decisions, storage scoping, lifecycle filtering, response validation, and package boundaries. Full Worker Loader isolation depends on Cloudflare runtime behavior, so local tests use a fake Worker Loader binding and keep direct Loader API usage behind `SandboxPluginRunner`.

Cloudflare smoke coverage should stay small and focused on verifying that the configured Worker Loader binding can load an immutable bundle, pass the bridge environment, and return a typed response. Runtime bundling, marketplace upload flows, Dynamic Workflows, and Workers for Platforms dispatch namespaces are follow-up changes.

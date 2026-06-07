## Admin Metadata Boundary

Shared admin metadata contracts live in `packages/core/src/admin` and are exported as `@ecommerce/core/admin`.

That package owns runtime-neutral contribution types, source identity, source-scoped IDs, permission descriptors, host-rendered primitive descriptors, validation helpers, and metadata composition. `packages/api` owns discovery operations and permission-aware filtering for the current request. `apps/web` owns TanStack Start rendering adapters and must consume metadata through typed API clients rather than importing backend module internals.

The normalized admin surface ID format is:

```text
<source-type>:<source-key>:<surface-key>
```

For example, the product module resource surface normalizes to `module:product:resource`.

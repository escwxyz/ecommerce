## Why

The existing product foundation proves the first module slice, but `product-module-map` calls for broader catalog ownership before pricing, inventory, cart, and storefront availability depend on it.

## What Changes

- Expand the product module beyond the initial foundation toward products, variants, options, collections, categories, media references, tags, status, metadata, and publishable/search-facing attributes.
- Keep commercial and transactional state outside product.
- Preserve existing product foundation boundaries and tests.

## Capabilities

### New Capabilities

- `product-module-expansion`: Expands product catalog ownership according to `product-module-map`.

### Modified Capabilities

- `product-module-foundation`: Extends the existing product foundation with mapped catalog structure.

## Impact

- Affected areas: `packages/modules/product`, shared database schema assembly, `packages/api`, `apps/web`, and tests.
- Map traceability: derived from `product-module-map`.

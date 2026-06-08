## Context

`implement-product-module-foundation` is complete. This change builds on it rather than replacing it, and it must not absorb pricing, inventory, tax, cart, order, or fulfillment state.

## Scope

- Package boundary: existing `packages/modules/product`.
- Service contracts: catalog identity, variants/options, collections/categories, publishable/search-facing metadata, and validation for downstream modules.
- Data ownership: product catalog structure only.
- Events/workflows: product catalog change events; no checkout workflow behavior.
- API/admin metadata: contribute expanded catalog procedures, permissions, navigation, forms, tables, and screens.
- Tests: service/repository behavior, API assembly, admin metadata, boundary tests, and regression tests for existing product operations.

## Non-Goals

- Prices, promotions, tax, inventory quantities, cart lines, fulfillment state, payment state, or order state.

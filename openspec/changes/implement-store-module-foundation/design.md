## Context

The accepted `store-module-map` requires one owner for platform commerce defaults. Follow-up modules must consume those defaults through a store service contract rather than duplicating store settings.

## Scope

- Package boundary: `packages/modules/store`.
- Service contracts: read/update store settings and resolve defaults for dependent modules.
- Data ownership: store identity, default currency, supported currencies, default region/channel references, locale/timezone policy, metadata, and administrative settings.
- Events/workflows: emit store configuration change events; no checkout workflow behavior.
- API/admin metadata: contribute store administration procedures, permissions, navigation, and screen metadata.
- Tests: service/repository behavior, API assembly, admin metadata discovery, and import-boundary checks.

## Non-Goals

- Region, tax, pricing, order, or sales-channel implementation.
- Cloudflare adapter behavior inside the store module.

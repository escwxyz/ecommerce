## Context

The map permits one initial package only if region and sales-channel responsibilities remain separately declared and can be split later.

## Scope

- Package boundary: `packages/modules/region-sales-channel` initially, with distinct region and sales-channel service contracts.
- Service contracts: region validation, currency/country constraints, provider availability references, sales-channel publishability, and availability scope.
- Data ownership: region records, countries, currency constraints, tax/payment/fulfillment availability references, sales channels, channel metadata, and publishability scope.
- Events/workflows: emit region/channel configuration events; no checkout workflow implementation.
- API/admin metadata: contribute management procedures, permissions, navigation, and screens for region and channel resources.
- Tests: contract separation, service/repository behavior, API assembly, admin metadata, and import-boundary checks.

## Non-Goals

- Pricing calculation, tax calculation, payment provider logic, fulfillment provider logic, or inventory reservation behavior.

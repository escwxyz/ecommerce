## Context

Cart, promotion, tax, and product display composition need traceable pricing outputs without collapsing discounts or taxes into pricing-owned state.

## Scope

- Package boundary: `packages/modules/pricing`.
- Service contracts: manage price data and calculate base/rule-based prices for declared contexts.
- Data ownership: currencies, price sets, price lists, price rules, price preferences, money amounts, and calculated price results.
- Events/workflows: durable events cover price configuration mutations; calculated-price traces remain synchronous service outputs rather than request-rate outbox records.
- API/admin metadata: pricing management procedures, permissions, navigation, and screens.
- Tests: calculation behavior, repository contracts, API assembly, admin metadata, and import-boundary checks.

## Non-Goals

- Promotion discount application, tax calculation, cart totals, or order financial records.

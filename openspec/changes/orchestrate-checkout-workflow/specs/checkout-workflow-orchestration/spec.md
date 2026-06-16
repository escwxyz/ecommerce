## ADDED Requirements

### Requirement: Checkout workflow orchestration
Checkout completion SHALL be implemented as a separate workflow after prerequisite module contracts are accepted, using declared module service contracts and event/workflow primitives.

#### Scenario: Checkout completes
- **WHEN** checkout validates cart state, pricing, promotion, tax, inventory, payment, fulfillment, customer, and order prerequisites
- **THEN** the workflow MUST coordinate those modules through service contracts and workflow steps
- **AND** it MUST NOT import private repositories or provider SDKs from participating modules

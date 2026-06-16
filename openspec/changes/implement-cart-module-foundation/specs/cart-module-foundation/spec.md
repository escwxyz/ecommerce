## ADDED Requirements

### Requirement: Cart module foundation
The system SHALL provide a `cart` commerce module that implements `cart-module-map` and owns pre-order checkout state without privately creating orders.

#### Scenario: Checkout completes successfully
- **WHEN** checkout completion has satisfied inventory, payment, fulfillment, tax, promotion, and cart validation requirements
- **THEN** order creation MUST occur through the order module contract as a workflow step
- **AND** cart MUST NOT create orders, captures, fulfillments, or inventory adjustments privately

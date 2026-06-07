## MODIFIED Requirements

### Requirement: Shared route fragment contract

The API package SHALL define a shared route fragment contract that allows built-in surfaces, modules, and plugins to contribute oRPC procedures through `packages/api` without importing server transport code, and contributed procedures MUST use the shared validation-aware procedure contract.

#### Scenario: Built-in route fragment is registered

- **WHEN** a built-in API surface such as the current health check or authenticated example routes is declared
- **THEN** it MUST be represented as a route fragment consumed by the shared API assembly entry point and its contributed procedures MUST declare validation through the shared route contract

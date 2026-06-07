# Api Route Validation Contracts

## Purpose

Synced from completed OpenSpec changes. This spec captures the current accepted requirements for this capability.

## Requirements

### Requirement: Schema-backed route procedures

The API package SHALL require route contributors to declare explicit schemas for procedure inputs and outputs through the shared procedure-construction contract.

#### Scenario: Built-in procedure is declared

- **WHEN** a built-in route procedure is added to a route fragment
- **THEN** it MUST declare its request and response schema through the shared validation contract rather than relying on implicit TypeScript inference alone

### Requirement: Validation-aware route fragment contributions

Modules and plugins SHALL contribute validated procedures through `packages/api` without importing server transport code or bypassing the shared validation contract.

#### Scenario: Module route fragment is registered

- **WHEN** a module contributes a route fragment to the API assembly
- **THEN** each contributed procedure MUST use the shared validation-aware procedure contract

### Requirement: Request rejection on schema mismatch

The assembled API surface SHALL reject procedure invocations whose inputs do not satisfy the declared request schema.

#### Scenario: Invalid request payload is sent

- **WHEN** a caller invokes a validated procedure with input that does not satisfy its declared schema
- **THEN** the API boundary MUST reject the request before procedure business logic runs

### Requirement: Response contracts stay explicit

The API package SHALL preserve explicit response schemas so downstream typing and generated API documentation reflect the assembled route contract.

#### Scenario: OpenAPI or client typing is derived

- **WHEN** the assembled root router is used for OpenAPI generation or downstream client typing
- **THEN** the declared response schemas MUST remain part of the exported route contract

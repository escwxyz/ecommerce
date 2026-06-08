# Product Module Foundation

## Purpose

Synced from completed OpenSpec changes. This spec captures the current accepted requirements for this capability.

## Requirements

### Requirement: Product module declaration

The system SHALL provide a `product` commerce module that declares its stable module key, required dependencies, provided services, lifecycle hooks where needed, API contributions, and admin contributions through the shared module contract.

#### Scenario: Product module is registered

- **WHEN** the commerce runtime composes built-in modules
- **THEN** the `product` module MUST be validated through the shared module graph and expose its declared services and contributions without bypassing the module contract

#### Scenario: Product module follows the package SOP

- **WHEN** engineers inspect or extend the `product` module package
- **THEN** its code MUST be organized into dedicated folders for contracts, domain, services, repositories, router, admin metadata, module declaration, testing helpers, and package-local tests under `src/_tests`

### Requirement: Product-owned persistence contract

The `product` module SHALL own the canonical product data model and repository contract for the first slice, including stable product identifier, handle, title, status, and audit timestamps, while keeping concrete adapter details outside the module's public domain contract.

#### Scenario: Product schema is assembled for D1

- **WHEN** the Cloudflare D1 adapter builds the shared schema
- **THEN** the product tables MUST come from the product module's schema contribution through the shared database assembly surface rather than being redefined inside the adapter

### Requirement: Product service foundation operations

The `product` module SHALL expose typed service operations for listing products, reading a product by identifier, and creating at least a draft-capable product record for admin workflows.

#### Scenario: Admin creates a draft product

- **WHEN** an authorized admin submits valid product input with a handle and title
- **THEN** the product service MUST persist a product record with a stable identifier and a draft-capable status that can be retrieved through the shared service contract

### Requirement: Product API fragment composition

The system SHALL compose product management procedures into the shared API router through module-owned, contract-first route fragments rather than server-local route definitions.

#### Scenario: Product routes are assembled

- **WHEN** the API package builds the root router
- **THEN** product list, read, and create procedures MUST be present through the product module fragment and MUST fail composition if their route keys conflict with another fragment

#### Scenario: Product contracts declare API metadata

- **WHEN** the product module defines oRPC contracts for product list, read, and create procedures
- **THEN** each contract MUST declare explicit route metadata including method, path, operation id, summary, description, success description, and tags for future API documentation generation

### Requirement: Product admin metadata discovery

The system SHALL expose product admin metadata that allows the web admin to discover and render the first product management surface through shared typed contracts.

#### Scenario: Admin loads the dashboard with product module enabled

- **WHEN** the web app reads installed module admin contributions
- **THEN** it MUST be able to show a product navigation entry and render a host-owned product management screen without importing backend runtime services directly

### Requirement: Product module boundary enforcement

The `product` module SHALL remain free of Cloudflare bindings, Hono request types, frontend UI imports, and direct D1 adapter imports.

#### Scenario: Product package imports runtime-specific code

- **WHEN** verification scans the product module package
- **THEN** the checks MUST fail if product code imports `cloudflare:workers`, Hono server modules, frontend app modules, or `@ecommerce/db-d1`

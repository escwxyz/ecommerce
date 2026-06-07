## Why

This change implements the admin extensibility layer from `define-cloudflare-commerce-blueprint`. The admin app needs typed metadata contracts before modules and plugins can contribute screens and widgets without hardcoded coupling.

## What Changes

- Define admin metadata contracts for navigation, resources, widgets, permissions, and API operation references.
- Define contract tests for discovery and permission-aware rendering.
- Resolve how rich the first metadata schema needs to be for initial module slices.

## Capabilities

### New Capabilities

- `admin-metadata-extensibility`: Defines metadata-driven admin composition for modules and plugins.

### Modified Capabilities

- None.

## Impact

- Affected areas: `apps/web`, shared API typing, shared UI primitives, plugin/module contribution contracts, and metadata contract tests.
- Blueprint traceability: derived from `define-cloudflare-commerce-blueprint` task `2.9`, task `3.5`, and the admin-schema open question.

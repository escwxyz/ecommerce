## Why

The API assembly change established how auth, modules, and plugins contribute routes, but it intentionally stopped short of standardizing request and response validation. Before real module routes grow, the platform needs a shared validation contract so route fragments cannot drift into untyped or inconsistently validated procedure shapes.

## What Changes

- Define a shared validation-contract pattern for API route fragments in `packages/api`.
- Require explicit input and output schemas for contributed procedures and document how those schemas participate in oRPC/OpenAPI generation.
- Standardize the first validation implementation on Zod so route contributors follow one contract while leaving future Effect Schema interoperability as a follow-up decision if needed.
- Add contract tests and boundary checks that fail when fragment procedures skip required validation declarations.

## Capabilities

### New Capabilities

- `api-route-validation-contracts`: Defines schema-backed validation requirements for API route fragments, shared procedure contracts, and verification of request/response validation behavior.

### Modified Capabilities

- `module-api-assembly`: Extends route fragment composition to require validation contracts alongside contributed procedures.

## Impact

- Affected areas: `packages/api`, `apps/server`, generated OpenAPI behavior, downstream API typing in `apps/web`, and future module/plugin route fragments.
- Dependencies: existing oRPC and Zod integration; no new runtime dependency is required for the first slice.
- Blueprint traceability: derived from `define-cloudflare-commerce-blueprint` task `2.4`, verification planning for API contracts, and the follow-up gap discovered during `compose-module-api-assembly`.

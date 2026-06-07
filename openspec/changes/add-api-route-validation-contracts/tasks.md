## 1. Validation contract design

- [x] 1.1 Define the schema-backed procedure declaration pattern in `packages/api`
- [x] 1.2 Decide and document the first validation runtime convention as Zod for route contracts
- [x] 1.3 Update the route fragment contract so contributed procedures follow the shared validation path

## 2. Built-in route adoption

- [x] 2.1 Convert the built-in API route fragments to declare explicit request and response schemas
- [x] 2.2 Preserve the assembled root router exports and downstream client typing after validation is added
- [x] 2.3 Verify OpenAPI generation still reflects the validated route contracts

## 3. Verification

- [x] 3.1 Add tests for schema-backed procedure success and rejection on invalid input
- [x] 3.2 Add or update contract checks so route contributors cannot bypass required validation declarations
- [x] 3.3 Run targeted typecheck and test verification for `packages/api`, `apps/server`, and any touched downstream API clients

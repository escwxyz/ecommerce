## 1. Auth Model

- [x] 1.1 Enable the Better Auth admin plugin in the shared auth factory.
- [x] 1.2 Define shared admin/customer actor types and session helpers in `packages/auth`.
- [x] 1.3 Map admin plugin state into commerce permission descriptors without importing Better Auth internals into modules.

## 2. Persistence and Runtime

- [x] 2.1 Generate or update D1 auth schema/migration artifacts required by the admin plugin.
- [x] 2.2 Wire server auth composition through the shared auth package without moving auth logic into product or API modules.

## 3. Module Integration

- [x] 3.1 Replace ad hoc product route permission session assumptions with shared auth helpers.
- [x] 3.2 Keep users available as customer actors for later customer and storefront modules.

## 4. Verification

- [x] 4.1 Add auth tests for admin and customer session classification.
- [x] 4.2 Add API/module authorization tests using the shared auth helpers.
- [x] 4.3 Run typecheck, auth/API/product/server tests, and OpenSpec status before applying the change.

## Notes

The admin plugin, actor model, shared evaluator, server wiring, and module authorization tasks are satisfied by the accepted `centralize-auth-permission-evaluation` work plus the `compose-module-auth-permissions` composition layer. The remaining unsatisfied scope is narrow Better Auth admin persistence: generate or update the D1 auth schema/migration artifacts required by the admin plugin, then run final verification for this older change.

## 1. Shared Authorization Contract

- [x] 1.1 Add shared actor classification, permission descriptor normalization, and authorization decision types to `packages/auth`.
- [x] 1.2 Add shared evaluator helpers or service methods for resolving actors, reading normalized permission keys, checking permissions, and asserting permissions.
- [x] 1.3 Export the evaluator contract and permission helpers through the public `packages/auth` package exports.
- [x] 1.4 Add auth test fixtures for anonymous, customer, and store-admin authorization contexts.

## 2. Better Auth Custom Permission Adapter

- [x] 2.1 Define the commerce resource/action access-control statement in `packages/auth` from the current permission vocabulary.
- [x] 2.2 Create baseline Better Auth roles for customer/user and store-admin actors using the shared access controller.
- [x] 2.3 Preserve required Better Auth default admin user/session permissions when custom commerce roles extend admin behavior.
- [x] 2.4 Wire the shared access controller and roles into server-side Better Auth admin plugin configuration.
- [x] 2.5 Wire the matching access controller and roles into admin client plugin configuration when the client consumes Better Auth admin permission helpers.

## 3. Call-Site Migration

- [x] 3.1 Update API context or module context wiring so route fragments can access the shared authorization evaluator.
- [x] 3.2 Replace product route raw `session.user.permissions` parsing with shared auth evaluator calls.
- [x] 3.3 Replace admin metadata raw permission extraction with shared auth evaluator calls.
- [x] 3.4 Ensure backend route enforcement remains independent from admin metadata visibility filtering.

## 4. Plugin and Sandbox Policy Integration

- [x] 4.1 Update plugin/admin metadata validation to normalize declared permissions through shared auth descriptors.
- [x] 4.2 Add a bridge-policy integration point that evaluates actor permissions through the shared auth evaluator before privileged host actions.
- [x] 4.3 Reject plugin contributions that declare unsupported permissions before runtime composition.

## 5. Verification

- [x] 5.1 Add unit tests for actor classification, permission extraction, authorization decisions, and denial reason behavior if exposed.
- [x] 5.2 Add tests proving Better Auth custom roles preserve required default admin capabilities.
- [x] 5.3 Add module/API tests for authorized and forbidden product operations using shared auth fixtures.
- [x] 5.4 Add admin metadata tests for permission-based surface filtering with the same evaluator fixtures.
- [x] 5.5 Add plugin or sandbox bridge policy tests for allowed, forbidden, and unsupported permission declarations.
- [x] 5.6 Run `bun run check-types`, targeted auth/API/product tests, `bun run check`, and `openspec status --change "centralize-auth-permission-evaluation"` before closing the implementation.

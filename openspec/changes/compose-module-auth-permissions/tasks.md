## 1. Core Permission Descriptor Contract

- [x] 1.1 Add core permission descriptor types for resource/action permissions without importing `packages/auth`.
- [x] 1.2 Add a `permissions` contribution field to commerce module contribution contracts.
- [x] 1.3 Add pure permission composition helpers that collect descriptors from module/plugin contributions.
- [x] 1.4 Make composition reject malformed descriptors and duplicate permission ownership with useful errors.

## 2. Product Permission Ownership

- [x] 2.1 Move product read/write permission descriptors into the product module's owned declarations.
- [x] 2.2 Update product admin metadata to reuse product-owned permission descriptors or keys.
- [x] 2.3 Update product route authorization to reference product-owned permission descriptors or keys.
- [x] 2.4 Add tests proving product permissions are declared once and reused by module route/admin surfaces.

## 3. Auth Adapter Composition

- [x] 3.1 Refactor auth access-control construction to accept a composed commerce permission statement.
- [x] 3.2 Preserve Better Auth default admin statements in the access-control statement.
- [x] 3.3 Preserve admin-only grants for Better Auth `user` and `session` permissions.
- [x] 3.4 Keep customer/user roles empty unless explicitly granted by a later accepted change.
- [x] 3.5 Remove hardcoded product commerce permissions from `packages/auth`.

## 4. Runtime Composition Wiring

- [x] 4.1 Wire API/server composition to collect installed module permission descriptors.
- [x] 4.2 Pass the composed permission statement into auth factory or auth adapter construction.
- [x] 4.3 Keep package dependencies acyclic: auth must not import module packages and product must not import auth.
- [x] 4.4 Update affected package exports and dependency metadata.

## 5. Plugin and Sandbox Validation

- [x] 5.1 Validate native plugin permission declarations against the composed permission statement.
- [x] 5.2 Validate sandboxed plugin permission requirements against the composed permission statement before admin surfaces or bridge actions are exposed.
- [x] 5.3 Add tests for unsupported plugin permissions and duplicate plugin/module permission declarations.

## 6. OpenSpec Cleanup

- [x] 6.1 Review `add-basic-auth-admin-model` tasks against the implemented auth plugin/evaluator work.
- [x] 6.2 Mark superseded `add-basic-auth-admin-model` tasks complete or document why they are superseded.
- [x] 6.3 Keep any remaining Better Auth admin D1 schema/migration work as a narrow task or follow-up change.
- [x] 6.4 Run `openspec status --change "add-basic-auth-admin-model"` and `openspec status --change "compose-module-auth-permissions"` after updates.

## 7. Verification

- [x] 7.1 Add unit tests for core permission descriptor composition, duplicate detection, and statement output.
- [x] 7.2 Add auth tests proving composed product permissions enter the admin role and do not enter the customer role.
- [x] 7.3 Add API/product tests proving route authorization and admin metadata use composed permission declarations.
- [x] 7.4 Run `bun run check-types`, `bun run test`, `bun run check`, and OpenSpec status before closing the implementation.

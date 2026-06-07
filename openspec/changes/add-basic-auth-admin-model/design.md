## Overview

Use Better Auth's admin plugin as the first concrete privileged-auth primitive. The model is intentionally simple: admin-capable Better Auth users represent store administrators, and ordinary users represent customers.

## Decisions

- Keep Better Auth construction in `packages/auth` factories and `apps/server` composition. Modules and `packages/api` consume shared auth/session/permission contracts, not Better Auth internals.
- Model store admin access through Better Auth admin plugin capabilities first, then map those capabilities into the existing commerce permission descriptors.
- Keep product/customer/module routes responsible for their own business permission requirements while the shared auth layer owns session shape and actor classification.
- Defer multi-store role scoping and customer account enrichment until the baseline admin/customer split is implemented and tested.

## Risks

- Better Auth generated schema changes may require D1 migration updates.
- Existing tests that inject session permissions will need a stable helper that mirrors the real admin plugin-derived session shape.
- The current product route permission shape is intentionally permissive and should be replaced with shared auth helpers during this change.

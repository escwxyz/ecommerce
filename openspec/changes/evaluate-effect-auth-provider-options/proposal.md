## Why

The Effect 4 backend migration keeps Better Auth behind a private Effect adapter
as a temporary seam. That is sufficient for protected Cloudflare Worker routes,
but it does not answer whether the long-term auth provider path should be:

- direct wrapping of Better Auth behind `EffectAuthServiceTag`;
- adoption of the community `@effectify/node-better-auth` integration;
- waiting for or adopting future official Better Auth / Effect support;
- replacing Better Auth with another provider later.

Auth provider selection affects persistence ownership, Cloudflare runtime
compatibility, session-cookie semantics, generated migrations, and how much
provider detail can stay private behind the Effect service boundary. The project
needs a dedicated research change before deleting the temporary Better Auth D1
persistence seam or expanding auth behavior.

## What Changes

- Add a follow-up research track for comparing direct Better Auth wrapping,
  `effectify`, and future official support.
- Define the required evidence for choosing an auth provider integration path.
- Require Cloudflare Worker compatibility and provider-neutral Effect service
  semantics as acceptance criteria.
- Preserve the current Better Auth Effect adapter and D1 persistence seam until
  the research change reaches a documented decision.

## Capabilities

### New Capabilities

- `effect-auth-provider-evaluation`: Defines the decision process and evidence
  gates for selecting the long-term Effect-compatible auth provider path.

### Modified Capabilities

- None.

## Impact

- Affected areas: `packages/auth`, `packages/api`, `apps/server`,
  `packages/db-d1`, future auth persistence migrations, and Cloudflare Worker
  runtime composition.
- Follow-up from: `adopt-effect-4-backend-architecture` task 5.8.
- Existing behavior preserved: Better Auth remains private behind
  `EffectAuthServiceTag` and its generated D1 persistence seam remains
  provider-private until this research concludes.

## 1. Current-state research

- [ ] 1.1 Re-check Better Auth official documentation for current session,
      cookie, database-adapter, and Cloudflare Worker support.
- [ ] 1.2 Re-check Effect 4 beta HTTP, Schema, and runtime APIs used by the
      auth boundary.
- [ ] 1.3 Re-check `@effectify/node-better-auth` package metadata,
      implementation, runtime assumptions, and Effect version compatibility.
- [ ] 1.4 Re-check whether official Better Auth / Effect integration exists or
      is planned in released packages.

## 2. Candidate spikes

- [ ] 2.1 Spike direct Better Auth wrapping against the current
      `EffectAuthServiceTag` and Cloudflare Worker request/session-cookie path.
- [ ] 2.2 Spike `@effectify/node-better-auth` against Effect 4 beta and
      Cloudflare Worker runtime constraints.
- [ ] 2.3 Spike any official or maintained integration if available.
- [ ] 2.4 Verify each viable spike can preserve provider-neutral auth contracts
      and sanitized failures.

## 3. Persistence evaluation

- [ ] 3.1 Map the current Better Auth D1 tables, generated migration workflow,
      and runtime binding ownership.
- [ ] 3.2 Decide whether auth persistence remains provider-private or moves to a
      new Effect SQL / Drizzle-owned auth storage path.
- [ ] 3.3 Document migration, deletion, or retention tasks for the temporary
      Better Auth persistence seam.

## 4. Decision and follow-through

- [ ] 4.1 Select the auth provider integration path and record rejected
      alternatives with concrete reasons.
- [ ] 4.2 Update `docs/effect-auth-boundary.md` with the selected path and seam
      deletion/retention criteria.
- [ ] 4.3 Create a follow-up implementation change if the selected path requires
      code changes.
- [ ] 4.4 Verify the selected path against Cloudflare Worker auth boundary tests,
      auth package tests, and relevant package typechecks.

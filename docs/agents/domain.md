# Domain Docs

How engineering skills should consume this repo's domain documentation when exploring or changing the codebase.

## Layout

This repo currently uses a single-context layout. Prefer root-level domain docs when they exist:

- `CONTEXT.md` for domain language, glossary terms, and project-specific concepts.
- `docs/adr/` for architectural decision records.
- `openspec/` for active and accepted requirements, especially changes that affect platform boundaries.

If a future `CONTEXT-MAP.md` appears at the repo root, treat the repo as multi-context and follow the map to the relevant per-context `CONTEXT.md` files.

## Before exploring

Read the current domain docs that touch the area you are about to work in. If `CONTEXT.md` or `docs/adr/` does not exist yet, proceed silently and rely on `openspec/`, source code, and tests.

For platform, module, plugin, database, API, auth, admin, or infrastructure work, also read the active Cloudflare commerce blueprint referenced in `AGENTS.md` before implementing.

## Use the glossary's vocabulary

When output names a domain concept in an issue title, PRD, refactor proposal, hypothesis, or test name, use the term as defined in `CONTEXT.md`.

If the concept is missing from the glossary, either avoid inventing new language or note the gap for a future docs update.

## Flag ADR conflicts

If proposed work contradicts an existing ADR, surface the conflict explicitly before implementing.

# Ultracite Code Standards

This project uses **Ultracite**, a zero-config preset that enforces strict code quality standards through automated formatting and linting.

## Quick Reference

- **Format code**: `bun x ultracite fix`
- **Check for issues**: `bun x ultracite check`
- **Diagnose setup**: `bun x ultracite doctor`

Oxlint + Oxfmt (the underlying engine) provides robust linting and formatting. Most issues are automatically fixable.

---

## Architecture Blueprint

Before implementing platform, module, plugin, database, API, auth, admin, or infrastructure work, agents MUST read the current blueprint first:

- `openspec/changes/define-cloudflare-commerce-blueprint/proposal.md`
- `openspec/changes/define-cloudflare-commerce-blueprint/design.md`
- `openspec/changes/define-cloudflare-commerce-blueprint/specs/**/*.md`
- `openspec/changes/define-cloudflare-commerce-blueprint/tasks.md`

Treat that blueprint as the source of truth for package boundaries until it is superseded by a newer accepted OpenSpec change. If an implementation choice conflicts with the blueprint, stop and create or update an OpenSpec proposal instead of silently drifting the architecture.

After finishing implementation work, agents MUST sync the planning state:

- Update the relevant OpenSpec task checkboxes for the change being applied.
- Run `openspec status --change "<change-name>"` and confirm the expected artifacts/tasks are complete.
- If accepted implementation changes alter requirements, sync the affected specs before closing the job.
- If new micro work is discovered, capture it in the active change or propose a follow-up change rather than leaving it only in chat.

## Target Project Structure

The intended long-term structure is a Cloudflare-first, Medusa-inspired commerce platform with strict runtime boundaries:

```text
ecommerce/
├── apps/
│   ├── server/                  # Cloudflare Worker composition: Hono, auth mount, oRPC/OpenAPI, runtime bindings
│   └── web/                     # TanStack Start admin dashboard; no Effect runtime or Cloudflare binding imports
├── packages/
│   ├── core/                    # Commerce kernel: module contracts, Effect service tags, events, workflows, plugin contracts
│   ├── api/                     # oRPC router assembly from auth, modules, and plugin route fragments
│   ├── auth/                    # Shared auth/session/user/permission types, Better Auth factories, auth service contracts
│   ├── db/                      # Shared Kysely database contracts and migration coordination
│   ├── db-d1/                   # Cloudflare D1 Kysely adapter, D1 migrations, request-scoped D1 behavior
│   ├── db-libsql/               # Future SQLite/libSQL Kysely adapter
│   ├── db-postgres/             # Future PostgreSQL Kysely adapter
│   ├── modules/
│   │   ├── store/               # Store configuration and defaults
│   │   ├── customer/            # Customer domain
│   │   ├── product/             # Product catalog domain
│   │   ├── pricing/             # Prices, currencies, price lists, discounts
│   │   ├── inventory/           # Inventory items, reservations, stock locations
│   │   ├── cart/                # Cart domain and cart workflows
│   │   ├── order/               # Order domain and order workflows
│   │   ├── payment/             # Payment service contract and providers
│   │   └── fulfillment/         # Fulfillment service contract and providers
│   ├── platform-cloudflare/     # Cloudflare bindings, Worker Loader runtime, bridge APIs, R2/KV/Queue/Cron adapters
│   ├── infra/                   # Alchemy stacks and Cloudflare resource graph
│   ├── ui/                      # Shared admin UI primitives
│   └── config/                  # Shared TypeScript/build/tooling config
├── openspec/                    # Proposals, designs, specs, and task state
└── refs/                        # Ignored reference implementations: Medusa, EmDash, merchant
```

Boundary rules:

- `packages/core` and pure commerce modules MUST NOT import `cloudflare:workers`, Hono server types, TanStack Start UI code, or concrete database adapter runtime packages.
- `apps/server` is composition only; reusable auth, module, workflow, plugin, and database contracts belong in packages.
- `packages/auth` is shared. Other packages should import auth/session/permission types from it, never from `apps/server`.
- Database support is adapter-based and Kysely is the primary relational storage abstraction. D1 is first class for Cloudflare, but module logic must depend on database/repository contracts rather than D1 directly.
- Plugins have two tiers: trusted native plugins and sandboxed Dynamic Worker plugins through Cloudflare Worker Loader with capability-enforced bridge APIs.
- Admin extensibility is metadata-driven. Modules and plugins contribute navigation, screens, widgets, permissions, and API references through typed contracts.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Documentation

- Treat missing comments as a maintainability issue when code crosses package, runtime, database, auth, plugin, workflow, or module boundaries.
- Add JSDoc for exported functions, classes, service contracts, Effect service tags, repository interfaces, module/plugin extension points, public API handlers, and shared React components.
- Add brief explanatory comments for complicated logic, non-obvious invariants, boundary constraints, domain rules, data migrations, concurrency behavior, auth/session assumptions, and Cloudflare runtime limitations.
- When touching under-commented code, leave it better documented in the same patch, especially around why a branch exists, which contract it preserves, and what future modifiers must not break.
- Prefer comments that explain intent, constraints, or tradeoffs rather than restating the code.
- Do not add filler comments for obvious assignments, simple JSX structure, or self-explanatory helper functions.

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Use proper image components (e.g., Next.js `<Image>`) over `<img>` tags

### Framework-Specific Guidance

**Next.js:**

- Use Next.js `<Image>` component for images
- Use `next/head` or App Router metadata API for head elements
- Use Server Components for async data fetching instead of async Client Components

**React 19+:**

- Use ref as a prop instead of `React.forwardRef`

**Solid/Svelte/Vue/Qwik:**

- Use `class` and `for` attributes (not `className` or `htmlFor`)

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Oxlint + Oxfmt Can't Help

Oxlint + Oxfmt's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Oxlint + Oxfmt can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Oxlint + Oxfmt. Run `bun x ultracite fix` before committing to ensure compliance.

## Agent skills

### Repo workflows

- Start the full local stack: `bun run dev`
- Start only the web app: `bun run dev:web`
- Start only the server: `bun run dev:server`
- Build everything: `bun run build`
- Check types across apps: `bun run check-types`
- Run local tests: `bun run test`
- Run credential-gated deploy smoke tests: `bun run test:integration`
- Deploy or destroy the selected infra stage: `bun run deploy` / `bun run destroy`
- Generate or push D1 schema changes: `bun run db:generate` / `bun run db:push`
- Run formatting and lint checks or fixes: `bun run check` / `bun run fix`
- Add shared UI primitives: `npx shadcn@latest add accordion dialog popover sheet table -c packages/ui`
- Add app-specific UI blocks by running the shadcn CLI from `apps/web`

### OpenSpec workflows

- Discover changes: `openspec list --json`
- Start a new change: `openspec new change "<name>"`
- Check change status: `openspec status --change "<name>" --json`
- Get artifact instructions: `openspec instructions <artifact-id> --change "<name>" --json`
- Apply a change: `openspec instructions apply --change "<name>" --json`
- Keep blueprint-linked specs in sync with implementation via `openspec-sync-specs`
- Archive a completed change only after status is complete and tasks are checked off

### Issue tracker

Issues and PRDs are tracked in GitHub Issues for `escwxyz/ecommerce`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default Matt Pocock skills triage vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This repo currently uses a single-context domain-doc layout, with root-level docs preferred when present. See `docs/agents/domain.md`.

# ecommerce

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines React, TanStack Start, Hono, ORPC, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **TanStack Start** - SSR framework with TanStack Router
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **Shared UI package** - shadcn/ui primitives live in `packages/ui`
- **Hono** - Lightweight, performant server framework
- **oRPC** - End-to-end type-safe APIs with OpenAPI integration
- **workers** - Runtime environment
- **Drizzle** - TypeScript-first ORM
- **SQLite/Turso** - Database engine
- **Authentication** - Better-Auth
- **Oxlint** - Oxlint + Oxfmt (linting & formatting)
- **Turborepo** - Optimized monorepo build system

## Architecture

The repo is moving from a bootstrap app into a Cloudflare-first commerce platform. The accepted blueprint and implementation roadmap live in:

- `openspec/changes/define-cloudflare-commerce-blueprint/`
- `docs/architecture-roadmap.md`

Agents and contributors should read those before changing package boundaries, module structure, plugin architecture, auth contracts, or database adapters.

The first implementation slice is now in place as `packages/core`, which holds the platform-independent runtime kernel for shared service contracts, module definitions, events, workflows, plugins, and boundary tests.

## Getting Started

First, install the dependencies:

```bash
bun install
```

## Database Setup

This project uses SQLite with Drizzle ORM.

1. Start the local SQLite database (optional):
   D1 local development and migrations are handled automatically by Alchemy during dev and deploy.

2. Update your `.env` file in the `apps/server` directory with the appropriate connection details if needed.

3. Apply the schema to your database:

```bash
bun run db:push
```

Then, run the development server:

```bash
bun run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the web application.
The API is running at [http://localhost:3000](http://localhost:3000).

## UI Customization

React web apps in this stack share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json` and `apps/web/components.json`

### Add more shared components

Run this from the project root to add more primitives to the shared UI package:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import shared components like this:

```tsx
import { Button } from "@ecommerce/ui/components/button";
```

### Add app-specific blocks

If you want to add app-specific blocks instead of shared primitives, run the shadcn CLI from `apps/web`.

## Cloudflare Infrastructure via Alchemy

The deployment stack lives in `packages/infra/alchemy.run.ts` and uses Alchemy v2's Effect stack model:

- `Cloudflare.D1Database` provisions the shared D1 database and applies SQL files from `packages/db/src/migrations`.
- `Cloudflare.Worker` deploys the Hono + oRPC API from `apps/server/src/index.ts`.
- `Cloudflare.Vite` deploys the TanStack Start admin app from `apps/web`.
- Runtime values are declared through Alchemy `env` bindings. The installed Alchemy v2 beta uses `env`, not the older `bindings` property, and `Cloudflare.Vite`, not `TanStackStart`.

Required local environment variables:

- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `CORS_ORIGIN`
- `VITE_SERVER_URL`
- `ALCHEMY_PASSWORD`

Cloudflare deploy and integration-test credentials:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Useful commands:

- `bun run dev`: start the Alchemy-managed local Cloudflare stack
- `bun run deploy`: deploy the stack through `@ecommerce/infra`
- `bun run destroy`: destroy the selected stack stage
- `bun run test`: run local no-credential tests
- `bun run test:integration`: run credential-gated Alchemy deploy smoke tests

The frontend remains ordinary React/TanStack Start code. Effect is reserved for infrastructure, backend runtime support, and tests.

## Git Hooks and Formatting

- Format and lint fix: `bun run fix`

## Project Structure

```
ecommerce/
├── apps/
│   ├── web/                     # TanStack Start admin dashboard
│   └── server/                  # Cloudflare Worker composition and transport
├── packages/
│   ├── core/                    # Commerce runtime kernel
│   ├── modules/                 # Planned commerce modules
│   ├── platform-cloudflare/     # Planned Cloudflare runtime adapters
│   ├── ui/                      # Shared admin UI primitives
│   ├── api/                     # oRPC router assembly
│   ├── auth/                    # Shared auth contracts and runtime factory
│   ├── db/                      # Shared database contracts and schema coordination
│   ├── infra/                   # Alchemy stacks and Cloudflare resources
│   ├── env/                     # Typed environment access
│   └── config/                  # Shared TS/build/tooling config
├── docs/
│   └── architecture-roadmap.md  # Blueprint decisions and follow-up roadmap
├── openspec/                    # Change proposals, designs, specs, and tasks
```

## Available Scripts

- `bun run dev`: Start all applications in development mode
- `bun run build`: Build all applications
- `bun run dev:web`: Start only the web application
- `bun run dev:server`: Start only the server
- `bun run check-types`: Check TypeScript types across all apps
- `bun run db:push`: Push schema changes to database
- `bun run db:generate`: Generate database client/types
- `bun run check`: Run Oxlint and Oxfmt

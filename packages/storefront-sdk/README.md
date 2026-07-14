# Storefront SDK

`@ecommerce/storefront-sdk` exposes the storefront Effect `HttpApi` contract to
frontend and edge consumers without embedding commerce business logic.

## Public HTTP transport

Use `@ecommerce/storefront-sdk/http` for public HTTP calls from browsers and
server runtimes that provide WHATWG `fetch`, such as TanStack Start, Next.js,
Cloudflare Workers, modern Node, and Bun:

```ts
import { Effect } from "effect";
import { createStorefrontHttpClient } from "@ecommerce/storefront-sdk/http";

const program = Effect.gen(function* () {
  const client = yield* createStorefrontHttpClient({
    baseUrl: "https://store.example",
  });

  return client;
});
```

The HTTP transport is backed by Effect's `HttpApiClient` and
`FetchHttpClient.layer`. It may accept a custom `fetch` for tests or alternate
fetch-compatible runtimes, but it must not import Cloudflare bindings, server runtime
composition, repository Layers, SQL clients, or credentials.

`@ecommerce/storefront-sdk/browser` remains a browser-safe compatibility alias
for callers that want an explicitly browser-named import. New shared fullstack
code should prefer `@ecommerce/storefront-sdk/http` to avoid implying that the
transport cannot run on the server.

The Cloudflare Service Binding transport is server-only and will be added under
a separate export in task 4.8.

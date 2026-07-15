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
fetch-compatible runtimes, but it must not import Cloudflare bindings, server
runtime composition, repository Layers, SQL clients, or credentials.

`@ecommerce/storefront-sdk/browser` remains a browser-safe compatibility alias
for callers that want an explicitly browser-named import. New shared fullstack
code should prefer `@ecommerce/storefront-sdk/http` to avoid implying that the
transport cannot run on the server.

## Cloudflare Service Binding transport

Use `@ecommerce/storefront-sdk/cloudflare` only from Cloudflare Worker or SSR
code that receives a backend Worker Service Binding:

```ts
import { Effect } from "effect";
import { createStorefrontServiceBindingClient } from "@ecommerce/storefront-sdk/cloudflare";

interface Env {
  readonly BACKEND_API: {
    fetch(
      input: Parameters<typeof globalThis.fetch>[0],
      init?: RequestInit
    ): Promise<Response>;
  };
}

const program = (env: Env) =>
  Effect.gen(function* () {
    const client = yield* createStorefrontServiceBindingClient({
      binding: env.BACKEND_API,
    });

    return client;
  });
```

The Service Binding transport still crosses the same Effect HTTP contract via
the binding's `fetch` method. It does not call domain services directly and is
not exported from the package root, so browser and generic fullstack code keep
using the public `http` export.

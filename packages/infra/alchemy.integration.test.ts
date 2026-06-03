import { expect } from "bun:test";

import * as Cloudflare from "alchemy/Cloudflare";
import * as Test from "alchemy/Test/Bun";
import * as Effect from "effect/Effect";

import Stack from "./alchemy.run";

const hasCloudflareCredentials = Boolean(
  process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID
);
const stage = `test-${Date.now()}`;
const { test, deploy, destroy } = Test.make({
  providers: Cloudflare.providers(),
  state: Cloudflare.state(),
});

test.skipIf(!hasCloudflareCredentials)(
  "deploys an isolated stack and verifies deployed endpoints",
  Effect.gen(function* () {
    const stack = yield* deploy(Stack, { stage });

    yield* Effect.addFinalizer(() =>
      destroy(Stack, { stage }).pipe(Effect.ignore)
    );

    expect(stack.apiUrl).toBeString();
    expect(stack.adminUrl).toBeString();
    expect(stack.databaseId).toBeString();

    const apiUrl = stack.apiUrl;

    if (!apiUrl) {
      throw new Error(`Alchemy stack stage ${stage} did not return an API URL`);
    }

    const healthResponse = yield* Effect.tryPromise(() => fetch(apiUrl));

    expect(healthResponse.status).toBe(200);
    expect(yield* Effect.tryPromise(() => healthResponse.text())).toBe("OK");

    const rpcResponse = yield* Effect.tryPromise(() =>
      fetch(`${apiUrl}/rpc/healthCheck`, {
        method: "POST",
        body: JSON.stringify({ json: null }),
        headers: {
          "Content-Type": "application/json",
        },
      })
    );

    expect(rpcResponse.ok).toBe(true);
  })
);

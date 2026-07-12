import { describe, expect, it } from "bun:test";

import { createEffectWorkerCanary } from "./effect-worker-canary";

describe("Effect Cloudflare Worker canary", () => {
  it("serves a Fetch-compatible response without Hono", async () => {
    const worker = createEffectWorkerCanary();

    try {
      const response = await worker.fetch(
        new Request("https://commerce.example/health")
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: "ok" });
    } finally {
      await worker.dispose();
    }
  });
});

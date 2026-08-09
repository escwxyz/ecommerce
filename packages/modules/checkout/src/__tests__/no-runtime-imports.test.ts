import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const sourceRoot = join(import.meta.dir, "..");
const forbiddenImports = [
  "cloudflare:workers",
  "hono",
  "@orpc/",
  "zod",
  "kysely",
  "kysely-d1",
  "@ecommerce/db-d1",
  "@ecommerce/platform-cloudflare",
  "@tanstack/react",
] as const;

const listTypeScriptFiles = (directory: string): readonly string[] => {
  const files: string[] = [];

  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      files.push(...listTypeScriptFiles(path));
      continue;
    }

    if (entry.endsWith(".ts")) {
      files.push(path);
    }
  }

  return files;
};

describe("checkout module import boundaries", () => {
  it("does not import runtime-specific modules or private module internals", () => {
    const violations: string[] = [];

    for (const file of listTypeScriptFiles(sourceRoot)) {
      const content = readFileSync(file, "utf8");

      for (const forbiddenImport of forbiddenImports) {
        if (content.includes(`from "${forbiddenImport}`)) {
          violations.push(`${file}: ${forbiddenImport}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps checkout orchestration on one Effect execution model", async () => {
    const checkoutServiceSource = await Bun.file(
      new URL("../services/checkout.service.ts", import.meta.url)
    ).text();
    const paymentServiceSource = await Bun.file(
      new URL(
        "../../../payment/src/services/payment.service.ts",
        import.meta.url
      )
    ).text();
    const fulfillmentServiceSource = await Bun.file(
      new URL(
        "../../../fulfillment/src/services/fulfillment.service.ts",
        import.meta.url
      )
    ).text();

    expect(checkoutServiceSource).not.toContain("Promise<");
    expect(checkoutServiceSource).not.toContain("Effect.runPromise");
    expect(checkoutServiceSource).not.toMatch(/Checkout\w+Contract/);
    expect(paymentServiceSource).not.toContain(
      "createPaymentPromiseServiceFromEffectService"
    );
    expect(fulfillmentServiceSource).not.toContain(
      "createFulfillmentPromiseServiceFromEffectService"
    );
  });
});

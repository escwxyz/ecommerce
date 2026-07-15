import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { basename, join } from "node:path";

const packageRoot = join(import.meta.dir, "..", "..");
const sourceRoot = join(packageRoot, "src");
const publicBrowserEntryFiles = ["index.ts", "http.ts", "browser.ts"] as const;
const serverOnlyEntryFile = "cloudflare.ts";
const packageManifest = JSON.parse(
  readFileSync(join(packageRoot, "package.json"), "utf8")
) as {
  readonly exports?: Record<string, { readonly default?: string }>;
};

const importSpecifierPatterns = [
  /(?:import|export)\s+(?:type\s+)?[^;]*?\s+from\s+["']([^"']+)["']/gu,
  /\bimport\s+["']([^"']+)["']/gu,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/gu,
] as const;
const serverRuntimeSpecifierPattern =
  /^(?:cloudflare:workers|@cloudflare\/workers-types|@ecommerce\/platform-cloudflare|server)(?:\/|$)/u;

const extractImportSpecifiers = (source: string): readonly string[] => {
  const specifiers: string[] = [];

  for (const pattern of importSpecifierPatterns) {
    for (const match of source.matchAll(pattern)) {
      const [, specifier] = match;

      if (specifier) {
        specifiers.push(specifier);
      }
    }
  }

  return specifiers;
};

describe("storefront SDK browser bundle boundaries", () => {
  it("keeps the server-only Cloudflare transport out of public browser exports", () => {
    expect(packageManifest.exports?.["."]?.default).toBe("./src/index.ts");
    expect(packageManifest.exports?.["./http"]?.default).toBe("./src/http.ts");
    expect(packageManifest.exports?.["./browser"]?.default).toBe(
      "./src/browser.ts"
    );
    expect(packageManifest.exports?.["./cloudflare"]?.default).toBe(
      "./src/cloudflare.ts"
    );

    for (const entryFile of publicBrowserEntryFiles) {
      const source = readFileSync(join(sourceRoot, entryFile), "utf8");

      expect(source).not.toContain(
        `./${serverOnlyEntryFile.replace(".ts", "")}`
      );
      expect(source).not.toContain("@ecommerce/storefront-sdk/cloudflare");
    }
  });

  it("prevents browser-safe SDK entries from importing server runtime bindings", () => {
    const violations = publicBrowserEntryFiles.flatMap((entryFile) => {
      const source = readFileSync(join(sourceRoot, entryFile), "utf8");

      return extractImportSpecifiers(source)
        .filter((specifier) => serverRuntimeSpecifierPattern.test(specifier))
        .map((specifier) => ({
          file: basename(entryFile),
          specifier,
        }));
    });

    expect(violations).toEqual([]);
  });
});

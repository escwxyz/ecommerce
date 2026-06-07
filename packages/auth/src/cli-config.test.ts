import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const packageJsonPath = join(import.meta.dir, "..", "package.json");
const cliConfigPath = join(import.meta.dir, "cli-auth.ts");

describe("better auth cli config", () => {
  it("generates migrations from a CLI-safe exported auth instance", () => {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      readonly scripts?: Record<string, string>;
    };
    const generateScript = packageJson.scripts?.["auth:gen"] ?? "";
    const cliConfigSource = readFileSync(cliConfigPath, "utf8");

    expect(generateScript).toContain("--config ./src/cli-auth.ts");
    expect(cliConfigSource).toMatch(/export const auth(?:: [^=]+)? =/);
  });
});

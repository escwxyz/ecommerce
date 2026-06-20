import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { getDevelopmentSeedWranglerArguments } from "./command";
import { generateDevelopmentSeedSql } from "./index";

const packageRoot = fileURLToPath(new URL("../..", import.meta.url));
const artifactDirectory = join(packageRoot, ".wrangler");
const artifactPath = join(artifactDirectory, "development-seed.sql");

await mkdir(artifactDirectory, { recursive: true });
await Bun.write(artifactPath, generateDevelopmentSeedSql());

const process = Bun.spawn(
  ["wrangler", ...getDevelopmentSeedWranglerArguments(artifactPath)],
  {
    cwd: packageRoot,
    stderr: "inherit",
    stdin: "inherit",
    stdout: "inherit",
  }
);
const exitCode = await process.exited;

if (exitCode !== 0) {
  throw new Error(`Local D1 seed failed with exit code ${exitCode}.`);
}

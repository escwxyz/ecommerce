import { developmentSeedWrites } from "./fixtures";
import { generateSeedSql } from "./sql";

export { getDevelopmentSeedWranglerArguments } from "./command";
export { developmentSeedIds, developmentSeedWrites } from "./fixtures";

/** Generates the exact deterministic SQL artifact executed by local Wrangler. */
export const generateDevelopmentSeedSql = (): string =>
  generateSeedSql(developmentSeedWrites);

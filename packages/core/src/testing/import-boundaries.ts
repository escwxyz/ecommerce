import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** Source file loaded for import-boundary scanning. */
export interface ImportBoundaryFile {
  readonly path: string;
  readonly source: string;
}

/** One named import rule with optional exact/prefix exceptions. */
export interface ImportBoundaryRule {
  readonly allowedSpecifiers?: readonly string[];
  readonly forbiddenSpecifiers: readonly string[];
  readonly name: string;
}

/** Complete import-boundary policy for one package or package subtree. */
export interface ImportBoundary {
  readonly packageName: string;
  readonly rootDir: string;
  readonly rules: readonly ImportBoundaryRule[];
}

/** Single forbidden import found while scanning a package boundary. */
export interface ImportBoundaryViolation {
  readonly filePath: string;
  readonly packageName: string;
  readonly ruleName: string;
  readonly specifier: string;
}

/** Options for the standard legacy backend import ban. */
export interface LegacyBackendImportBoundaryOptions {
  readonly allowedSpecifiers?: readonly string[];
  readonly extraForbiddenSpecifiers?: readonly string[];
  readonly packageName: string;
  readonly rootDir: string;
}

/** Options for scanning already-loaded source files. */
export interface ScanImportBoundaryViolationsOptions {
  readonly boundary: ImportBoundary;
  readonly files: readonly ImportBoundaryFile[];
}

/** Options for recursively loading source files from disk. */
export interface CollectImportBoundarySourceFilesOptions {
  readonly exclude?: (path: string) => boolean;
  readonly rootDir: string;
}

/** Baseline legacy backend/runtime imports banned from completed Effect packages. */
export const legacyBackendForbiddenSpecifiers = [
  "hono",
  "@orpc",
  "zod",
  "kysely",
  "kysely-d1",
  "cloudflare:workers",
  "@cloudflare/workers-types",
  "@ecommerce/platform-cloudflare",
] as const;

const importSpecifierPatterns = [
  /(?:import|export)\s+(?:type\s+)?[^;]*?\s+from\s+["']([^"']+)["']/gu,
  /\bimport\s+["']([^"']+)["']/gu,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/gu,
] as const;
const lineCommentPattern = /\/\/.*$/gmu;
const blockCommentPattern = /\/\*[\s\S]*?\*\//gu;
const sourceFilePattern = /\.(?:ts|tsx|mts|cts)$/u;

const stripComments = (source: string): string =>
  source.replace(blockCommentPattern, "").replace(lineCommentPattern, "");

const matchesSpecifier = (specifier: string, candidate: string): boolean =>
  specifier === candidate || specifier.startsWith(`${candidate}/`);

const isAllowed = (
  specifier: string,
  allowedSpecifiers: readonly string[] | undefined
): boolean =>
  allowedSpecifiers?.some((candidate) =>
    matchesSpecifier(specifier, candidate)
  ) ?? false;

const isForbidden = (
  specifier: string,
  forbiddenSpecifiers: readonly string[]
): boolean =>
  forbiddenSpecifiers.some((candidate) =>
    matchesSpecifier(specifier, candidate)
  );

/** Extracts static, side-effect, dynamic, and TS import-type specifiers. */
export const extractImportSpecifiers = (source: string): readonly string[] => {
  const specifiers: {
    readonly index: number;
    readonly specifier: string;
  }[] = [];
  const strippedSource = stripComments(source);

  for (const pattern of importSpecifierPatterns) {
    for (const match of strippedSource.matchAll(pattern)) {
      const [, specifier] = match;

      if (specifier) {
        specifiers.push({
          index: match.index,
          specifier,
        });
      }
    }
  }

  return specifiers
    .toSorted((left, right) => left.index - right.index)
    .map(({ specifier }) => specifier);
};

/** Builds the standard Hono/oRPC/Zod/Kysely/Cloudflare import ban for a package. */
export const createLegacyBackendImportBoundary = ({
  allowedSpecifiers,
  extraForbiddenSpecifiers = [],
  packageName,
  rootDir,
}: LegacyBackendImportBoundaryOptions): ImportBoundary => ({
  packageName,
  rootDir,
  rules: [
    {
      allowedSpecifiers,
      forbiddenSpecifiers: [
        ...legacyBackendForbiddenSpecifiers,
        ...extraForbiddenSpecifiers,
      ],
      name: "legacy-backend-imports",
    },
  ],
});

/** Scans virtual source files against an import boundary without touching disk. */
export const scanImportBoundaryViolations = ({
  boundary,
  files,
}: ScanImportBoundaryViolationsOptions): readonly ImportBoundaryViolation[] => {
  const violations: ImportBoundaryViolation[] = [];

  for (const file of files) {
    const specifiers = new Set(extractImportSpecifiers(file.source));

    for (const specifier of specifiers) {
      for (const rule of boundary.rules) {
        if (
          isAllowed(specifier, rule.allowedSpecifiers) ||
          !isForbidden(specifier, rule.forbiddenSpecifiers)
        ) {
          continue;
        }

        violations.push({
          filePath: file.path,
          packageName: boundary.packageName,
          ruleName: rule.name,
          specifier,
        });
      }
    }
  }

  return violations;
};

/** Recursively reads TypeScript source files for import-boundary tests. */
export const collectImportBoundarySourceFiles = ({
  exclude,
  rootDir,
}: CollectImportBoundarySourceFilesOptions): readonly ImportBoundaryFile[] => {
  const files: ImportBoundaryFile[] = [];

  for (const entry of readdirSync(rootDir)) {
    const path = join(rootDir, entry);
    const stats = statSync(path);

    if (exclude?.(path)) {
      continue;
    }

    if (stats.isDirectory()) {
      files.push(
        ...collectImportBoundarySourceFiles({ exclude, rootDir: path })
      );
      continue;
    }

    if (sourceFilePattern.test(entry)) {
      files.push({ path, source: readFileSync(path, "utf-8") });
    }
  }

  return files;
};

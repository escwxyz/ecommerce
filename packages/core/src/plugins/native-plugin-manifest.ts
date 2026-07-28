import { Schema } from "effect";

const pluginIdentifierPattern =
  /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*(?::[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*)*$/u;
const semanticVersionPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const runtimeSpecificCapabilityPrefixes = new Set([
  "aws",
  "binding",
  "bindings",
  "bun",
  "cloudflare",
  "drizzle",
  "node",
  "postgres",
  "secret",
  "secrets",
  "sql",
  "vercel",
]);

const isPositiveInteger = (value: number): boolean =>
  Number.isInteger(value) && value > 0;

const hasUniqueCapabilityKeys = (
  capabilities: readonly NativePluginCapability[]
): boolean =>
  new Set(capabilities.map((capability) => capability.key)).size ===
  capabilities.length;

const isRuntimeNeutralCapabilityKey = (value: string): boolean => {
  const [namespace] = value.split(":");
  return !runtimeSpecificCapabilityPrefixes.has(namespace ?? "");
};

export const NativePluginTrimmedStringSchema = Schema.NonEmptyString.pipe(
  Schema.check(Schema.makeFilter((value: string) => value.trim() === value))
);

export const NativePluginIdSchema = NativePluginTrimmedStringSchema.pipe(
  Schema.check(Schema.isPattern(pluginIdentifierPattern)),
  Schema.brand("NativePluginId")
);

export const NativePluginVersionSchema = NativePluginTrimmedStringSchema.pipe(
  Schema.check(Schema.isPattern(semanticVersionPattern)),
  Schema.brand("NativePluginVersion")
);

export const NativePluginSchemaVersionSchema = Schema.Number.pipe(
  Schema.check(Schema.makeFilter(isPositiveInteger))
);

export const NativePluginCapabilityKeySchema =
  NativePluginTrimmedStringSchema.pipe(
    Schema.check(Schema.isPattern(pluginIdentifierPattern)),
    Schema.check(
      Schema.makeFilter((value: string): boolean => value.includes(":"))
    ),
    Schema.check(Schema.makeFilter(isRuntimeNeutralCapabilityKey)),
    Schema.brand("NativePluginCapabilityKey")
  );

/**
 * Declares a portable host capability required by trusted plugin code.
 *
 * Capability keys identify runtime-neutral service contracts. They must never
 * name Cloudflare bindings, SQL clients, secrets, or concrete adapter values.
 * Runtime composition decides which platform Layer satisfies each key.
 */
export const NativePluginCapabilitySchema = Schema.Struct({
  key: NativePluginCapabilityKeySchema,
  required: Schema.Boolean,
});

export type NativePluginCapability = typeof NativePluginCapabilitySchema.Type;

export const NativePluginCapabilityListSchema = Schema.Array(
  NativePluginCapabilitySchema
).pipe(Schema.check(Schema.makeFilter(hasUniqueCapabilityKeys)));

/**
 * Versioned, serializable manifest for a trusted in-process plugin.
 *
 * Executable contributions and Effect Layers are intentionally excluded:
 * task 10.2 composes those values only after this manifest has decoded.
 */
export const NativePluginManifestSchema = Schema.Struct({
  capabilities: NativePluginCapabilityListSchema,
  id: NativePluginIdSchema,
  schemaVersion: NativePluginSchemaVersionSchema,
  tier: Schema.Literal("native"),
  version: NativePluginVersionSchema,
});

export type NativePluginManifest = typeof NativePluginManifestSchema.Type;
export type NativePluginManifestInput = Omit<
  typeof NativePluginManifestSchema.Encoded,
  "schemaVersion" | "tier"
> & {
  readonly schemaVersion?: number;
};

/**
 * Decodes an unknown native manifest and deterministically orders its
 * capabilities.
 */
export const decodeNativePluginManifest = (
  input: unknown
): NativePluginManifest => {
  const manifest = Schema.decodeUnknownSync(NativePluginManifestSchema)(input);

  return {
    ...manifest,
    capabilities: manifest.capabilities.toSorted((left, right) =>
      left.key.localeCompare(right.key)
    ),
  };
};

/**
 * Adds native-only defaults before decoding a source registration manifest.
 */
export const createNativePluginManifest = (
  input: NativePluginManifestInput
): NativePluginManifest =>
  decodeNativePluginManifest({
    ...input,
    schemaVersion: input.schemaVersion ?? 1,
    tier: "native",
  });

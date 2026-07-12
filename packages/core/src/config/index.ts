import type { Redacted } from "effect";
import { Config, Schema } from "effect";

/** A required non-empty configuration string decoded by Effect Config. */
export const nonEmptyStringConfig = (name: string): Config.Config<string> =>
  Config.schema(Schema.NonEmptyString, name);

/** A required TCP port validated by Effect Config. */
export const requiredPortConfig = (name: string): Config.Config<number> =>
  Config.port(name);

/** A validated TCP port whose default applies only when the key is absent. */
export const portConfigWithDefault = (
  name: string,
  defaultValue: number
): Config.Config<number> =>
  Config.port(name).pipe(Config.withDefault(defaultValue));

/** A required absolute URL decoded by Effect Config. */
export const urlConfig = (name: string): Config.Config<URL> => Config.url(name);

/**
 * A required secret that remains wrapped in `Redacted` until a trusted adapter
 * boundary explicitly unwraps it.
 */
export const secretConfig = (
  name: string
): Config.Config<Redacted.Redacted<string>> => Config.redacted(name);

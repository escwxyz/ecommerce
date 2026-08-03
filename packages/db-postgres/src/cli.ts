import { Effect, Layer } from "effect";
import type { Effect as EffectValue } from "effect/Effect";

import type { EffectPostgresClient, PostgresDrizzleService } from "./index";
import {
  createPostgresClientLayer,
  createPostgresDrizzleLayer,
  createPostgresPoolConfig,
  getPostgresMigrationStatus,
  resetPostgresDevelopmentDatabase,
  rollbackPostgresDevelopmentDatabase,
  runPostgresMigrations,
  seedPostgresDevelopmentDatabase,
} from "./index";

type CliCommand =
  | "migrate"
  | "rollback-development"
  | "reset-and-seed-development"
  | "reset-development"
  | "seed-development"
  | "status";

const args = process.argv.slice(2);
const [command] = args;
const allowDestructive = args.includes("--confirm-development-reset");

const printUsageAndExit = (): never => {
  console.error(
    [
      "Usage: bun ./src/cli.ts <command>",
      "",
      "Commands:",
      "  status",
      "  migrate",
      "  rollback-development --confirm-development-reset",
      "  reset-and-seed-development --confirm-development-reset",
      "  reset-development --confirm-development-reset",
      "  seed-development",
      "",
      "Required environment:",
      "  POSTGRES_URL",
    ].join("\n")
  );
  process.exit(1);
};

const isCliCommand = (value: string | undefined): value is CliCommand =>
  value === "status" ||
  value === "migrate" ||
  value === "rollback-development" ||
  value === "reset-and-seed-development" ||
  value === "reset-development" ||
  value === "seed-development";

if (!isCliCommand(command)) {
  printUsageAndExit();
}

const postgresUrl = process.env.POSTGRES_URL;

if (!postgresUrl) {
  console.error("POSTGRES_URL is required for PostgreSQL migration commands");
  process.exit(1);
}

const asCliResult = <A, E, R>(
  effect: EffectValue<A, E, R>
): EffectValue<unknown, unknown, R> =>
  effect.pipe(Effect.map(toCliResult), Effect.mapError(toCliError));

const toCliResult = (result: unknown): unknown => result;

const toCliError = (error: unknown): unknown => error;

const postgresConfig = createPostgresPoolConfig({
  applicationName: "@ecommerce/db-postgres:migrations",
  maxConnections: 1,
  url: postgresUrl,
});
const postgresClientLayer = createPostgresClientLayer(postgresConfig);

const postgresLayer = Layer.merge(
  postgresClientLayer,
  createPostgresDrizzleLayer().pipe(Layer.provide(postgresClientLayer))
);

const program: EffectValue<
  unknown,
  unknown,
  EffectPostgresClient | PostgresDrizzleService
> = (() => {
  switch (command) {
    case "migrate": {
      return asCliResult(
        Effect.as(runPostgresMigrations(), {
          command,
          status: "applied",
        })
      );
    }
    case "rollback-development": {
      return asCliResult(
        rollbackPostgresDevelopmentDatabase({ allowDestructive })
      );
    }
    case "reset-and-seed-development": {
      return asCliResult(
        resetPostgresDevelopmentDatabase({ allowDestructive }).pipe(
          Effect.andThen(runPostgresMigrations()),
          Effect.andThen(seedPostgresDevelopmentDatabase())
        )
      );
    }
    case "reset-development": {
      return asCliResult(
        resetPostgresDevelopmentDatabase({ allowDestructive })
      );
    }
    case "seed-development": {
      return asCliResult(seedPostgresDevelopmentDatabase());
    }
    case "status": {
      return asCliResult(getPostgresMigrationStatus());
    }
    default: {
      return printUsageAndExit();
    }
  }
})();

try {
  const result = await Effect.runPromise(
    program.pipe(Effect.provide(postgresLayer))
  );
  console.log(JSON.stringify(result, null, 2));
} catch (error: unknown) {
  console.error(JSON.stringify(error, null, 2));
  process.exit(1);
}

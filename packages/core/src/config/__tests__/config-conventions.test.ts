import { describe, expect, it } from "bun:test";

import { Config, ConfigProvider, Effect, Exit, Redacted } from "effect";

import {
  nonEmptyStringConfig,
  portConfigWithDefault,
  requiredPortConfig,
  secretConfig,
  urlConfig,
} from "../index";

const BackendConfig = Config.all({
  databaseUrl: secretConfig("DATABASE_URL"),
  name: nonEmptyStringConfig("NAME"),
  port: portConfigWithDefault("PORT", 3000),
  publicUrl: urlConfig("PUBLIC_URL"),
}).pipe(Config.nested("SERVICE"));

describe("Effect Config and Redacted conventions", () => {
  it("decodes validated config through an injected provider Layer", async () => {
    const configLayer = ConfigProvider.layer(
      ConfigProvider.fromUnknown({
        SERVICE: {
          DATABASE_URL: "postgres://commerce:secret@localhost/commerce",
          NAME: "commerce-api",
          PORT: 8787,
          PUBLIC_URL: "https://commerce.example.com",
        },
      })
    );
    const config = await Effect.runPromise(
      BackendConfig.pipe(Effect.provide(configLayer))
    );

    expect(config.name).toBe("commerce-api");
    expect(config.port).toBe(8787);
    expect(config.publicUrl.href).toBe("https://commerce.example.com/");
    expect(Redacted.isRedacted(config.databaseUrl)).toBe(true);
  });

  it("keeps secrets redacted in string and JSON representations", async () => {
    const rawSecret = "postgres://commerce:secret@localhost/commerce";
    const configLayer = ConfigProvider.layer(
      ConfigProvider.fromUnknown({ DATABASE_URL: rawSecret })
    );
    const secret = await Effect.runPromise(
      secretConfig("DATABASE_URL").pipe(Effect.provide(configLayer))
    );

    expect(String(secret)).toBe("<redacted>");
    expect(JSON.stringify(secret)).not.toContain(rawSecret);
    expect(Redacted.value(secret)).toBe(rawSecret);
  });

  it("uses defaults only for missing values", async () => {
    const missingLayer = ConfigProvider.layer(ConfigProvider.fromUnknown({}));
    const invalidLayer = ConfigProvider.layer(
      ConfigProvider.fromUnknown({ PORT: "not-a-port" })
    );
    const defaultPort = await Effect.runPromise(
      portConfigWithDefault("PORT", 3000).pipe(Effect.provide(missingLayer))
    );
    const invalidExit = await Effect.runPromiseExit(
      portConfigWithDefault("PORT", 3000).pipe(Effect.provide(invalidLayer))
    );

    expect(defaultPort).toBe(3000);
    expect(Exit.isFailure(invalidExit)).toBe(true);
  });

  it("rejects invalid values before constructing application Layers", async () => {
    const configLayer = ConfigProvider.layer(
      ConfigProvider.fromUnknown({ PORT: 70_000 })
    );
    const exit = await Effect.runPromiseExit(
      requiredPortConfig("PORT").pipe(Effect.provide(configLayer))
    );

    expect(Exit.isFailure(exit)).toBe(true);
  });
});

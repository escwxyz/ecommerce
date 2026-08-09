import { describe, expect, it } from "bun:test";

import * as Infrastructure from "./alchemy.run";
import Stack, {
  cartCache,
  commerceEventQueue,
  database,
  notificationEventDeadLetterQueue,
  notificationEventOutboxDrainCrons,
  notificationEventQueue,
  notificationEventQueueConsumer,
  notificationEventRealtime,
  postgresConnection,
  server,
  statefulCoordinator,
  web,
} from "./alchemy.run";

const getNotificationEventQueueEnv = (
  Infrastructure as unknown as {
    getNotificationEventQueueEnv?: (dev: boolean) => Record<string, unknown>;
  }
).getNotificationEventQueueEnv;
const getLocalWebOutput = (
  Infrastructure as unknown as {
    getLocalWebOutput?: (dev: boolean) => { url: string } | null;
  }
).getLocalWebOutput;
const getPostgresHyperdriveConfig = (
  Infrastructure as unknown as {
    getPostgresHyperdriveConfig?: (
      dev: boolean,
      source: Record<string, string | undefined>
    ) => {
      readonly dev: { readonly database: string; readonly host: string };
      readonly origin: { readonly database: string; readonly host: string };
      readonly originConnectionLimit?: number;
    };
  }
).getPostgresHyperdriveConfig;

describe("local web development", () => {
  it("uses the standalone Vite server in local development", () => {
    expect(getLocalWebOutput).toBeFunction();
    if (!getLocalWebOutput) {
      return;
    }

    expect(getLocalWebOutput(true)).toEqual({ url: "http://localhost:3001" });
    expect(getLocalWebOutput(false)).toBeNull();
  });

  it("exposes a Turbo dev task for the web app", async () => {
    const webPackage = await Bun.file(
      new URL("../../apps/web/package.json", import.meta.url)
    ).json();

    expect(webPackage.scripts.dev).toBe("vite dev");
  });
});

describe("notification event queue bindings", () => {
  it("configures a cron cadence for deployed outbox drains", () => {
    expect(notificationEventOutboxDrainCrons).toEqual(["* * * * *"]);
  });

  it("omits queue bindings in local development", () => {
    expect(getNotificationEventQueueEnv).toBeFunction();
    if (!getNotificationEventQueueEnv) {
      return;
    }

    expect(getNotificationEventQueueEnv(true)).toEqual({});
  });

  it("includes queue bindings for deployed workers", () => {
    expect(getNotificationEventQueueEnv).toBeFunction();
    if (!getNotificationEventQueueEnv) {
      return;
    }

    expect(getNotificationEventQueueEnv(false)).toEqual({
      COMMERCE_EVENT_QUEUE: commerceEventQueue,
      NOTIFICATION_EVENT_DEAD_LETTER_QUEUE: notificationEventDeadLetterQueue,
      NOTIFICATION_EVENT_QUEUE: notificationEventQueue,
    });
  });
});

describe("Hyperdrive PostgreSQL connection", () => {
  it("uses local PostgreSQL defaults in Alchemy dev mode", () => {
    expect(getPostgresHyperdriveConfig).toBeFunction();
    if (!getPostgresHyperdriveConfig) {
      return;
    }

    const config = getPostgresHyperdriveConfig(true, {});

    expect(config.origin.host).toBe("127.0.0.1");
    expect(config.origin.database).toBe("ecommerce");
    expect(config.dev.host).toBe("127.0.0.1");
    expect(config.dev.database).toBe("ecommerce");
  });

  it("requires an explicit PostgreSQL origin before deployed provisioning", () => {
    expect(getPostgresHyperdriveConfig).toBeFunction();
    if (!getPostgresHyperdriveConfig) {
      return;
    }

    expect(() => getPostgresHyperdriveConfig(false, {})).toThrow(
      /POSTGRES_HOST/
    );
  });

  it("reads the deployed PostgreSQL origin and connection limit from env", () => {
    expect(getPostgresHyperdriveConfig).toBeFunction();
    if (!getPostgresHyperdriveConfig) {
      return;
    }

    const config = getPostgresHyperdriveConfig(false, {
      POSTGRES_DATABASE: "commerce",
      POSTGRES_HOST: "db.example.com",
      POSTGRES_ORIGIN_CONNECTION_LIMIT: "10",
      POSTGRES_PASSWORD: "secret",
      POSTGRES_USER: "commerce",
    });

    expect(config.origin.host).toBe("db.example.com");
    expect(config.origin.database).toBe("commerce");
    expect(config.originConnectionLimit).toBe(10);
  });
});

describe("alchemy stack exports", () => {
  it("defines the stack and deployable resources without executing deploy", () => {
    expect(Stack).toBeDefined();
    expect(cartCache).toBeDefined();
    expect(database).toBeDefined();
    expect(notificationEventDeadLetterQueue).toBeDefined();
    expect(notificationEventQueue).toBeDefined();
    expect(notificationEventQueueConsumer).toBeDefined();
    expect(notificationEventRealtime).toBeDefined();
    expect(postgresConnection).toBeDefined();
    expect(server).toBeDefined();
    expect(statefulCoordinator).toBeDefined();
    expect(web).toBeDefined();
  });
});

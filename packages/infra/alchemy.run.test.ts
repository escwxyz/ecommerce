import { describe, expect, it } from "bun:test";

import * as Infrastructure from "./alchemy.run";
import Stack, {
  cartCache,
  database,
  notificationEventDeadLetterQueue,
  notificationEventQueue,
  notificationEventQueueConsumer,
  notificationEventRealtime,
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
      NOTIFICATION_EVENT_DEAD_LETTER_QUEUE: notificationEventDeadLetterQueue,
      NOTIFICATION_EVENT_QUEUE: notificationEventQueue,
    });
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
    expect(server).toBeDefined();
    expect(statefulCoordinator).toBeDefined();
    expect(web).toBeDefined();
  });
});

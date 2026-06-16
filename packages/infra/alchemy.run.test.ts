import { describe, expect, it } from "bun:test";

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

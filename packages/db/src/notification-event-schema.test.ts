import { describe, expect, it } from "bun:test";

import {
  commerceMigrations,
  type CommerceDatabaseSchemaKey,
  notificationEventSchema,
} from "./index";

describe("notification event schema assembly", () => {
  it("contributes event and notification-owned tables to the shared schema", () => {
    const tables = [
      "event_outbox",
      "event_dead_letter",
      "notification_template",
      "notification_dispatch",
      "notification_provider",
    ] satisfies CommerceDatabaseSchemaKey[];

    expect(notificationEventSchema.notificationEventSchema.outbox).toBe(
      "event_outbox"
    );
    expect(tables).toContain("notification_dispatch");
    expect(commerceMigrations["011_notification_event"]).toBeDefined();
  });
});

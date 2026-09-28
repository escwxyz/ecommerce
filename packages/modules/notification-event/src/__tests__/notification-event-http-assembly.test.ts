import { describe, expect, it } from "bun:test";

import { adminHttpApi } from "@ecommerce/api/effect-http-api";
import { createEffectHttpApiAssembly } from "@ecommerce/api/effect-http-api-assembly";
import { composeCommerceModulePermissions } from "@ecommerce/core";
import { composeAdminMetadata } from "@ecommerce/core/admin";

import { notificationEventAdminMetadata } from "../admin";
import { notificationEventEffectHttpApiContribution } from "../http/api";
import { notificationEventModule } from "../module";

describe("notification event API and admin assembly", () => {
  it("includes notification-event permissions in builtin permission composition", () => {
    const statement = composeCommerceModulePermissions([
      notificationEventModule,
    ]).statement;
    expect(statement.event).toEqual(["read", "write"]);
    expect(statement.notification).toEqual(["read", "write"]);
  });

  it("includes notification-event Effect HTTP operations in canonical admin composition", () => {
    const assembly = createEffectHttpApiAssembly({
      contributions: notificationEventEffectHttpApiContribution.groups,
      root: adminHttpApi,
      surface: "admin",
    });

    expect(assembly.contributions.map((group) => group.key)).toEqual([
      "module:notification-event.admin",
    ]);
    expect(assembly.routes.map((route) => route.routeKey)).toEqual([
      "GET /admin/events/dead-letters",
      "POST /admin/events/outbox/:outboxId/failures",
      "POST /admin/events",
      "POST /admin/notifications/dispatches",
      "GET /admin/notifications/dispatches",
      "POST /admin/notifications/providers",
      "PUT /admin/notifications/templates/:templateKey",
    ]);
    expect(notificationEventEffectHttpApiContribution.moduleName).toBe(
      "notification-event"
    );
    expect(notificationEventModule.contributions?.apiGroups?.[0]?.key).toBe(
      "module:notification-event.admin"
    );
  });

  it("exposes notification-event admin metadata through shared module contracts", () => {
    const metadata = composeAdminMetadata({
      contributions: [notificationEventAdminMetadata],
      permissions: [
        "event:read",
        "event:write",
        "notification:read",
        "notification:write",
      ],
    });

    expect(
      metadata.surfaces.some(
        (surface) => surface.source.key === "notification-event"
      )
    ).toBe(true);
    expect(
      metadata.surfaces.find(
        (surface) => surface.source.key === "notification-event"
      )?.permission?.resource
    ).toBe("event");
  });
});

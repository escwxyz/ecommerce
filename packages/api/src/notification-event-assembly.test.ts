import { describe, expect, it } from "bun:test";

import { createAdminMetadataModel } from "./admin-metadata";
import {
  adminHttpApi,
  createEffectHttpApiAssembly,
  notificationEventEffectHttpApiContribution,
} from "./index";
import {
  authorizationEvaluator,
  builtinPermissionStatement,
} from "./permissions";
import { createBuiltinRouteFragments } from "./routers";

describe("notification event API and admin assembly", () => {
  it("includes notification-event permissions in builtin permission composition", () => {
    expect(builtinPermissionStatement.event).toEqual(["read", "write"]);
    expect(builtinPermissionStatement.notification).toEqual(["read", "write"]);
  });

  it("keeps migrated notification-event operations out of legacy oRPC composition", () => {
    expect(
      createBuiltinRouteFragments().map((routeFragment) => routeFragment.key)
    ).toEqual(["builtin:core"]);
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
  });

  it("exposes notification-event admin metadata through shared module contracts", () => {
    const metadata = createAdminMetadataModel({
      auth: {},
      authorization: authorizationEvaluator,
      session: {
        user: {
          permissions: [
            "event:read",
            "event:write",
            "notification:read",
            "notification:write",
          ],
        },
      },
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

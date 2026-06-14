import { describe, expect, it } from "bun:test";

import { createAdminMetadataModel } from "./admin-metadata";
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

  it("includes notification-event route operations in builtin API composition", () => {
    const fragment = createBuiltinRouteFragments().find(
      (routeFragment) => routeFragment.key === "module:notification-event"
    );

    expect(Object.keys(fragment?.router ?? {})).toContain("eventPublish");
    expect(Object.keys(fragment?.router ?? {})).toContain(
      "notificationDispatch"
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

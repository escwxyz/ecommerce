import { describe, expect, it } from "bun:test";

import { defineNativePluginApiGroupContribution } from "@ecommerce/core";
import { Layer, Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { adminHttpApi } from "../effect-http-api";
import { createEffectHttpApiAssembly } from "../effect-http-api-assembly";

describe("native plugin Effect HTTP contribution", () => {
  it("composes through the canonical API assembly contract", () => {
    const contribution = defineNativePluginApiGroupContribution({
      group: HttpApiGroup.make("pluginAnalytics").add(
        HttpApiEndpoint.get("pluginAnalyticsRead", "/admin/plugin-analytics", {
          success: Schema.String,
        })
      ),
      handlers: Layer.empty,
      key: "plugin:analytics",
      surface: "admin",
    });

    const assembly = createEffectHttpApiAssembly({
      contributions: [contribution],
      root: adminHttpApi,
      surface: "admin",
    });

    expect(assembly.contributions[0]?.owner).toBe("plugin");
    expect(assembly.routes).toEqual([
      {
        contributionKey: "plugin:analytics",
        endpointName: "pluginAnalyticsRead",
        groupIdentifier: "pluginAnalytics",
        method: "GET",
        owner: "plugin",
        path: "/admin/plugin-analytics",
        routeKey: "GET /admin/plugin-analytics",
        surface: "admin",
      },
    ]);
  });
});

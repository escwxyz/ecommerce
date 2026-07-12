import { describe, expect, it } from "bun:test";

import { Layer, Schema } from "effect";
import {
  HttpApiEndpoint,
  HttpApiGroup,
  OpenApi,
} from "effect/unstable/httpapi";

import {
  adminHttpApi,
  defineAdminHttpApiGroupContribution,
  defineEffectHttpApiModuleContribution,
  defineStorefrontHttpApiGroupContribution,
  storefrontHttpApi,
} from "../effect-http-api";

const HealthResponse = Schema.Struct({
  status: Schema.Literal("ok"),
});

describe("Effect HttpApi roots", () => {
  it("defines separate canonical admin and storefront roots", () => {
    const adminDocument = OpenApi.fromApi(adminHttpApi);
    const storefrontDocument = OpenApi.fromApi(storefrontHttpApi);

    expect(adminDocument.info.title).toBe("Commerce Admin API");
    expect(storefrontDocument.info.title).toBe("Commerce Storefront API");
    expect(adminHttpApi).not.toBe(storefrontHttpApi);
  });

  it("defines module group contributions with handler Layers", () => {
    const adminGroup = HttpApiGroup.make("storeAdmin").add(
      HttpApiEndpoint.get("health", "/admin/store/health", {
        success: HealthResponse,
      })
    );
    const storefrontGroup = HttpApiGroup.make("storefrontStore").add(
      HttpApiEndpoint.get("health", "/store/health", {
        success: HealthResponse,
      })
    );
    const handlers = Layer.empty;

    const contribution = defineEffectHttpApiModuleContribution({
      groups: [
        defineAdminHttpApiGroupContribution({
          group: adminGroup,
          handlers,
          key: "store.admin",
          owner: "module",
        }),
        defineStorefrontHttpApiGroupContribution({
          group: storefrontGroup,
          handlers,
          key: "store.storefront",
          owner: "module",
        }),
      ],
      moduleName: "store",
    });

    expect(contribution.moduleName).toBe("store");
    expect(contribution.groups.map((group) => group.surface)).toEqual([
      "admin",
      "storefront",
    ]);
    expect(contribution.groups.map((group) => group.group.identifier)).toEqual([
      "storeAdmin",
      "storefrontStore",
    ]);
    expect(contribution.groups[0]?.handlers).toBe(handlers);
    expect(contribution.groups[1]?.handlers).toBe(handlers);
  });
});

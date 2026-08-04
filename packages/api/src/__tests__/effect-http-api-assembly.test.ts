import { describe, expect, it } from "bun:test";

import { Layer, Schema } from "effect";
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
  OpenApi,
} from "effect/unstable/httpapi";

import {
  adminHttpApi,
  defineAdminHttpApiGroupContribution,
  defineStorefrontHttpApiGroupContribution,
  storefrontHttpApi,
} from "../effect-http-api";
import {
  createEffectHttpApiAssembly,
  EffectHttpApiAssemblyError,
} from "../effect-http-api-assembly";

const HealthResponse = Schema.Struct({
  status: Schema.Literal("ok"),
});

const createGroup = ({
  identifier,
  method,
  path,
}: {
  readonly identifier: string;
  readonly method?: "get" | "post";
  readonly path: `/${string}`;
}): HttpApiGroup.AnyWithProps => {
  const endpoint =
    method === "post"
      ? HttpApiEndpoint.post(`${identifier}Post`, path, {
          success: HealthResponse,
        })
      : HttpApiEndpoint.get(`${identifier}Get`, path, {
          success: HealthResponse,
        });

  return HttpApiGroup.make(identifier).add(endpoint);
};

describe("Effect HttpApi assembly", () => {
  it("assembles only the selected surface in deterministic contribution order", () => {
    const adminFirst = defineAdminHttpApiGroupContribution({
      group: createGroup({
        identifier: "adminFirst",
        path: "/admin/first",
      }),
      handlers: Layer.empty,
      key: "module:z-first",
      owner: "module",
    });
    const adminSecond = defineAdminHttpApiGroupContribution({
      group: createGroup({
        identifier: "adminSecond",
        path: "/admin/second",
      }),
      handlers: Layer.empty,
      key: "module:a-second",
      owner: "module",
    });
    const storefront = defineStorefrontHttpApiGroupContribution({
      group: createGroup({
        identifier: "storefrontOnly",
        path: "/storefront/only",
      }),
      handlers: Layer.empty,
      key: "module:storefront",
      owner: "module",
    });

    const assembly = createEffectHttpApiAssembly({
      contributions: [adminFirst, storefront, adminSecond],
      root: adminHttpApi,
      surface: "admin",
    });

    expect(
      assembly.contributions.map((contribution) => contribution.key)
    ).toEqual(["module:a-second", "module:z-first"]);
    expect(assembly.groups.map((group) => group.identifier)).toEqual([
      "adminSecond",
      "adminFirst",
    ]);
    expect(assembly.routes.map((route) => route.routeKey)).toEqual([
      "GET /admin/second",
      "GET /admin/first",
    ]);

    const document = OpenApi.fromApi(assembly.api as typeof adminHttpApi);
    expect(document.paths["/admin/first"]?.get).toBeDefined();
    expect(document.paths["/admin/second"]?.get).toBeDefined();
    expect(document.paths["/storefront/only"]?.get).toBeUndefined();
  });

  it("keeps admin and storefront route conflicts isolated by surface", () => {
    const path = "/shared/health";
    const admin = defineAdminHttpApiGroupContribution({
      group: createGroup({
        identifier: "adminShared",
        path,
      }),
      handlers: Layer.empty,
      key: "module:admin",
      owner: "module",
    });
    const storefront = defineStorefrontHttpApiGroupContribution({
      group: createGroup({
        identifier: "storefrontShared",
        path,
      }),
      handlers: Layer.empty,
      key: "module:storefront",
      owner: "module",
    });

    const adminAssembly = createEffectHttpApiAssembly({
      contributions: [storefront, admin],
      root: adminHttpApi,
      surface: "admin",
    });
    const storefrontAssembly = createEffectHttpApiAssembly({
      contributions: [storefront, admin],
      root: storefrontHttpApi,
      surface: "storefront",
    });

    expect(adminAssembly.routes).toHaveLength(1);
    expect(storefrontAssembly.routes).toHaveLength(1);
    expect(adminAssembly.routes[0]?.surface).toBe("admin");
    expect(storefrontAssembly.routes[0]?.surface).toBe("storefront");
  });

  it("rejects duplicate method and path definitions before deployment", () => {
    const first = defineAdminHttpApiGroupContribution({
      group: createGroup({
        identifier: "storeHealth",
        path: "/admin/store/health",
      }),
      handlers: Layer.empty,
      key: "module:store",
      owner: "module",
    });
    const duplicate = defineAdminHttpApiGroupContribution({
      group: createGroup({
        identifier: "pluginHealth",
        path: "/admin/store/health",
      }),
      handlers: Layer.empty,
      key: "plugin:health",
      owner: "plugin",
    });

    expect(() =>
      createEffectHttpApiAssembly({
        contributions: [duplicate, first],
        root: adminHttpApi,
        surface: "admin",
      })
    ).toThrow(EffectHttpApiAssemblyError);

    try {
      createEffectHttpApiAssembly({
        contributions: [duplicate, first],
        root: adminHttpApi,
        surface: "admin",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(EffectHttpApiAssemblyError);
      const detail = (error as EffectHttpApiAssemblyError).detail;
      expect(detail._tag).toBe("DuplicateEffectHttpApiRoute");
      if (detail._tag === "DuplicateEffectHttpApiRoute") {
        expect(detail.routeKey).toBe("GET /admin/store/health");
        expect(detail.existing.contributionKey).toBe("module:store");
        expect(detail.conflict.contributionKey).toBe("plugin:health");
      }
    }
  });

  it("allows the same path with different HTTP methods", () => {
    const read = defineAdminHttpApiGroupContribution({
      group: createGroup({
        identifier: "storeRead",
        path: "/admin/store",
      }),
      handlers: Layer.empty,
      key: "module:store-read",
      owner: "module",
    });
    const write = defineAdminHttpApiGroupContribution({
      group: createGroup({
        identifier: "storeWrite",
        method: "post",
        path: "/admin/store",
      }),
      handlers: Layer.empty,
      key: "module:store-write",
      owner: "module",
    });

    const assembly = createEffectHttpApiAssembly({
      contributions: [write, read],
      root: HttpApi.make("MethodSpecificApi"),
      surface: "admin",
    });

    expect(assembly.routes.map((route) => route.routeKey).sort()).toEqual([
      "GET /admin/store",
      "POST /admin/store",
    ]);
  });

  it("rejects duplicate group identifiers because Effect HttpApi would overwrite them", () => {
    const first = defineAdminHttpApiGroupContribution({
      group: createGroup({
        identifier: "duplicateGroup",
        path: "/admin/first",
      }),
      handlers: Layer.empty,
      key: "module:first",
      owner: "module",
    });
    const second = defineAdminHttpApiGroupContribution({
      group: createGroup({
        identifier: "duplicateGroup",
        path: "/admin/second",
      }),
      handlers: Layer.empty,
      key: "module:second",
      owner: "module",
    });

    expect(() =>
      createEffectHttpApiAssembly({
        contributions: [second, first],
        root: adminHttpApi,
        surface: "admin",
      })
    ).toThrow(/Duplicate admin HttpApi group "duplicateGroup"/);
  });
});

import { describe, expect, it } from "bun:test";

import { Layer, Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import {
  adminHttpApi,
  defineAdminHttpApiGroupContribution,
  defineStorefrontHttpApiGroupContribution,
  storefrontHttpApi,
} from "../effect-http-api";
import { createEffectHttpApiOpenApiSnapshot } from "../effect-http-openapi";

const HealthResponse = Schema.Struct({
  status: Schema.Literal("ok"),
});

const createGroup = ({
  identifier,
  path,
}: {
  readonly identifier: string;
  readonly path: `/${string}`;
}): HttpApiGroup.AnyWithProps =>
  HttpApiGroup.make(identifier).add(
    HttpApiEndpoint.get("health", path, {
      success: HealthResponse,
    })
  );

describe("Effect HttpApi OpenAPI generation", () => {
  it("generates deterministic snapshots from the canonical admin and storefront APIs", () => {
    const snapshot = createEffectHttpApiOpenApiSnapshot({
      adminRoot: adminHttpApi,
      contributions: [
        defineStorefrontHttpApiGroupContribution({
          group: createGroup({
            identifier: "storefrontHealth",
            path: "/store/health",
          }),
          handlers: Layer.empty,
          key: "module:storefront-health",
          owner: "module",
        }),
        defineAdminHttpApiGroupContribution({
          group: createGroup({
            identifier: "adminHealth",
            path: "/admin/health",
          }),
          handlers: Layer.empty,
          key: "module:admin-health",
          owner: "module",
        }),
      ],
      storefrontRoot: storefrontHttpApi,
    });

    expect(snapshot.admin.document.info.title).toBe("Commerce Admin API");
    expect(snapshot.storefront.document.info.title).toBe(
      "Commerce Storefront API"
    );
    expect(snapshot.admin.document.paths["/admin/health"]?.get).toBeDefined();
    expect(snapshot.admin.document.paths["/store/health"]?.get).toBeUndefined();
    expect(
      snapshot.storefront.document.paths["/store/health"]?.get
    ).toBeDefined();
    expect(
      snapshot.storefront.document.paths["/admin/health"]?.get
    ).toBeUndefined();

    expect(JSON.parse(snapshot.admin.json)).toEqual(snapshot.admin.document);
    expect(JSON.parse(snapshot.storefront.json)).toEqual(
      snapshot.storefront.document
    );
    expect(snapshot.admin.json).toMatchSnapshot();
    expect(snapshot.storefront.json).toMatchSnapshot();
  });
});

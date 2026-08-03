import { describe, expect, it } from "bun:test";

import { Schema } from "effect";
import {
  HttpApi,
  HttpApiClient,
  HttpApiEndpoint,
  HttpApiGroup,
  OpenApi,
} from "effect/unstable/httpapi";

const HealthResponse = Schema.Struct({
  status: Schema.Literal("ok"),
});

const HealthApi = HttpApi.make("CommerceApi")
  .annotate(OpenApi.Title, "CommerceApi")
  .add(
    HttpApiGroup.make("system").add(
      HttpApiEndpoint.get("health", "/health", {
        success: HealthResponse,
      })
    )
  );

describe("Effect 4 HttpApi canary", () => {
  it("derives OpenAPI from the canonical API contract", () => {
    const document = OpenApi.fromApi(HealthApi);

    expect(document.openapi).toBe("3.1.0");
    expect(document.info.title).toBe("CommerceApi");
    expect(document.paths["/health"]?.get?.operationId).toBe("system.health");
    expect(
      document.paths["/health"]?.get?.responses[200]?.content?.[
        "application/json"
      ]?.schema
    ).toBeDefined();
  });

  it("derives typed client URLs from the same contract", () => {
    const buildUrl = HttpApiClient.urlBuilder(HealthApi, {
      baseUrl: "https://commerce.example",
    });

    expect(buildUrl.system.health()).toBe("https://commerce.example/health");
  });
});

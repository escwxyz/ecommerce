import { describe } from "bun:test";

import { createStorefrontServiceBindingClientForApi } from "../cloudflare";
import { createStorefrontHttpClientForApi } from "../http";
import { runStorefrontTransportConformanceSuite } from "./transport-conformance-suite";

describe("storefront SDK transport conformance", () => {
  runStorefrontTransportConformanceSuite([
    {
      createClient: ({ api, baseUrl, fetch }) =>
        createStorefrontHttpClientForApi({
          api,
          baseUrl,
          fetch,
        }),
      expectedOrigin: "https://store.example",
      name: "public HTTP",
    },
    {
      createClient: ({ api, binding }) =>
        createStorefrontServiceBindingClientForApi({
          api,
          binding,
        }),
      expectedOrigin: "https://storefront.service-binding",
      name: "Cloudflare Service Binding",
    },
  ]);
});

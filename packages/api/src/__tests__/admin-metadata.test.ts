import { describe, expect, it } from "bun:test";

import { createAdminMetadataModel } from "../admin-metadata";

describe("selected admin metadata", () => {
  it("includes only registered surfaces allowed by request permissions", () => {
    const model = createAdminMetadataModel(
      { session: { user: { permissions: ["catalog:read"] } } },
      {
        contributions: [
          {
            source: { key: "catalog", label: "Catalog", type: "module" },
            surfaces: [
              {
                key: "browse",
                kind: "navigation",
                label: "Browse",
                permission: "catalog:read",
              },
              {
                key: "edit",
                kind: "navigation",
                label: "Edit",
                permission: "catalog:write",
              },
            ],
          },
        ],
      }
    );

    expect(model.surfaces.map(({ id }) => id)).toEqual([
      "module:catalog:browse",
    ]);
  });
});

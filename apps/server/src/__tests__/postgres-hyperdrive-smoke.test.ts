import { describe, expect, it } from "bun:test";

import {
  isPostgresHyperdriveHealthRequest,
  postgresHyperdriveHealthPath,
  verifyPostgresHyperdriveConnection,
} from "../postgres-hyperdrive-smoke";
import type { PostgresSmokeClient } from "../postgres-hyperdrive-smoke";

const createSuccessfulClient = (): PostgresSmokeClient => ({
  connect: async () => {},
  end: async () => {},
  query: async () => ({ rows: [{ ok: 1 }] }),
});

const createFailingClient = (): PostgresSmokeClient => ({
  connect: async () => {
    throw new Error("database password leaked");
  },
  end: async () => {},
  query: async () => ({ rows: [] }),
});

describe("Hyperdrive PostgreSQL smoke endpoint", () => {
  it("matches only the dedicated health check path", () => {
    expect(
      isPostgresHyperdriveHealthRequest(
        new Request(`https://commerce.example${postgresHyperdriveHealthPath}`)
      )
    ).toBe(true);
    expect(
      isPostgresHyperdriveHealthRequest(
        new Request("https://commerce.example/rpc/healthCheck")
      )
    ).toBe(false);
  });

  it("returns an ok response after a successful PostgreSQL query", async () => {
    const response = await verifyPostgresHyperdriveConnection(
      { connectionString: "postgres://user:password@example.com/ecommerce" },
      { createClient: createSuccessfulClient }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      database: "postgres",
      status: "ok",
      transport: "cloudflare-hyperdrive",
    });
  });

  it("returns a sanitized service error when the query fails", async () => {
    const response = await verifyPostgresHyperdriveConnection(
      { connectionString: "postgres://user:password@example.com/ecommerce" },
      { createClient: createFailingClient }
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      database: "postgres",
      status: "error",
      transport: "cloudflare-hyperdrive",
    });
  });
});

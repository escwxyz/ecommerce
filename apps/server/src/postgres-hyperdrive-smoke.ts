import { Client } from "pg";

export const postgresHyperdriveHealthPath = "/__health/postgres";

export interface HyperdrivePostgresBinding {
  readonly connectionString: string;
}

export interface PostgresSmokeClient {
  readonly connect: () => Promise<void>;
  readonly end: () => Promise<void>;
  readonly query: <T extends Record<string, unknown>>(
    sql: string
  ) => Promise<{ readonly rows: readonly T[] }>;
}

export interface PostgresHyperdriveSmokeOptions {
  readonly createClient?: (connectionString: string) => PostgresSmokeClient;
}

const createPgClient = (connectionString: string): PostgresSmokeClient => {
  const client = new Client({ connectionString });

  return {
    connect: async () => {
      await client.connect();
    },
    end: () => client.end(),
    query: (sql) => client.query(sql),
  };
};

export const isPostgresHyperdriveHealthRequest = (request: Request) =>
  new URL(request.url).pathname === postgresHyperdriveHealthPath;

/** Verifies that the Cloudflare Hyperdrive binding can open a PostgreSQL session. */
export const verifyPostgresHyperdriveConnection = async (
  hyperdrive: HyperdrivePostgresBinding,
  options: PostgresHyperdriveSmokeOptions = {}
): Promise<Response> => {
  const client = (options.createClient ?? createPgClient)(
    hyperdrive.connectionString
  );

  try {
    await client.connect();
    const result = await client.query<{ ok: number }>("select 1::int as ok");
    const ok = result.rows[0]?.ok === 1;

    return Response.json(
      {
        database: "postgres",
        status: ok ? "ok" : "error",
        transport: "cloudflare-hyperdrive",
      },
      { status: ok ? 200 : 503 }
    );
  } catch {
    return Response.json(
      {
        database: "postgres",
        status: "error",
        transport: "cloudflare-hyperdrive",
      },
      { status: 503 }
    );
  } finally {
    await client.end();
  }
};

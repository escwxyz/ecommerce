import { describe, expect, it } from "bun:test";

import type { AuthService } from "@ecommerce/auth";
import type { Context as HonoContext } from "hono";

import { createContext } from "./context";

const auth = {
  api: {
    getSession: async ({ headers }: { headers: Headers }) => ({
      headers,
      user: {
        email: "ada@example.com",
        id: "user_1",
        name: "Ada Lovelace",
      },
    }),
  },
  handler: () => new Response("unused"),
} as unknown as AuthService;

const createRequestContext = () =>
  ({
    req: {
      raw: new Request("http://localhost/rpc"),
    },
  }) as HonoContext;

describe("createContext", () => {
  it("uses the injected auth instance to resolve session state", async () => {
    const context = await createContext({
      auth,
      context: createRequestContext(),
    });

    expect(context.auth).toBe(auth);
    expect(context.session?.user).toMatchObject({
      email: "ada@example.com",
    });
  });
});

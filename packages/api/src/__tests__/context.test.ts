import { describe, expect, it } from "bun:test";

import type { AuthService } from "@ecommerce/auth";

import { createContext } from "../context";

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

describe("createContext", () => {
  it("uses the injected auth instance and Request headers to resolve session state", async () => {
    const context = await createContext({
      auth,
      request: new Request("http://localhost/rpc", {
        headers: {
          cookie: "better-auth.session=token",
        },
      }),
      visitorId: "visitor_test_1",
    });

    expect(context.auth).toBe(auth);
    expect(context.session?.user).toMatchObject({
      email: "ada@example.com",
    });
    expect(context.visitorId).toBe("visitor_test_1");
  });
});

import type { AuthService } from "@ecommerce/auth";
import type { Context as HonoContext } from "hono";

import { authorizationEvaluator } from "./permissions";

export { authorizationEvaluator };

export interface CreateContextOptions {
  auth: AuthService;
  context: HonoContext;
}

export async function createContext({ auth, context }: CreateContextOptions) {
  const session = await auth.api.getSession({
    headers: context.req.raw.headers,
  });
  return {
    auth,
    authorization: authorizationEvaluator,
    session,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

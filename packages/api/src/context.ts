import type { AuthService } from "@ecommerce/auth";
import type { Context as HonoContext } from "hono";

import { authorizationEvaluator } from "./permissions";

export { authorizationEvaluator };

export interface CreateContextOptions {
  auth: AuthService;
  context: HonoContext;
}

export interface Context {
  readonly auth: unknown;
  readonly authorization: typeof authorizationEvaluator;
  readonly session: {
    readonly user?: unknown | null;
  } | null;
}

export async function createContext({
  auth,
  context,
}: CreateContextOptions): Promise<Context> {
  const session = await auth.api.getSession({
    headers: context.req.raw.headers,
  });

  return {
    auth,
    authorization: authorizationEvaluator,
    session,
  };
}

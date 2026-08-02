import type { AuthService } from "@ecommerce/auth";

import { authorizationEvaluator } from "./permissions";

export { authorizationEvaluator };

export interface CreateContextOptions {
  readonly auth: AuthService;
  readonly request: Request;
  readonly visitorId?: string;
}

export interface Context {
  readonly auth: unknown;
  readonly authorization: typeof authorizationEvaluator;
  readonly session: {
    readonly user?: unknown | null;
  } | null;
  readonly visitorId?: string;
}

/**
 * Temporary oRPC context bridge retained only until task 12.2 deletes the
 * legacy router stack. It accepts a platform `Request` directly so Hono types
 * and middleware stay out of the backend after task 12.1.
 */
export async function createContext({
  auth,
  request,
  visitorId,
}: CreateContextOptions): Promise<Context> {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  return {
    auth,
    authorization: authorizationEvaluator,
    session,
    visitorId,
  };
}

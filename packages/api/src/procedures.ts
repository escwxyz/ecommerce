import type { Route, Schema } from "@orpc/server";
import { ORPCError, os } from "@orpc/server";

import type { Context } from "./context";

export const o = os.$context<Context>();

export const publicProcedure = o;

const requireAuth = o.middleware(({ context, next }) => {
  if (!context.session?.user) {
    throw new ORPCError("UNAUTHORIZED");
  }
  return next({
    context: {
      auth: context.auth,
      session: context.session,
    },
  });
});

export const protectedProcedure = publicProcedure.use(requireAuth);

export interface DefineApiProcedureOptions<
  TInputSchema extends Schema<unknown, unknown>,
  TOutputSchema extends Schema<unknown, unknown>,
> {
  readonly input: TInputSchema;
  readonly output: TOutputSchema;
  readonly route?: Route;
}

/**
 * Creates the validated public procedure builder used by built-in API routes.
 *
 * Route contributors outside `packages/api` may use oRPC contracts directly,
 * but assembled procedures must still expose explicit input and output schemas.
 */
export const definePublicApiProcedure = <
  const TInputSchema extends Schema<unknown, unknown>,
  const TOutputSchema extends Schema<unknown, unknown>,
>({
  input,
  output,
  route,
}: DefineApiProcedureOptions<TInputSchema, TOutputSchema>) => {
  const procedure = route ? publicProcedure.route(route) : publicProcedure;

  return procedure.input(input).output(output);
};

/**
 * Creates the validated protected procedure builder used by built-in API routes.
 */
export const defineProtectedApiProcedure = <
  const TInputSchema extends Schema<unknown, unknown>,
  const TOutputSchema extends Schema<unknown, unknown>,
>({
  input,
  output,
  route,
}: DefineApiProcedureOptions<TInputSchema, TOutputSchema>) => {
  const procedure = route
    ? protectedProcedure.route(route)
    : protectedProcedure;

  return procedure.input(input).output(output);
};

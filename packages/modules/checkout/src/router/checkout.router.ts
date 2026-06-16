import type { CommerceModuleApiFragment } from "@ecommerce/core";
import type { CommercePermissionDescriptor } from "@ecommerce/core/permissions";
import { implement, ORPCError } from "@orpc/server";

import { checkoutContractRouter } from "../contracts";
import type { CompleteCheckoutInput } from "../domain";
import { checkoutPermissions } from "../permissions";
import { createCheckoutService } from "../services";
import type { CreateCheckoutServiceOptions } from "../services";

export interface CheckoutModuleContext {
  readonly auth: unknown;
  readonly authorization: {
    evaluatePermission(input: {
      readonly permission: CommercePermissionDescriptor;
      readonly session: CheckoutModuleContext["session"];
    }): CheckoutAuthorizationDecision;
  };
  readonly session: {
    readonly user?: unknown | null;
  } | null;
}

type CheckoutAuthorizationDecision =
  | {
      readonly allowed: true;
    }
  | {
      readonly allowed: false;
      readonly reason:
        | "missing-authenticated-actor"
        | "missing-permission"
        | "unsupported-permission";
    };

const assertAuthenticatedPermission = (
  session: CheckoutModuleContext["session"],
  permission: CommercePermissionDescriptor,
  authorization: CheckoutModuleContext["authorization"]
): void => {
  if (!session?.user) {
    throw new ORPCError("UNAUTHORIZED");
  }

  const decision = authorization.evaluatePermission({ permission, session });

  if (decision.allowed) {
    return;
  }

  if (decision.reason === "missing-authenticated-actor") {
    throw new ORPCError("UNAUTHORIZED");
  }

  throw new ORPCError("FORBIDDEN");
};

export interface CreateCheckoutRouteFragmentOptions extends Partial<CreateCheckoutServiceOptions> {
  readonly createServiceOptionsForContext?: (
    context: CheckoutModuleContext
  ) => CreateCheckoutServiceOptions;
  readonly key?: string;
}

export const createCheckoutRouteFragment = ({
  createServiceOptionsForContext,
  key = "module:checkout",
  ...options
}: CreateCheckoutRouteFragmentOptions = {}) => {
  const baseImplementation = implement(
    checkoutContractRouter
  ).$context<CheckoutModuleContext>();
  const getService = (context: CheckoutModuleContext) => {
    if (!createServiceOptionsForContext) {
      throw new Error(
        "Checkout route requires request-scoped service options."
      );
    }

    return createCheckoutService({
      ...options,
      ...createServiceOptionsForContext(context),
    });
  };
  const router = baseImplementation.router({
    checkoutComplete: baseImplementation.checkoutComplete.handler(
      ({
        context,
        input,
      }: {
        readonly context: CheckoutModuleContext;
        readonly input: CompleteCheckoutInput;
      }) => {
        assertAuthenticatedPermission(
          context.session,
          checkoutPermissions.execute,
          context.authorization
        );

        return getService(context).completeCheckout(input);
      }
    ),
  });

  return {
    key,
    router,
  } as const satisfies CommerceModuleApiFragment<typeof router>;
};

export const checkoutApiFragment = createCheckoutRouteFragment();
export const checkoutRouter = checkoutApiFragment.router;

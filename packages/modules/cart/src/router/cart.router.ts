import type { CommerceModuleApiFragment } from "@ecommerce/core";
import type { CommercePermissionDescriptor } from "@ecommerce/core/permissions";
import { implement, ORPCError } from "@orpc/server";

import { cartContractRouter } from "../contracts";
import type {
  AddCartLineItemInput,
  ApplyCartAdjustmentInput,
  AssociateCartCustomerInput,
  CartAdjustmentApiRecord,
  CartAdjustmentRecord,
  CartAggregate,
  CartAggregateApiRecord,
  CartApiRecord,
  CartIdentifierInput,
  CartLineItemApiRecord,
  CartLineItemRecord,
  CartRecord,
  CreateCartInput,
  SetCartAddressesInput,
  SetCartCheckoutReferencesInput,
  SetCartRegionChannelInput,
  UpdateCartLineItemInput,
  UpdateCartTotalsInput,
} from "../domain";
import { createCartId } from "../domain";
import { cartPermissions } from "../permissions";
import { createCartService, defaultCartService } from "../services";
import type { CreateCartServiceOptions } from "../services";

export interface CartModuleContext {
  readonly auth: unknown;
  readonly authorization: {
    evaluatePermission(input: {
      readonly permission: CommercePermissionDescriptor;
      readonly session: CartModuleContext["session"];
    }): CartAuthorizationDecision;
  };
  readonly session: {
    readonly user?: unknown | null;
  } | null;
}

type CartAuthorizationDecision =
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

const assertPermission = (
  session: CartModuleContext["session"],
  permission: CommercePermissionDescriptor,
  authorization: CartModuleContext["authorization"]
): void => {
  const decision = authorization.evaluatePermission({ permission, session });

  if (decision.allowed) {
    return;
  }

  if (decision.reason === "missing-authenticated-actor") {
    throw new ORPCError("UNAUTHORIZED");
  }

  throw new ORPCError("FORBIDDEN");
};

const serializeCart = (cart: CartRecord): CartApiRecord => ({
  ...cart,
  completedAt: cart.completedAt?.toISOString() ?? null,
  createdAt: cart.createdAt.toISOString(),
  updatedAt: cart.updatedAt.toISOString(),
});

const serializeLineItem = (
  item: CartLineItemRecord
): CartLineItemApiRecord => ({
  ...item,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
});

const serializeAdjustment = (
  adjustment: CartAdjustmentRecord
): CartAdjustmentApiRecord => ({
  ...adjustment,
  createdAt: adjustment.createdAt.toISOString(),
  updatedAt: adjustment.updatedAt.toISOString(),
});

const serializeAggregate = (
  aggregate: CartAggregate
): CartAggregateApiRecord => ({
  adjustments: aggregate.adjustments.map(serializeAdjustment),
  cart: serializeCart(aggregate.cart),
  lineItems: aggregate.lineItems.map(serializeLineItem),
});

export interface CreateCartRouteFragmentOptions extends CreateCartServiceOptions {
  readonly createServiceOptionsForContext?: (
    context: CartModuleContext
  ) => CreateCartServiceOptions;
  readonly key?: string;
}

export const createCartRouteFragment = ({
  createServiceOptionsForContext,
  key = "module:cart",
  ...options
}: CreateCartRouteFragmentOptions = {}) => {
  const service =
    options.repository ||
    options.clock ||
    options.idGenerator ||
    options.coordinator ||
    options.eventPublisher
      ? createCartService(options)
      : defaultCartService;
  const getService = (context: CartModuleContext) =>
    createServiceOptionsForContext
      ? createCartService({
          ...options,
          ...createServiceOptionsForContext(context),
        })
      : service;

  const baseImplementation =
    implement(cartContractRouter).$context<CartModuleContext>();

  const protectedImplementation = baseImplementation.use(
    ({ context, next }) => {
      if (!context.session?.user) {
        throw new ORPCError("UNAUTHORIZED");
      }

      return next({
        context: {
          auth: context.auth,
          session: context.session,
        },
      });
    }
  );

  const router = protectedImplementation.router({
    cartAddLineItem: protectedImplementation.cartAddLineItem.handler(
      async ({
        context,
        input,
      }: {
        readonly context: CartModuleContext;
        readonly input: AddCartLineItemInput;
      }) => {
        assertPermission(
          context.session,
          cartPermissions.write,
          context.authorization
        );

        return serializeAggregate(await getService(context).addLineItem(input));
      }
    ),
    cartAdjustmentApply: protectedImplementation.cartAdjustmentApply.handler(
      async ({
        context,
        input,
      }: {
        readonly context: CartModuleContext;
        readonly input: ApplyCartAdjustmentInput;
      }) => {
        assertPermission(
          context.session,
          cartPermissions.write,
          context.authorization
        );

        return serializeAggregate(
          await getService(context).applyAdjustment(input)
        );
      }
    ),
    cartAssociateCustomer:
      protectedImplementation.cartAssociateCustomer.handler(
        async ({
          context,
          input,
        }: {
          readonly context: CartModuleContext;
          readonly input: AssociateCartCustomerInput;
        }) => {
          assertPermission(
            context.session,
            cartPermissions.write,
            context.authorization
          );

          return serializeAggregate(
            await getService(context).associateCustomer(input)
          );
        }
      ),
    cartCreate: protectedImplementation.cartCreate.handler(
      async ({
        context,
        input,
      }: {
        readonly context: CartModuleContext;
        readonly input: CreateCartInput;
      }) => {
        assertPermission(
          context.session,
          cartPermissions.write,
          context.authorization
        );

        return serializeCart(await getService(context).createCart(input));
      }
    ),
    cartGet: protectedImplementation.cartGet.handler(
      async ({
        context,
        input,
      }: {
        readonly context: CartModuleContext;
        readonly input: CartIdentifierInput;
      }) => {
        assertPermission(
          context.session,
          cartPermissions.read,
          context.authorization
        );

        const cart = await getService(context).getCart(createCartId(input.id));

        return cart ? serializeAggregate(cart) : null;
      }
    ),
    cartLineItemUpdate: protectedImplementation.cartLineItemUpdate.handler(
      async ({
        context,
        input,
      }: {
        readonly context: CartModuleContext;
        readonly input: UpdateCartLineItemInput;
      }) => {
        assertPermission(
          context.session,
          cartPermissions.write,
          context.authorization
        );

        return serializeAggregate(
          await getService(context).updateLineItem(input)
        );
      }
    ),
    cartSetAddresses: protectedImplementation.cartSetAddresses.handler(
      async ({
        context,
        input,
      }: {
        readonly context: CartModuleContext;
        readonly input: SetCartAddressesInput;
      }) => {
        assertPermission(
          context.session,
          cartPermissions.write,
          context.authorization
        );

        return serializeAggregate(
          await getService(context).setAddresses(input)
        );
      }
    ),
    cartSetCheckoutReferences:
      protectedImplementation.cartSetCheckoutReferences.handler(
        async ({
          context,
          input,
        }: {
          readonly context: CartModuleContext;
          readonly input: SetCartCheckoutReferencesInput;
        }) => {
          assertPermission(
            context.session,
            cartPermissions.write,
            context.authorization
          );

          return serializeAggregate(
            await getService(context).setCheckoutReferences(input)
          );
        }
      ),
    cartSetRegionChannel: protectedImplementation.cartSetRegionChannel.handler(
      async ({
        context,
        input,
      }: {
        readonly context: CartModuleContext;
        readonly input: SetCartRegionChannelInput;
      }) => {
        assertPermission(
          context.session,
          cartPermissions.write,
          context.authorization
        );

        return serializeAggregate(
          await getService(context).setRegionChannel(input)
        );
      }
    ),
    cartTotalsUpdate: protectedImplementation.cartTotalsUpdate.handler(
      async ({
        context,
        input,
      }: {
        readonly context: CartModuleContext;
        readonly input: UpdateCartTotalsInput;
      }) => {
        assertPermission(
          context.session,
          cartPermissions.write,
          context.authorization
        );

        return serializeAggregate(
          await getService(context).updateTotals(input)
        );
      }
    ),
  });

  return {
    key,
    router,
  } as const satisfies CommerceModuleApiFragment<typeof router>;
};

export const cartApiFragment = createCartRouteFragment();
export const cartRouter = cartApiFragment.router;

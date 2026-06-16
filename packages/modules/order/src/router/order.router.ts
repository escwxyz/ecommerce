import type { CommerceModuleApiFragment } from "@ecommerce/core";
import type { CommercePermissionDescriptor } from "@ecommerce/core/permissions";
import { implement, ORPCError } from "@orpc/server";

import { orderContractRouter } from "../contracts";
import type {
  CreateOrderFromCheckoutInput,
  OrderAggregate,
  OrderAggregateApiRecord,
  OrderApiRecord,
  OrderLineItemApiRecord,
  OrderLineItemRecord,
  OrderPostPurchaseOperationRecord,
  OrderRecord,
  OrderStateTransitionRecord,
  OrderTransactionApiRecord,
  OrderTransactionRecord,
  RecordOrderTransactionInput,
  TransitionOrderStatusInput,
} from "../domain";
import { createOrderId } from "../domain";
import { orderPermissions } from "../permissions";
import { createOrderService, defaultOrderService } from "../services";
import type { CreateOrderServiceOptions } from "../services";

export interface OrderModuleContext {
  readonly auth: unknown;
  readonly authorization: {
    evaluatePermission(input: {
      readonly permission: CommercePermissionDescriptor;
      readonly session: OrderModuleContext["session"];
    }): OrderAuthorizationDecision;
  };
  readonly session: {
    readonly user?: unknown | null;
  } | null;
}

type OrderAuthorizationDecision =
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
  session: OrderModuleContext["session"],
  permission: CommercePermissionDescriptor,
  authorization: OrderModuleContext["authorization"]
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

const serializeOrder = (order: OrderRecord): OrderApiRecord => ({
  ...order,
  completedAt: order.completedAt?.toISOString() ?? null,
  createdAt: order.createdAt.toISOString(),
  updatedAt: order.updatedAt.toISOString(),
});

const serializeLineItem = (
  item: OrderLineItemRecord
): OrderLineItemApiRecord => ({
  ...item,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
});

const serializeTransaction = (
  transaction: OrderTransactionRecord
): OrderTransactionApiRecord => ({
  ...transaction,
  createdAt: transaction.createdAt.toISOString(),
  updatedAt: transaction.updatedAt.toISOString(),
});

const serializeTransition = (transition: OrderStateTransitionRecord) => ({
  ...transition,
  changedAt: transition.changedAt.toISOString(),
});

const serializeOperation = (operation: OrderPostPurchaseOperationRecord) => ({
  ...operation,
  createdAt: operation.createdAt.toISOString(),
  updatedAt: operation.updatedAt.toISOString(),
});

const serializeAggregate = (
  aggregate: OrderAggregate
): OrderAggregateApiRecord => ({
  lineItems: aggregate.lineItems.map(serializeLineItem),
  operations: aggregate.operations.map(serializeOperation),
  order: serializeOrder(aggregate.order),
  stateTransitions: aggregate.stateTransitions.map(serializeTransition),
  transactions: aggregate.transactions.map(serializeTransaction),
});

export interface CreateOrderRouteFragmentOptions extends CreateOrderServiceOptions {
  readonly createServiceOptionsForContext?: (
    context: OrderModuleContext
  ) => CreateOrderServiceOptions;
  readonly key?: string;
}

export const createOrderRouteFragment = ({
  createServiceOptionsForContext,
  key = "module:order",
  ...options
}: CreateOrderRouteFragmentOptions = {}) => {
  const service =
    options.repository ||
    options.clock ||
    options.idGenerator ||
    options.eventPublisher
      ? createOrderService(options)
      : defaultOrderService;
  const getService = (context: OrderModuleContext) =>
    createServiceOptionsForContext
      ? createOrderService({
          ...options,
          ...createServiceOptionsForContext(context),
        })
      : service;

  const baseImplementation =
    implement(orderContractRouter).$context<OrderModuleContext>();

  const router = baseImplementation.router({
    orderCreateFromCheckout: baseImplementation.orderCreateFromCheckout.handler(
      async ({
        context,
        input,
      }: {
        readonly context: OrderModuleContext;
        readonly input: CreateOrderFromCheckoutInput;
      }) => {
        assertAuthenticatedPermission(
          context.session,
          orderPermissions.write,
          context.authorization
        );

        return serializeAggregate(
          await getService(context).createOrderFromCheckout(input)
        );
      }
    ),
    orderGet: baseImplementation.orderGet.handler(
      async ({ context, input }) => {
        assertAuthenticatedPermission(
          context.session,
          orderPermissions.read,
          context.authorization
        );

        const aggregate = await getService(context).getOrder(
          createOrderId(input.id)
        );

        return aggregate ? serializeAggregate(aggregate) : null;
      }
    ),
    orderList: baseImplementation.orderList.handler(async ({ context }) => {
      assertAuthenticatedPermission(
        context.session,
        orderPermissions.read,
        context.authorization
      );

      const orders = await getService(context).listOrders();

      return orders.map(serializeOrder);
    }),
    orderRecordTransaction: baseImplementation.orderRecordTransaction.handler(
      async ({
        context,
        input,
      }: {
        readonly context: OrderModuleContext;
        readonly input: RecordOrderTransactionInput;
      }) => {
        assertAuthenticatedPermission(
          context.session,
          orderPermissions.write,
          context.authorization
        );

        return serializeTransaction(
          await getService(context).recordTransaction(input)
        );
      }
    ),
    orderTransitionStatus: baseImplementation.orderTransitionStatus.handler(
      async ({
        context,
        input,
      }: {
        readonly context: OrderModuleContext;
        readonly input: TransitionOrderStatusInput;
      }) => {
        assertAuthenticatedPermission(
          context.session,
          orderPermissions.write,
          context.authorization
        );

        return serializeAggregate(
          await getService(context).transitionStatus(input)
        );
      }
    ),
  });

  return {
    key,
    router,
  } as const satisfies CommerceModuleApiFragment<typeof router>;
};

export const orderApiFragment = createOrderRouteFragment();
export const orderRouter = orderApiFragment.router;

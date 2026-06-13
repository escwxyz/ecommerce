import type { AuthSession } from "@ecommerce/auth";
import type { CommerceModuleApiFragment } from "@ecommerce/core";
import type { CommercePermissionDescriptor } from "@ecommerce/core/permissions";
import { implement, ORPCError } from "@orpc/server";

import { customerContractRouter } from "../contracts";
import type {
  CreateCustomerAddressInput,
  CreateCustomerGroupInput,
  CreateCustomerInput,
  CustomerApiProfile,
  CustomerGroup,
  CustomerGroupAssignmentInput,
  CustomerProfile,
  LinkCustomerAuthInput,
  ResolveCustomerFromAuthInput,
  UpdateCustomerProfileInput,
} from "../domain";
import {
  createCustomerGroupId,
  createCustomerId,
  serializeCustomerId,
} from "../domain";
import { customerPermissions } from "../permissions";
import { createCustomerService, defaultCustomerService } from "../services";
import type { CreateCustomerServiceOptions } from "../services";

export interface CustomerModuleContext {
  readonly auth: unknown;
  readonly authorization: {
    evaluatePermission(input: {
      readonly permission: CommercePermissionDescriptor;
      readonly session: AuthSession;
    }): CustomerAuthorizationDecision;
  };
  readonly session: AuthSession;
}

type CustomerAuthorizationDecision =
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
  session: CustomerModuleContext["session"],
  permission: CommercePermissionDescriptor,
  authorization: CustomerModuleContext["authorization"]
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

const serializeCustomer = (customer: CustomerProfile): CustomerApiProfile => ({
  addresses: customer.addresses.map((address) => ({
    ...address,
    id: address.id,
  })),
  authUserId: customer.authUserId,
  createdAt: customer.createdAt.toISOString(),
  email: customer.email,
  firstName: customer.firstName,
  groupIds: [...customer.groupIds],
  id: serializeCustomerId(customer.id),
  lastName: customer.lastName,
  metadata: customer.metadata,
  phone: customer.phone,
  updatedAt: customer.updatedAt.toISOString(),
});

const serializeGroup = (group: CustomerGroup) => ({
  ...group,
  id: group.id,
});

export interface CreateCustomerRouteFragmentOptions extends CreateCustomerServiceOptions {
  readonly key?: string;
}

export const createCustomerRouteFragment = ({
  key = "module:customer",
  ...options
}: CreateCustomerRouteFragmentOptions = {}) => {
  const service =
    options.repository ||
    options.clock ||
    options.idGenerator ||
    options.authorization
      ? createCustomerService(options)
      : defaultCustomerService;

  const baseImplementation = implement(
    customerContractRouter
  ).$context<CustomerModuleContext>();

  const protectedImplementation = baseImplementation.use(
    ({ context, next }) => {
      if (!context.session?.user) {
        throw new ORPCError("UNAUTHORIZED");
      }

      return next({
        context: {
          auth: context.auth,
          authorization: context.authorization,
          session: context.session,
        },
      });
    }
  );

  const router = protectedImplementation.router({
    customerCreate: protectedImplementation.customerCreate.handler(
      async ({
        context,
        input,
      }: {
        readonly context: CustomerModuleContext;
        readonly input: CreateCustomerInput;
      }) => {
        assertPermission(
          context.session,
          customerPermissions.write,
          context.authorization
        );

        return serializeCustomer(await service.createCustomer(input));
      }
    ),
    customerGet: protectedImplementation.customerGet.handler(
      async ({ context, input }) => {
        assertPermission(
          context.session,
          customerPermissions.read,
          context.authorization
        );

        const customer = await service.getCustomerById(
          createCustomerId(input.id)
        );

        return customer ? serializeCustomer(customer) : null;
      }
    ),
    customerList: protectedImplementation.customerList.handler(
      async ({ context }) => {
        assertPermission(
          context.session,
          customerPermissions.read,
          context.authorization
        );

        const customers = await service.listCustomers();
        return customers.map(serializeCustomer);
      }
    ),
    customerProfileUpdate:
      protectedImplementation.customerProfileUpdate.handler(
        async ({
          context,
          input,
        }: {
          readonly context: CustomerModuleContext;
          readonly input: UpdateCustomerProfileInput;
        }) => {
          assertPermission(
            context.session,
            customerPermissions.write,
            context.authorization
          );

          return serializeCustomer(await service.updateCustomerProfile(input));
        }
      ),
    customerAddressCreate:
      protectedImplementation.customerAddressCreate.handler(
        async ({
          context,
          input,
        }: {
          readonly context: CustomerModuleContext;
          readonly input: CreateCustomerAddressInput;
        }) => {
          assertPermission(
            context.session,
            customerPermissions.write,
            context.authorization
          );

          return serializeCustomer(await service.addCustomerAddress(input));
        }
      ),
    customerGroupCreate: protectedImplementation.customerGroupCreate.handler(
      async ({
        context,
        input,
      }: {
        readonly context: CustomerModuleContext;
        readonly input: CreateCustomerGroupInput;
      }) => {
        assertPermission(
          context.session,
          customerPermissions.write,
          context.authorization
        );

        return serializeGroup(await service.createCustomerGroup(input));
      }
    ),
    customerGroupAssign: protectedImplementation.customerGroupAssign.handler(
      async ({
        context,
        input,
      }: {
        readonly context: CustomerModuleContext;
        readonly input: CustomerGroupAssignmentInput;
      }) => {
        assertPermission(
          context.session,
          customerPermissions.write,
          context.authorization
        );

        return serializeCustomer(
          await service.assignCustomerGroup({
            customerId: createCustomerId(input.customerId),
            groupId: createCustomerGroupId(input.groupId),
          })
        );
      }
    ),
    customerAuthLink: protectedImplementation.customerAuthLink.handler(
      async ({
        context,
        input,
      }: {
        readonly context: CustomerModuleContext;
        readonly input: LinkCustomerAuthInput;
      }) => {
        assertPermission(
          context.session,
          customerPermissions.write,
          context.authorization
        );

        return serializeCustomer(
          await service.linkCustomerAuth({
            authUserId: input.authUserId,
            customerId: createCustomerId(input.customerId),
          })
        );
      }
    ),
    customerResolveFromAuth:
      protectedImplementation.customerResolveFromAuth.handler(
        async ({
          context,
          input,
        }: {
          readonly context: CustomerModuleContext;
          readonly input: ResolveCustomerFromAuthInput;
        }) => {
          assertPermission(
            context.session,
            customerPermissions.read,
            context.authorization
          );

          const customer = await service.resolveCustomerFromAuthUserId(
            input.authUserId
          );

          return customer ? serializeCustomer(customer) : null;
        }
      ),
    customerPaymentIdentityGet:
      protectedImplementation.customerPaymentIdentityGet.handler(
        ({ context, input }) => {
          assertPermission(
            context.session,
            customerPermissions.read,
            context.authorization
          );

          return service.getPaymentIdentity(createCustomerId(input.id));
        }
      ),
  });

  return {
    key,
    router,
  } as const satisfies CommerceModuleApiFragment<typeof router>;
};

export const customerApiFragment = createCustomerRouteFragment();
export const customerRouter = customerApiFragment.router;

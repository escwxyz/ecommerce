import {
  CustomerService,
  serializeCustomerAddressId,
  serializeCustomerGroupId,
  serializeCustomerId,
  customerPermissions,
} from "@ecommerce/customer";
import type {
  CustomerAddress,
  CustomerApiAddress,
  CustomerApiGroup,
  CustomerApiProfile,
  CustomerGroup,
  CustomerPaymentIdentity,
  CustomerProfile,
} from "@ecommerce/customer";
import { Effect } from "effect";
import { HttpApi, HttpApiBuilder } from "effect/unstable/httpapi";

import { customerAdminHttpApiGroup } from "./customer-effect-http-contract";
import {
  defineAdminHttpApiGroupContribution,
  defineEffectHttpApiModuleContribution,
} from "./effect-http-api";
import {
  CurrentEffectHttpRequestContext,
  withEffectHttpPermission,
} from "./effect-http-middleware";
import type { EffectHttpRequestIdentity } from "./effect-http-middleware";

const serializeAddress = (address: CustomerAddress): CustomerApiAddress => ({
  address1: address.address1,
  address2: address.address2,
  city: address.city,
  company: address.company,
  countryCode: address.countryCode,
  firstName: address.firstName,
  id: serializeCustomerAddressId(address.id),
  isDefaultBilling: address.isDefaultBilling,
  isDefaultShipping: address.isDefaultShipping,
  kind: address.kind,
  lastName: address.lastName,
  metadata: address.metadata,
  phone: address.phone,
  postalCode: address.postalCode,
  province: address.province,
});

const serializeCustomer = (customer: CustomerProfile): CustomerApiProfile => ({
  addresses: customer.addresses.map(serializeAddress),
  authUserId: customer.authUserId,
  createdAt: customer.createdAt.toISOString(),
  email: customer.email,
  firstName: customer.firstName,
  groupIds: customer.groupIds.map(serializeCustomerGroupId),
  id: serializeCustomerId(customer.id),
  lastName: customer.lastName,
  metadata: customer.metadata,
  phone: customer.phone,
  updatedAt: customer.updatedAt.toISOString(),
});

const serializeGroup = (group: CustomerGroup): CustomerApiGroup => ({
  handle: group.handle,
  id: serializeCustomerGroupId(group.id),
  metadata: group.metadata,
  name: group.name,
});

const serializePaymentIdentity = (
  identity: CustomerPaymentIdentity | null
): CustomerPaymentIdentity | null => identity;

const withSuccessEnvelope = <TData>(
  data: TData,
  request: EffectHttpRequestIdentity
) =>
  ({
    data,
    meta: { request },
    success: true,
  }) as const;

const withCurrentRequest = <TData, TError, TRequirements>(
  effect: Effect.Effect<TData, TError, TRequirements>
) =>
  Effect.gen(function* createCustomerApiSuccessEnvelope() {
    const context = yield* CurrentEffectHttpRequestContext;
    const data = yield* effect;
    return withSuccessEnvelope(data, context.identity);
  });

const customerAdminGroupIdentifier = "customerAdmin";
const customerAdminHttpApi = HttpApi.make("CustomerAdminApi").add(
  customerAdminHttpApiGroup
);

export const customerAdminHttpApiHandlers = HttpApiBuilder.group(
  customerAdminHttpApi,
  customerAdminGroupIdentifier,
  (handlers) =>
    handlers
      .handle("customerCreate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            CustomerService.use((service) =>
              service
                .createCustomer(payload)
                .pipe(Effect.map(serializeCustomer))
            )
          ),
          customerPermissions.write
        )
      )
      .handle("customerGet", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            CustomerService.use((service) =>
              service
                .getCustomerById(payload.id)
                .pipe(
                  Effect.map((customer) =>
                    customer ? serializeCustomer(customer) : null
                  )
                )
            )
          ),
          customerPermissions.read
        )
      )
      .handle("customerList", () =>
        withEffectHttpPermission(
          withCurrentRequest(
            CustomerService.use((service) =>
              service.listCustomers.pipe(
                Effect.map((customers) => customers.map(serializeCustomer))
              )
            )
          ),
          customerPermissions.read
        )
      )
      .handle("customerProfileUpdate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            CustomerService.use((service) =>
              service
                .updateCustomerProfile(payload)
                .pipe(Effect.map(serializeCustomer))
            )
          ),
          customerPermissions.write
        )
      )
      .handle("customerAddressCreate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            CustomerService.use((service) =>
              service
                .addCustomerAddress(payload)
                .pipe(Effect.map(serializeCustomer))
            )
          ),
          customerPermissions.write
        )
      )
      .handle("customerGroupCreate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            CustomerService.use((service) =>
              service
                .createCustomerGroup(payload)
                .pipe(Effect.map(serializeGroup))
            )
          ),
          customerPermissions.write
        )
      )
      .handle("customerGroupAssign", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            CustomerService.use((service) =>
              service
                .assignCustomerGroup(payload)
                .pipe(Effect.map(serializeCustomer))
            )
          ),
          customerPermissions.write
        )
      )
      .handle("customerAuthLink", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            CustomerService.use((service) =>
              service
                .linkCustomerAuth(payload)
                .pipe(Effect.map(serializeCustomer))
            )
          ),
          customerPermissions.write
        )
      )
      .handle("customerResolveFromAuth", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            CustomerService.use((service) =>
              service
                .resolveCustomerFromAuthUserId(payload.authUserId)
                .pipe(
                  Effect.map((customer) =>
                    customer ? serializeCustomer(customer) : null
                  )
                )
            )
          ),
          customerPermissions.read
        )
      )
      .handle("customerPaymentIdentityGet", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            CustomerService.use((service) =>
              service
                .getPaymentIdentity(payload.id)
                .pipe(Effect.map(serializePaymentIdentity))
            )
          ),
          customerPermissions.read
        )
      )
);

export const customerEffectHttpApiContribution =
  defineEffectHttpApiModuleContribution({
    groups: [
      defineAdminHttpApiGroupContribution({
        group: customerAdminHttpApiGroup,
        handlers: customerAdminHttpApiHandlers,
        key: "module:customer.admin",
        owner: "module",
      }),
    ],
    moduleName: "customer",
  });

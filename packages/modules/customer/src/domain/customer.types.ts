import { Context } from "effect";
import type { Effect as EffectValue } from "effect/Effect";

import type { CustomerExpectedError } from "./customer.errors";
import type {
  CreateCustomerAddressInputSchema,
  CreateCustomerGroupInputSchema,
  CreateCustomerInputSchema,
  CustomerAddressIdSchema,
  CustomerAddressSchema,
  CustomerApiGroupSchema,
  CustomerApiListSchema,
  CustomerApiProfileSchema,
  CustomerGroupAssignmentInputSchema,
  CustomerGroupIdSchema,
  CustomerGroupSchema,
  CustomerIdSchema,
  CustomerPaymentIdentitySchema,
  CustomerProfileSchema,
  LinkCustomerAuthInputSchema,
  ResolveCustomerFromAuthInputSchema,
  UpdateCustomerProfileInputSchema,
} from "./customer.schema";

export type CustomerId = typeof CustomerIdSchema.Type;
export type CustomerAddressId = typeof CustomerAddressIdSchema.Type;
export type CustomerGroupId = typeof CustomerGroupIdSchema.Type;
export type CustomerAddress = typeof CustomerAddressSchema.Type;
export type CustomerGroup = typeof CustomerGroupSchema.Type;
export type CustomerProfile = typeof CustomerProfileSchema.Type;
export type CustomerApiAddress =
  (typeof CustomerApiProfileSchema.Type.addresses)[number];
export type CustomerApiGroup = typeof CustomerApiGroupSchema.Type;
export type CustomerApiProfile = typeof CustomerApiProfileSchema.Type;
export type CustomerApiList = typeof CustomerApiListSchema.Type;
export type CreateCustomerInput = typeof CreateCustomerInputSchema.Type;
export type UpdateCustomerProfileInput =
  typeof UpdateCustomerProfileInputSchema.Type;
export type CreateCustomerAddressInput =
  typeof CreateCustomerAddressInputSchema.Type;
export type CreateCustomerGroupInput =
  typeof CreateCustomerGroupInputSchema.Type;
export type CustomerGroupAssignmentInput =
  typeof CustomerGroupAssignmentInputSchema.Type;
export type LinkCustomerAuthInput = typeof LinkCustomerAuthInputSchema.Type;
export type ResolveCustomerFromAuthInput =
  typeof ResolveCustomerFromAuthInputSchema.Type;
export type CustomerPaymentIdentity = typeof CustomerPaymentIdentitySchema.Type;

export interface CustomerRepository {
  readonly addCustomerAddress: (input: {
    readonly address: CustomerAddress;
    readonly customerId: CustomerId;
  }) => EffectValue<CustomerProfile, CustomerExpectedError>;
  readonly assignCustomerGroup: (input: {
    readonly customerId: CustomerId;
    readonly groupId: CustomerGroupId;
  }) => EffectValue<CustomerProfile, CustomerExpectedError>;
  readonly findCustomerByAuthUserId: (
    authUserId: string
  ) => EffectValue<CustomerProfile | null, CustomerExpectedError>;
  readonly findCustomerByEmail: (
    email: string
  ) => EffectValue<CustomerProfile | null, CustomerExpectedError>;
  readonly findCustomerById: (
    id: CustomerId
  ) => EffectValue<CustomerProfile | null, CustomerExpectedError>;
  readonly findCustomerGroupById: (
    id: CustomerGroupId
  ) => EffectValue<CustomerGroup | null, CustomerExpectedError>;
  readonly listCustomerGroups: EffectValue<
    readonly CustomerGroup[],
    CustomerExpectedError
  >;
  readonly listCustomers: EffectValue<
    readonly CustomerProfile[],
    CustomerExpectedError
  >;
  readonly linkCustomerAuth: (input: {
    readonly authUserId: string;
    readonly customerId: CustomerId;
  }) => EffectValue<CustomerProfile, CustomerExpectedError>;
  readonly saveCustomer: (
    customer: CustomerProfile
  ) => EffectValue<CustomerProfile, CustomerExpectedError>;
  readonly saveCustomerGroup: (
    group: CustomerGroup
  ) => EffectValue<CustomerGroup, CustomerExpectedError>;
  readonly updateCustomer: (
    customer: CustomerProfile
  ) => EffectValue<CustomerProfile, CustomerExpectedError>;
}

/** Effect-native customer repository contract consumed by customer services. */
export const CustomerRepositoryService = Context.Service<CustomerRepository>(
  "@ecommerce/customer/CustomerRepositoryService"
);

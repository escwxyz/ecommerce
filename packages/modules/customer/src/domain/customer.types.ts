import type { Brand } from "@ecommerce/core/brand";
import type { z } from "zod";

import type {
  CreateCustomerAddressInputSchema,
  CreateCustomerGroupInputSchema,
  CreateCustomerInputSchema,
  CustomerAddressSchema,
  CustomerApiProfileSchema,
  CustomerGroupAssignmentInputSchema,
  CustomerGroupSchema,
  CustomerPaymentIdentitySchema,
  CustomerProfileSchema,
  LinkCustomerAuthInputSchema,
  ResolveCustomerFromAuthInputSchema,
  UpdateCustomerProfileInputSchema,
} from "./customer.schema";

export type CustomerId = Brand<string, "customer">;
export type CustomerAddressId = Brand<string, "customer-address">;
export type CustomerGroupId = Brand<string, "customer-group">;
export type CustomerAddress = Omit<
  z.infer<typeof CustomerAddressSchema>,
  "id"
> & {
  readonly id: CustomerAddressId;
};
export type CustomerGroup = Omit<z.infer<typeof CustomerGroupSchema>, "id"> & {
  readonly id: CustomerGroupId;
};
export type CustomerProfile = Omit<
  z.infer<typeof CustomerProfileSchema>,
  "addresses" | "groupIds" | "id"
> & {
  readonly addresses: readonly CustomerAddress[];
  readonly groupIds: readonly CustomerGroupId[];
  readonly id: CustomerId;
};
export type CustomerApiProfile = z.infer<typeof CustomerApiProfileSchema>;
export type CreateCustomerInput = z.infer<typeof CreateCustomerInputSchema>;
export type UpdateCustomerProfileInput = z.infer<
  typeof UpdateCustomerProfileInputSchema
>;
export type CreateCustomerAddressInput = z.infer<
  typeof CreateCustomerAddressInputSchema
>;
export type CreateCustomerGroupInput = z.infer<
  typeof CreateCustomerGroupInputSchema
>;
export type CustomerGroupAssignmentInput = z.infer<
  typeof CustomerGroupAssignmentInputSchema
>;
export type LinkCustomerAuthInput = z.infer<typeof LinkCustomerAuthInputSchema>;
export type ResolveCustomerFromAuthInput = z.infer<
  typeof ResolveCustomerFromAuthInputSchema
>;
export type CustomerPaymentIdentity = z.infer<
  typeof CustomerPaymentIdentitySchema
>;

export interface CustomerRepository {
  addCustomerAddress(input: {
    readonly address: CustomerAddress;
    readonly customerId: CustomerId;
  }): Promise<CustomerProfile>;
  assignCustomerGroup(input: {
    readonly customerId: CustomerId;
    readonly groupId: CustomerGroupId;
  }): Promise<CustomerProfile>;
  findCustomerByAuthUserId(authUserId: string): Promise<CustomerProfile | null>;
  findCustomerByEmail(email: string): Promise<CustomerProfile | null>;
  findCustomerById(id: CustomerId): Promise<CustomerProfile | null>;
  findCustomerGroupById(id: CustomerGroupId): Promise<CustomerGroup | null>;
  listCustomerGroups(): Promise<readonly CustomerGroup[]>;
  listCustomers(): Promise<readonly CustomerProfile[]>;
  linkCustomerAuth(input: {
    readonly authUserId: string;
    readonly customerId: CustomerId;
  }): Promise<CustomerProfile>;
  saveCustomer(customer: CustomerProfile): Promise<CustomerProfile>;
  saveCustomerGroup(group: CustomerGroup): Promise<CustomerGroup>;
  updateCustomer(customer: CustomerProfile): Promise<CustomerProfile>;
}

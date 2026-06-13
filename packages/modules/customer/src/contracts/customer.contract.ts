import { defineApiContractRoute } from "@ecommerce/module-contracts";
import { z } from "zod";

import {
  CreateCustomerAddressInputSchema,
  CreateCustomerGroupInputSchema,
  CreateCustomerInputSchema,
  CustomerApiListSchema,
  CustomerApiProfileSchema,
  CustomerGroupAssignmentInputSchema,
  CustomerGroupSchema,
  CustomerIdentifierSchema,
  CustomerPaymentIdentitySchema,
  LinkCustomerAuthInputSchema,
  ResolveCustomerFromAuthInputSchema,
  UpdateCustomerProfileInputSchema,
} from "../domain";

export const customerContractRouter = {
  customerCreate: defineApiContractRoute({
    description: "Create a commerce customer profile.",
    method: "POST",
    operationId: "customerCreate",
    path: "/customers",
    successDescription: "Customer profile created.",
    summary: "Create customer",
    tags: ["Customers"],
  })
    .input(CreateCustomerInputSchema)
    .output(CustomerApiProfileSchema),
  customerGet: defineApiContractRoute({
    description: "Load a customer profile by stable customer identifier.",
    method: "GET",
    operationId: "customerGet",
    path: "/customers/{id}",
    successDescription: "Customer profile returned.",
    summary: "Get customer",
    tags: ["Customers"],
  })
    .input(CustomerIdentifierSchema)
    .output(CustomerApiProfileSchema.nullable()),
  customerList: defineApiContractRoute({
    description: "List commerce customer profiles for admin management.",
    method: "GET",
    operationId: "customerList",
    path: "/customers",
    successDescription: "Customer profiles returned.",
    summary: "List customers",
    tags: ["Customers"],
  })
    .input(z.unknown())
    .output(CustomerApiListSchema),
  customerProfileUpdate: defineApiContractRoute({
    description: "Update customer-owned profile fields and metadata.",
    method: "PUT",
    operationId: "customerProfileUpdate",
    path: "/customers/{id}",
    successDescription: "Customer profile updated.",
    summary: "Update customer profile",
    tags: ["Customers"],
  })
    .input(UpdateCustomerProfileInputSchema)
    .output(CustomerApiProfileSchema),
  customerAddressCreate: defineApiContractRoute({
    description: "Add a customer-owned billing or shipping address.",
    method: "POST",
    operationId: "customerAddressCreate",
    path: "/customers/{customerId}/addresses",
    successDescription: "Customer address added.",
    summary: "Add customer address",
    tags: ["Customers"],
  })
    .input(CreateCustomerAddressInputSchema)
    .output(CustomerApiProfileSchema),
  customerGroupCreate: defineApiContractRoute({
    description: "Create a customer group for pricing or segmentation.",
    method: "POST",
    operationId: "customerGroupCreate",
    path: "/customer-groups",
    successDescription: "Customer group created.",
    summary: "Create customer group",
    tags: ["Customers"],
  })
    .input(CreateCustomerGroupInputSchema)
    .output(CustomerGroupSchema),
  customerGroupAssign: defineApiContractRoute({
    description: "Assign a customer to a customer-owned group.",
    method: "POST",
    operationId: "customerGroupAssign",
    path: "/customer-groups/{groupId}/customers/{customerId}",
    successDescription: "Customer group assigned.",
    summary: "Assign customer group",
    tags: ["Customers"],
  })
    .input(CustomerGroupAssignmentInputSchema)
    .output(CustomerApiProfileSchema),
  customerAuthLink: defineApiContractRoute({
    description: "Link a shared auth user to a commerce customer profile.",
    method: "POST",
    operationId: "customerAuthLink",
    path: "/customers/{customerId}/auth-link",
    successDescription: "Customer auth link updated.",
    summary: "Link customer auth",
    tags: ["Customers"],
  })
    .input(LinkCustomerAuthInputSchema)
    .output(CustomerApiProfileSchema),
  customerResolveFromAuth: defineApiContractRoute({
    description:
      "Resolve a commerce customer profile from a shared auth user identifier.",
    method: "POST",
    operationId: "customerResolveFromAuth",
    path: "/customers/resolve-auth",
    successDescription: "Customer auth relationship resolved.",
    summary: "Resolve customer from auth",
    tags: ["Customers"],
  })
    .input(ResolveCustomerFromAuthInputSchema)
    .output(CustomerApiProfileSchema.nullable()),
  customerPaymentIdentityGet: defineApiContractRoute({
    description:
      "Expose customer identity data needed by payment account-holder flows without owning provider account-holder state.",
    method: "GET",
    operationId: "customerPaymentIdentityGet",
    path: "/customers/{id}/payment-identity",
    successDescription: "Customer payment identity returned.",
    summary: "Get customer payment identity",
    tags: ["Customers"],
  })
    .input(CustomerIdentifierSchema)
    .output(CustomerPaymentIdentitySchema.nullable()),
} as const;

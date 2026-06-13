import { z } from "zod";

export const CustomerMetadataSchema = z.record(z.string(), z.string());

export const CustomerAddressKindSchema = z.enum(["billing", "shipping"]);

export const CustomerAddressSchema = z.object({
  address1: z.string().min(1),
  address2: z.string().optional(),
  city: z.string().min(1),
  company: z.string().optional(),
  countryCode: z.string().min(2),
  firstName: z.string().optional(),
  id: z.string().min(1).startsWith("caddr_"),
  isDefaultBilling: z.boolean(),
  isDefaultShipping: z.boolean(),
  kind: CustomerAddressKindSchema,
  lastName: z.string().optional(),
  metadata: CustomerMetadataSchema,
  phone: z.string().optional(),
  postalCode: z.string().min(1),
  province: z.string().optional(),
});

export const CustomerGroupSchema = z.object({
  handle: z.string().min(1),
  id: z.string().min(1).startsWith("cgrp_"),
  metadata: CustomerMetadataSchema,
  name: z.string().min(1),
});

export const CustomerProfileSchema = z.object({
  addresses: z.array(CustomerAddressSchema),
  authUserId: z.string().min(1).nullable(),
  createdAt: z.date(),
  email: z.string().email(),
  firstName: z.string().optional(),
  groupIds: z.array(z.string().min(1).startsWith("cgrp_")),
  id: z.string().min(1).startsWith("cust_"),
  lastName: z.string().optional(),
  metadata: CustomerMetadataSchema,
  phone: z.string().optional(),
  updatedAt: z.date(),
});

export const CreateCustomerInputSchema = z.object({
  authUserId: z.string().min(1).optional(),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  metadata: CustomerMetadataSchema.optional(),
  phone: z.string().optional(),
});

export const UpdateCustomerProfileInputSchema = z
  .object({
    email: z.string().email().optional(),
    firstName: z.string().optional(),
    id: z.string().min(1).startsWith("cust_"),
    lastName: z.string().optional(),
    metadata: CustomerMetadataSchema.optional(),
    phone: z.string().optional(),
  })
  .strict();

export const CustomerIdentifierSchema = z.object({
  id: z.string().min(1).startsWith("cust_"),
});

export const CreateCustomerAddressInputSchema = CustomerAddressSchema.omit({
  id: true,
}).extend({
  customerId: z.string().min(1).startsWith("cust_"),
});

export const CreateCustomerGroupInputSchema = z.object({
  handle: z.string().min(1),
  metadata: CustomerMetadataSchema.optional(),
  name: z.string().min(1),
});

export const CustomerGroupAssignmentInputSchema = z.object({
  customerId: z.string().min(1).startsWith("cust_"),
  groupId: z.string().min(1).startsWith("cgrp_"),
});

export const LinkCustomerAuthInputSchema = z.object({
  authUserId: z.string().min(1),
  customerId: z.string().min(1).startsWith("cust_"),
});

export const ResolveCustomerFromAuthInputSchema = z.object({
  authUserId: z.string().min(1),
});

export const CustomerPaymentIdentitySchema = z.object({
  customerId: z.string().min(1).startsWith("cust_"),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
});

export const CustomerApiProfileSchema = CustomerProfileSchema.extend({
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const CustomerApiListSchema = z.array(CustomerApiProfileSchema);

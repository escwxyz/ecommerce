import { Schema } from "effect";

const customerEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

const isCanonicalIsoDateTime = (value: string): boolean => {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
};

/** Stable commerce customer profile identifier owned by the customer module. */
export const CustomerIdSchema = Schema.NonEmptyString.pipe(
  Schema.check(Schema.isStartsWith("cust_")),
  Schema.brand("CustomerId")
);

/** Stable customer address identifier owned by the customer module. */
export const CustomerAddressIdSchema = Schema.NonEmptyString.pipe(
  Schema.check(Schema.isStartsWith("caddr_")),
  Schema.brand("CustomerAddressId")
);

/** Stable customer group identifier owned by the customer module. */
export const CustomerGroupIdSchema = Schema.NonEmptyString.pipe(
  Schema.check(Schema.isStartsWith("cgrp_")),
  Schema.brand("CustomerGroupId")
);

export const CustomerSerializedIdSchema = Schema.NonEmptyString.pipe(
  Schema.check(Schema.isStartsWith("cust_"))
);
export const CustomerSerializedAddressIdSchema = Schema.NonEmptyString.pipe(
  Schema.check(Schema.isStartsWith("caddr_"))
);
export const CustomerSerializedGroupIdSchema = Schema.NonEmptyString.pipe(
  Schema.check(Schema.isStartsWith("cgrp_"))
);

export const CustomerTrimmedStringSchema = Schema.Trimmed.pipe(
  Schema.check(Schema.isMinLength(1))
);

export const CustomerEmailSchema = CustomerTrimmedStringSchema.pipe(
  Schema.check(Schema.isPattern(customerEmailPattern))
);

/** Canonical UTC ISO datetime string emitted by customer API serializers. */
export const CustomerIsoDateTimeStringSchema = CustomerTrimmedStringSchema.pipe(
  Schema.check(Schema.makeFilter(isCanonicalIsoDateTime))
);

export const CustomerMetadataSchema = Schema.Record(
  Schema.String,
  Schema.String
);

export const CustomerAddressKindSchema = Schema.Literals([
  "billing",
  "shipping",
]);

export const CustomerAddressSchema = Schema.Struct({
  address1: CustomerTrimmedStringSchema,
  address2: Schema.optional(CustomerTrimmedStringSchema),
  city: CustomerTrimmedStringSchema,
  company: Schema.optional(CustomerTrimmedStringSchema),
  countryCode: CustomerTrimmedStringSchema,
  firstName: Schema.optional(CustomerTrimmedStringSchema),
  id: CustomerAddressIdSchema,
  isDefaultBilling: Schema.Boolean,
  isDefaultShipping: Schema.Boolean,
  kind: CustomerAddressKindSchema,
  lastName: Schema.optional(CustomerTrimmedStringSchema),
  metadata: CustomerMetadataSchema,
  phone: Schema.optional(CustomerTrimmedStringSchema),
  postalCode: CustomerTrimmedStringSchema,
  province: Schema.optional(CustomerTrimmedStringSchema),
});

export const CustomerGroupSchema = Schema.Struct({
  handle: CustomerTrimmedStringSchema,
  id: CustomerGroupIdSchema,
  metadata: CustomerMetadataSchema,
  name: CustomerTrimmedStringSchema,
});

export const CustomerProfileSchema = Schema.Struct({
  addresses: Schema.Array(CustomerAddressSchema),
  authUserId: Schema.NullOr(CustomerTrimmedStringSchema),
  createdAt: Schema.Date,
  email: CustomerEmailSchema,
  firstName: Schema.optional(CustomerTrimmedStringSchema),
  groupIds: Schema.Array(CustomerGroupIdSchema),
  id: CustomerIdSchema,
  lastName: Schema.optional(CustomerTrimmedStringSchema),
  metadata: CustomerMetadataSchema,
  phone: Schema.optional(CustomerTrimmedStringSchema),
  updatedAt: Schema.Date,
});

export const CreateCustomerInputSchema = Schema.Struct({
  authUserId: Schema.optional(CustomerTrimmedStringSchema),
  email: CustomerEmailSchema,
  firstName: Schema.optional(Schema.String),
  lastName: Schema.optional(Schema.String),
  metadata: Schema.optional(CustomerMetadataSchema),
  phone: Schema.optional(Schema.String),
});

export const UpdateCustomerProfileInputSchema = Schema.Struct({
  email: Schema.optional(CustomerEmailSchema),
  firstName: Schema.optional(Schema.String),
  id: CustomerIdSchema,
  lastName: Schema.optional(Schema.String),
  metadata: Schema.optional(CustomerMetadataSchema),
  phone: Schema.optional(Schema.String),
});

export const CustomerIdentifierSchema = Schema.Struct({
  id: CustomerIdSchema,
});

export const CreateCustomerAddressInputSchema = Schema.Struct({
  address1: CustomerTrimmedStringSchema,
  address2: Schema.optional(Schema.String),
  city: CustomerTrimmedStringSchema,
  company: Schema.optional(Schema.String),
  countryCode: CustomerTrimmedStringSchema,
  customerId: CustomerIdSchema,
  firstName: Schema.optional(Schema.String),
  isDefaultBilling: Schema.Boolean,
  isDefaultShipping: Schema.Boolean,
  kind: CustomerAddressKindSchema,
  lastName: Schema.optional(Schema.String),
  metadata: CustomerMetadataSchema,
  phone: Schema.optional(Schema.String),
  postalCode: CustomerTrimmedStringSchema,
  province: Schema.optional(Schema.String),
});

export const CreateCustomerGroupInputSchema = Schema.Struct({
  handle: CustomerTrimmedStringSchema,
  metadata: Schema.optional(CustomerMetadataSchema),
  name: CustomerTrimmedStringSchema,
});

export const CustomerGroupAssignmentInputSchema = Schema.Struct({
  customerId: CustomerIdSchema,
  groupId: CustomerGroupIdSchema,
});

export const LinkCustomerAuthInputSchema = Schema.Struct({
  authUserId: CustomerTrimmedStringSchema,
  customerId: CustomerIdSchema,
});

export const ResolveCustomerFromAuthInputSchema = Schema.Struct({
  authUserId: CustomerTrimmedStringSchema,
});

export const CustomerPaymentIdentitySchema = Schema.Struct({
  customerId: CustomerIdSchema,
  email: CustomerEmailSchema,
  firstName: Schema.optional(CustomerTrimmedStringSchema),
  lastName: Schema.optional(CustomerTrimmedStringSchema),
  phone: Schema.optional(CustomerTrimmedStringSchema),
});

export const CustomerApiAddressSchema = Schema.Struct({
  address1: CustomerTrimmedStringSchema,
  address2: Schema.optional(CustomerTrimmedStringSchema),
  city: CustomerTrimmedStringSchema,
  company: Schema.optional(CustomerTrimmedStringSchema),
  countryCode: CustomerTrimmedStringSchema,
  firstName: Schema.optional(CustomerTrimmedStringSchema),
  id: CustomerSerializedAddressIdSchema,
  isDefaultBilling: Schema.Boolean,
  isDefaultShipping: Schema.Boolean,
  kind: CustomerAddressKindSchema,
  lastName: Schema.optional(CustomerTrimmedStringSchema),
  metadata: CustomerMetadataSchema,
  phone: Schema.optional(CustomerTrimmedStringSchema),
  postalCode: CustomerTrimmedStringSchema,
  province: Schema.optional(CustomerTrimmedStringSchema),
});

export const CustomerApiGroupSchema = Schema.Struct({
  handle: CustomerTrimmedStringSchema,
  id: CustomerSerializedGroupIdSchema,
  metadata: CustomerMetadataSchema,
  name: CustomerTrimmedStringSchema,
});

export const CustomerApiProfileSchema = Schema.Struct({
  addresses: Schema.Array(CustomerApiAddressSchema),
  authUserId: Schema.NullOr(CustomerTrimmedStringSchema),
  createdAt: CustomerIsoDateTimeStringSchema,
  email: CustomerEmailSchema,
  firstName: Schema.optional(CustomerTrimmedStringSchema),
  groupIds: Schema.Array(CustomerSerializedGroupIdSchema),
  id: CustomerSerializedIdSchema,
  lastName: Schema.optional(CustomerTrimmedStringSchema),
  metadata: CustomerMetadataSchema,
  phone: Schema.optional(CustomerTrimmedStringSchema),
  updatedAt: CustomerIsoDateTimeStringSchema,
});

export const CustomerApiListSchema = Schema.Array(CustomerApiProfileSchema);

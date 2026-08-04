import { Effect, Schema } from "effect";
import type { Effect as EffectValue } from "effect/Effect";

import { CustomerInvalidIdentifier } from "./customer.errors";
import {
  CustomerAddressIdSchema,
  CustomerGroupIdSchema,
  CustomerIdSchema,
} from "./customer.schema";
import type {
  CustomerAddressId,
  CustomerGroupId,
  CustomerId,
} from "./customer.types";

export const CUSTOMER_ID_PREFIX = "cust_";
export const CUSTOMER_ADDRESS_ID_PREFIX = "caddr_";
export const CUSTOMER_GROUP_ID_PREFIX = "cgrp_";

const toInvalidIdentifier = (
  expectedPrefix: string,
  value: string
): CustomerInvalidIdentifier =>
  new CustomerInvalidIdentifier({
    expectedPrefix,
    value,
  });

export const createCustomerIdEffect = (
  value: string
): EffectValue<CustomerId, CustomerInvalidIdentifier> =>
  Schema.decodeUnknownEffect(CustomerIdSchema)(value).pipe(
    Effect.mapError(() => toInvalidIdentifier(CUSTOMER_ID_PREFIX, value))
  );

export const createCustomerAddressIdEffect = (
  value: string
): EffectValue<CustomerAddressId, CustomerInvalidIdentifier> =>
  Schema.decodeUnknownEffect(CustomerAddressIdSchema)(value).pipe(
    Effect.mapError(() =>
      toInvalidIdentifier(CUSTOMER_ADDRESS_ID_PREFIX, value)
    )
  );

export const createCustomerGroupIdEffect = (
  value: string
): EffectValue<CustomerGroupId, CustomerInvalidIdentifier> =>
  Schema.decodeUnknownEffect(CustomerGroupIdSchema)(value).pipe(
    Effect.mapError(() => toInvalidIdentifier(CUSTOMER_GROUP_ID_PREFIX, value))
  );

export const createCustomerId = (value: string): CustomerId =>
  Schema.decodeUnknownSync(CustomerIdSchema)(value);

export const createCustomerAddressId = (value: string): CustomerAddressId =>
  Schema.decodeUnknownSync(CustomerAddressIdSchema)(value);

export const createCustomerGroupId = (value: string): CustomerGroupId =>
  Schema.decodeUnknownSync(CustomerGroupIdSchema)(value);

export const serializeCustomerId = (id: CustomerId): string => id;
export const serializeCustomerAddressId = (id: CustomerAddressId): string => id;
export const serializeCustomerGroupId = (id: CustomerGroupId): string => id;

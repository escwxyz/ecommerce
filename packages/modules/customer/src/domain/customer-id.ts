import { brand } from "@ecommerce/core/brand";

import type {
  CustomerAddressId,
  CustomerGroupId,
  CustomerId,
} from "./customer.types";

export const CUSTOMER_ID_PREFIX = "cust_";
export const CUSTOMER_ADDRESS_ID_PREFIX = "caddr_";
export const CUSTOMER_GROUP_ID_PREFIX = "cgrp_";

export const createCustomerId = (value: string): CustomerId => {
  if (!value.startsWith(CUSTOMER_ID_PREFIX)) {
    throw new Error(`Customer ID must start with "${CUSTOMER_ID_PREFIX}".`);
  }

  return brand<"customer", string>(value);
};

export const createCustomerAddressId = (value: string): CustomerAddressId => {
  if (!value.startsWith(CUSTOMER_ADDRESS_ID_PREFIX)) {
    throw new Error(
      `Customer address ID must start with "${CUSTOMER_ADDRESS_ID_PREFIX}".`
    );
  }

  return brand<"customer-address", string>(value);
};

export const createCustomerGroupId = (value: string): CustomerGroupId => {
  if (!value.startsWith(CUSTOMER_GROUP_ID_PREFIX)) {
    throw new Error(
      `Customer group ID must start with "${CUSTOMER_GROUP_ID_PREFIX}".`
    );
  }

  return brand<"customer-group", string>(value);
};

export const serializeCustomerId = (id: CustomerId): string => id;
export const serializeCustomerAddressId = (id: CustomerAddressId): string => id;
export const serializeCustomerGroupId = (id: CustomerGroupId): string => id;

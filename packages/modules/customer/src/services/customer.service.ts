import type {
  AuthActor,
  AuthSession,
  CreateAuthorizationEvaluatorOptions,
} from "@ecommerce/auth";
import { createAuthorizationEvaluator } from "@ecommerce/auth";
import type {
  ClockServiceShape,
  IdGeneratorServiceShape,
} from "@ecommerce/core";
import { Context, Layer } from "effect";
import { nanoid } from "nanoid";

import type {
  CreateCustomerAddressInput,
  CreateCustomerGroupInput,
  CreateCustomerInput,
  CustomerAddress,
  CustomerGroup,
  CustomerGroupId,
  CustomerId,
  CustomerPaymentIdentity,
  CustomerProfile,
  CustomerRepository,
  UpdateCustomerProfileInput,
} from "../domain";
import {
  CUSTOMER_ADDRESS_ID_PREFIX,
  CUSTOMER_GROUP_ID_PREFIX,
  CUSTOMER_ID_PREFIX,
  createCustomerAddressId,
  createCustomerGroupId,
  createCustomerId,
} from "../domain";
import { defaultCustomerRepository } from "../repositories";

export const CUSTOMER_CREATED_EVENT = "customer.created" as const;
export const CUSTOMER_UPDATED_EVENT = "customer.updated" as const;
export const CUSTOMER_AUTH_LINKED_EVENT = "customer.auth-linked" as const;

export interface CustomerChangedEventPayload {
  readonly customerId: CustomerId;
}

export interface CustomerAuthLinkedEventPayload extends CustomerChangedEventPayload {
  readonly authUserId: string;
}

export interface CustomerServiceShape {
  addCustomerAddress(
    input: CreateCustomerAddressInput
  ): Promise<CustomerProfile>;
  assignCustomerGroup(input: {
    readonly customerId: CustomerId;
    readonly groupId: CustomerGroupId;
  }): Promise<CustomerProfile>;
  createCustomer(input: CreateCustomerInput): Promise<CustomerProfile>;
  createCustomerGroup(input: CreateCustomerGroupInput): Promise<CustomerGroup>;
  getCustomerById(id: CustomerId): Promise<CustomerProfile | null>;
  getPaymentIdentity(
    customerId: CustomerId
  ): Promise<CustomerPaymentIdentity | null>;
  linkCustomerAuth(input: {
    readonly authUserId: string;
    readonly customerId: CustomerId;
  }): Promise<CustomerProfile>;
  listCustomerGroups(): Promise<readonly CustomerGroup[]>;
  listCustomers(): Promise<readonly CustomerProfile[]>;
  resolveCustomerActor(session: AuthSession): AuthActor;
  resolveCustomerFromAuthUserId(
    authUserId: string
  ): Promise<CustomerProfile | null>;
  updateCustomerProfile(
    input: UpdateCustomerProfileInput
  ): Promise<CustomerProfile>;
}

export const CustomerService = Context.Service<CustomerServiceShape>(
  "@ecommerce/customer/CustomerService"
);

export interface CreateCustomerServiceOptions {
  readonly authorization?: CreateAuthorizationEvaluatorOptions;
  readonly clock?: ClockServiceShape;
  readonly idGenerator?: IdGeneratorServiceShape;
  readonly repository?: CustomerRepository;
}

const createDefaultClock = (): ClockServiceShape => ({
  now: () => new Date(),
});

const createDefaultIdGenerator = (): IdGeneratorServiceShape => ({
  nextId: () => nanoid(),
});

const normalizeEmail = (email: string): string => email.trim().toLowerCase();
const normalizeOptional = (value: string | undefined): string | undefined => {
  const normalized = value?.trim();
  return normalized || undefined;
};

const requireCustomer = async (
  repository: CustomerRepository,
  customerId: CustomerId
): Promise<CustomerProfile> => {
  const customer = await repository.findCustomerById(customerId);

  if (!customer) {
    throw new Error(`Customer "${customerId}" was not found.`);
  }

  return customer;
};

const requireUniqueEmail = async (
  repository: CustomerRepository,
  email: string,
  currentCustomerId?: CustomerId
): Promise<void> => {
  const existing = await repository.findCustomerByEmail(email);

  if (existing && existing.id !== currentCustomerId) {
    throw new Error(`Customer email "${email}" already exists.`);
  }
};

const requireUniqueAuthUser = async (
  repository: CustomerRepository,
  authUserId: string,
  currentCustomerId?: CustomerId
): Promise<void> => {
  const existing = await repository.findCustomerByAuthUserId(authUserId);

  if (existing && existing.id !== currentCustomerId) {
    throw new Error(`Auth user "${authUserId}" is already linked.`);
  }
};

const createPrefixedId = (
  idGenerator: IdGeneratorServiceShape,
  prefix: string
): string => {
  const nextId = idGenerator.nextId();
  return nextId.startsWith(prefix) ? nextId : `${prefix}${nextId}`;
};

export const createCustomerService = ({
  authorization,
  clock = createDefaultClock(),
  idGenerator = createDefaultIdGenerator(),
  repository = defaultCustomerRepository,
}: CreateCustomerServiceOptions = {}): CustomerServiceShape => {
  const authEvaluator = createAuthorizationEvaluator(authorization);

  return {
    addCustomerAddress: async (input) => {
      await requireCustomer(repository, createCustomerId(input.customerId));
      const address: CustomerAddress = {
        address1: input.address1.trim(),
        address2: normalizeOptional(input.address2),
        city: input.city.trim(),
        company: normalizeOptional(input.company),
        countryCode: input.countryCode.trim().toUpperCase(),
        firstName: normalizeOptional(input.firstName),
        id: createCustomerAddressId(
          createPrefixedId(idGenerator, CUSTOMER_ADDRESS_ID_PREFIX)
        ),
        isDefaultBilling: input.isDefaultBilling,
        isDefaultShipping: input.isDefaultShipping,
        kind: input.kind,
        lastName: normalizeOptional(input.lastName),
        metadata: input.metadata,
        phone: normalizeOptional(input.phone),
        postalCode: input.postalCode.trim(),
        province: normalizeOptional(input.province),
      };

      return repository.addCustomerAddress({
        address,
        customerId: createCustomerId(input.customerId),
      });
    },
    assignCustomerGroup: ({ customerId, groupId }) =>
      repository.assignCustomerGroup({ customerId, groupId }),
    createCustomer: async (input) => {
      const email = normalizeEmail(input.email);
      await requireUniqueEmail(repository, email);
      if (input.authUserId) {
        await requireUniqueAuthUser(repository, input.authUserId);
      }

      const now = clock.now();
      const customer: CustomerProfile = {
        addresses: [],
        authUserId: input.authUserId ?? null,
        createdAt: now,
        email,
        firstName: normalizeOptional(input.firstName),
        groupIds: [],
        id: createCustomerId(createPrefixedId(idGenerator, CUSTOMER_ID_PREFIX)),
        lastName: normalizeOptional(input.lastName),
        metadata: input.metadata ?? {},
        phone: normalizeOptional(input.phone),
        updatedAt: now,
      };

      return repository.saveCustomer(customer);
    },
    createCustomerGroup: (input) => {
      const group: CustomerGroup = {
        handle: input.handle.trim().toLowerCase(),
        id: createCustomerGroupId(
          createPrefixedId(idGenerator, CUSTOMER_GROUP_ID_PREFIX)
        ),
        metadata: input.metadata ?? {},
        name: input.name.trim(),
      };

      if (!group.handle) {
        throw new Error("Customer group handle is required.");
      }

      if (!group.name) {
        throw new Error("Customer group name is required.");
      }

      return repository.saveCustomerGroup(group);
    },
    getCustomerById: (id) => repository.findCustomerById(id),
    getPaymentIdentity: async (customerId) => {
      const customer = await repository.findCustomerById(customerId);

      return customer
        ? {
            customerId: customer.id,
            email: customer.email,
            firstName: customer.firstName,
            lastName: customer.lastName,
            phone: customer.phone,
          }
        : null;
    },
    linkCustomerAuth: async ({ authUserId, customerId }) => {
      await requireUniqueAuthUser(repository, authUserId, customerId);
      await requireCustomer(repository, customerId);

      return repository.linkCustomerAuth({ authUserId, customerId });
    },
    listCustomerGroups: () => repository.listCustomerGroups(),
    listCustomers: () => repository.listCustomers(),
    resolveCustomerActor: (session) => authEvaluator.resolveAuthActor(session),
    resolveCustomerFromAuthUserId: (authUserId) =>
      repository.findCustomerByAuthUserId(authUserId),
    updateCustomerProfile: async (input) => {
      const customerId = createCustomerId(input.id);
      const customer = await requireCustomer(repository, customerId);
      const email = input.email ? normalizeEmail(input.email) : customer.email;
      await requireUniqueEmail(repository, email, customerId);

      return repository.updateCustomer({
        ...customer,
        email,
        firstName:
          input.firstName === undefined
            ? customer.firstName
            : normalizeOptional(input.firstName),
        lastName:
          input.lastName === undefined
            ? customer.lastName
            : normalizeOptional(input.lastName),
        metadata: input.metadata ?? customer.metadata,
        phone:
          input.phone === undefined
            ? customer.phone
            : normalizeOptional(input.phone),
        updatedAt: clock.now(),
      });
    },
  };
};

export const createCustomerServiceLayer = (service: CustomerServiceShape) =>
  Layer.succeed(CustomerService, service);

export const defaultCustomerService = createCustomerService({
  repository: defaultCustomerRepository,
});

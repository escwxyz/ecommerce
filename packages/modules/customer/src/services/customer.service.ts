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
import { ClockService, IdGeneratorService } from "@ecommerce/core";
import { Context, Effect, Layer } from "effect";
import type { Effect as EffectValue } from "effect/Effect";
import { nanoid } from "nanoid";

import type {
  CreateCustomerAddressInput,
  CreateCustomerGroupInput,
  CreateCustomerInput,
  CustomerAddress,
  CustomerExpectedError,
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
  CustomerAuthUserConflict,
  CustomerEmailConflict,
  CustomerNotFound,
  CustomerRepositoryService,
  createCustomerAddressIdEffect,
  createCustomerGroupIdEffect,
  createCustomerIdEffect,
} from "../domain";

export const CUSTOMER_CREATED_EVENT = "customer.created" as const;
export const CUSTOMER_UPDATED_EVENT = "customer.updated" as const;
export const CUSTOMER_AUTH_LINKED_EVENT = "customer.auth-linked" as const;

export interface CustomerChangedEventPayload {
  readonly customerId: CustomerId;
}

export interface CustomerAuthLinkedEventPayload extends CustomerChangedEventPayload {
  readonly authUserId: string;
}

export type CustomerServiceFailure = CustomerExpectedError;

export interface CustomerServiceShape {
  readonly addCustomerAddress: (
    input: CreateCustomerAddressInput
  ) => EffectValue<CustomerProfile, CustomerServiceFailure>;
  readonly assignCustomerGroup: (input: {
    readonly customerId: CustomerId;
    readonly groupId: CustomerGroupId;
  }) => EffectValue<CustomerProfile, CustomerServiceFailure>;
  readonly createCustomer: (
    input: CreateCustomerInput
  ) => EffectValue<CustomerProfile, CustomerServiceFailure>;
  readonly createCustomerGroup: (
    input: CreateCustomerGroupInput
  ) => EffectValue<CustomerGroup, CustomerServiceFailure>;
  readonly getCustomerById: (
    id: CustomerId
  ) => EffectValue<CustomerProfile | null, CustomerServiceFailure>;
  readonly getPaymentIdentity: (
    customerId: CustomerId
  ) => EffectValue<CustomerPaymentIdentity | null, CustomerServiceFailure>;
  readonly linkCustomerAuth: (input: {
    readonly authUserId: string;
    readonly customerId: CustomerId;
  }) => EffectValue<CustomerProfile, CustomerServiceFailure>;
  readonly listCustomerGroups: EffectValue<
    readonly CustomerGroup[],
    CustomerServiceFailure
  >;
  readonly listCustomers: EffectValue<
    readonly CustomerProfile[],
    CustomerServiceFailure
  >;
  readonly resolveCustomerActor: (session: AuthSession) => AuthActor;
  readonly resolveCustomerFromAuthUserId: (
    authUserId: string
  ) => EffectValue<CustomerProfile | null, CustomerServiceFailure>;
  readonly updateCustomerProfile: (
    input: UpdateCustomerProfileInput
  ) => EffectValue<CustomerProfile, CustomerServiceFailure>;
}

export const CustomerService = Context.Service<CustomerServiceShape>(
  "@ecommerce/customer/CustomerService"
);

export interface CreateCustomerServiceOptions {
  readonly authorization?: CreateAuthorizationEvaluatorOptions;
  readonly clock?: ClockServiceShape;
  readonly idGenerator?: IdGeneratorServiceShape;
  readonly repository: CustomerRepository;
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

const requireCustomer = (
  repository: CustomerRepository,
  customerId: CustomerId
): EffectValue<CustomerProfile, CustomerServiceFailure> =>
  repository
    .findCustomerById(customerId)
    .pipe(
      Effect.flatMap((customer) =>
        customer
          ? Effect.succeed(customer)
          : Effect.fail(new CustomerNotFound({ customerId }))
      )
    );

const requireUniqueEmail = (
  repository: CustomerRepository,
  email: string,
  currentCustomerId?: CustomerId
): EffectValue<void, CustomerServiceFailure> =>
  repository.findCustomerByEmail(email).pipe(
    Effect.flatMap((existing) => {
      if (existing && existing.id !== currentCustomerId) {
        return Effect.fail(new CustomerEmailConflict({ email }));
      }

      return Effect.void;
    })
  );

const requireUniqueAuthUser = (
  repository: CustomerRepository,
  authUserId: string,
  currentCustomerId?: CustomerId
): EffectValue<void, CustomerServiceFailure> =>
  repository.findCustomerByAuthUserId(authUserId).pipe(
    Effect.flatMap((existing) => {
      if (existing && existing.id !== currentCustomerId) {
        return Effect.fail(new CustomerAuthUserConflict({ authUserId }));
      }

      return Effect.void;
    })
  );

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
  repository,
}: CreateCustomerServiceOptions): CustomerServiceShape => {
  const authEvaluator = createAuthorizationEvaluator(authorization);

  return {
    addCustomerAddress: (input) =>
      Effect.gen(function* addCustomerAddressEffect() {
        const customerId = yield* createCustomerIdEffect(input.customerId);
        yield* requireCustomer(repository, customerId);
        const addressId = yield* createCustomerAddressIdEffect(
          createPrefixedId(idGenerator, CUSTOMER_ADDRESS_ID_PREFIX)
        );
        const address: CustomerAddress = {
          address1: input.address1.trim(),
          address2: normalizeOptional(input.address2),
          city: input.city.trim(),
          company: normalizeOptional(input.company),
          countryCode: input.countryCode.trim().toUpperCase(),
          firstName: normalizeOptional(input.firstName),
          id: addressId,
          isDefaultBilling: input.isDefaultBilling,
          isDefaultShipping: input.isDefaultShipping,
          kind: input.kind,
          lastName: normalizeOptional(input.lastName),
          metadata: input.metadata,
          phone: normalizeOptional(input.phone),
          postalCode: input.postalCode.trim(),
          province: normalizeOptional(input.province),
        };

        return yield* repository.addCustomerAddress({
          address,
          customerId,
        });
      }),
    assignCustomerGroup: ({ customerId, groupId }) =>
      repository.assignCustomerGroup({ customerId, groupId }),
    createCustomer: (input) =>
      Effect.gen(function* createCustomerEffect() {
        const email = normalizeEmail(input.email);
        yield* requireUniqueEmail(repository, email);
        if (input.authUserId) {
          yield* requireUniqueAuthUser(repository, input.authUserId);
        }

        const now = clock.now();
        const id = yield* createCustomerIdEffect(
          createPrefixedId(idGenerator, CUSTOMER_ID_PREFIX)
        );
        const customer: CustomerProfile = {
          addresses: [],
          authUserId: input.authUserId ?? null,
          createdAt: now,
          email,
          firstName: normalizeOptional(input.firstName),
          groupIds: [],
          id,
          lastName: normalizeOptional(input.lastName),
          metadata: input.metadata ?? {},
          phone: normalizeOptional(input.phone),
          updatedAt: now,
        };

        return yield* repository.saveCustomer(customer);
      }),
    createCustomerGroup: (input) =>
      Effect.gen(function* createCustomerGroupEffect() {
        const id = yield* createCustomerGroupIdEffect(
          createPrefixedId(idGenerator, CUSTOMER_GROUP_ID_PREFIX)
        );
        const group: CustomerGroup = {
          handle: input.handle.trim().toLowerCase(),
          id,
          metadata: input.metadata ?? {},
          name: input.name.trim(),
        };

        return yield* repository.saveCustomerGroup(group);
      }),
    getCustomerById: (id) => repository.findCustomerById(id),
    getPaymentIdentity: (customerId) =>
      repository.findCustomerById(customerId).pipe(
        Effect.map((customer) =>
          customer
            ? {
                customerId: customer.id,
                email: customer.email,
                firstName: customer.firstName,
                lastName: customer.lastName,
                phone: customer.phone,
              }
            : null
        )
      ),
    linkCustomerAuth: ({ authUserId, customerId }) =>
      Effect.gen(function* linkCustomerAuthEffect() {
        yield* requireUniqueAuthUser(repository, authUserId, customerId);
        yield* requireCustomer(repository, customerId);

        return yield* repository.linkCustomerAuth({ authUserId, customerId });
      }),
    listCustomerGroups: repository.listCustomerGroups,
    listCustomers: repository.listCustomers,
    resolveCustomerActor: (session) => authEvaluator.resolveAuthActor(session),
    resolveCustomerFromAuthUserId: (authUserId) =>
      repository.findCustomerByAuthUserId(authUserId),
    updateCustomerProfile: (input) =>
      Effect.gen(function* updateCustomerProfileEffect() {
        const customerId = yield* createCustomerIdEffect(input.id);
        const customer = yield* requireCustomer(repository, customerId);
        const email = input.email
          ? normalizeEmail(input.email)
          : customer.email;
        yield* requireUniqueEmail(repository, email, customerId);

        return yield* repository.updateCustomer({
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
      }),
  };
};

export const createCustomerServiceLayer = (service: CustomerServiceShape) =>
  Layer.succeed(CustomerService, service);

/** Provides the customer repository from a concrete repository value. */
export const createCustomerRepositoryLayer = (repository: CustomerRepository) =>
  Layer.succeed(CustomerRepositoryService, repository);

/**
 * Builds `CustomerService` from Effect dependency services.
 *
 * Runtime roots use this Layer once repositories, clocks, and id generators are
 * supplied by platform or test composition.
 */
export const createCustomerServiceFromDependenciesLayer = (
  authorization?: CreateAuthorizationEvaluatorOptions
) =>
  Layer.effect(
    CustomerService,
    Effect.gen(function* customerServiceFromDependencies() {
      const clock = yield* ClockService;
      const idGenerator = yield* IdGeneratorService;
      const repository = yield* CustomerRepositoryService;

      return createCustomerService({
        authorization,
        clock,
        idGenerator,
        repository,
      });
    })
  );

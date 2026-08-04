import {
  RepositoryConflict,
  RepositoryDecodeFailure,
  RepositoryUnavailable,
} from "@ecommerce/core";
import {
  CreateCustomerAddressInputSchema,
  CreateCustomerGroupInputSchema,
  CreateCustomerInputSchema,
  CustomerAuthUserConflict,
  CustomerApiGroupSchema,
  CustomerApiListSchema,
  CustomerApiProfileSchema,
  CustomerEmailConflict,
  CustomerGroupAssignmentInputSchema,
  CustomerGroupNotFound,
  CustomerIdentifierSchema,
  CustomerInvalidIdentifier,
  CustomerNotFound,
  CustomerPaymentIdentitySchema,
  LinkCustomerAuthInputSchema,
  ResolveCustomerFromAuthInputSchema,
  UpdateCustomerProfileInputSchema,
} from "@ecommerce/customer";
import { Schema } from "effect";
import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from "effect/unstable/httpapi";

import {
  EffectHttpAuthMiddleware,
  EffectHttpExecutionMiddleware,
  EffectHttpForbidden,
  EffectHttpRequestContextMiddleware,
} from "./effect-http-middleware";
import { createApiSuccessSchema } from "./http-api-schemas";

const customerDomainErrors = [
  CustomerAuthUserConflict.pipe(HttpApiSchema.status(409)),
  CustomerEmailConflict.pipe(HttpApiSchema.status(409)),
  CustomerGroupNotFound.pipe(HttpApiSchema.status(404)),
  CustomerInvalidIdentifier.pipe(HttpApiSchema.status(400)),
  CustomerNotFound.pipe(HttpApiSchema.status(404)),
] as const;

const customerPersistenceErrors = [
  RepositoryConflict.pipe(HttpApiSchema.status(409)),
  RepositoryDecodeFailure.pipe(HttpApiSchema.status(503)),
  RepositoryUnavailable.pipe(HttpApiSchema.status(503)),
] as const;

export const customerReadErrors = [
  EffectHttpForbidden,
  ...customerDomainErrors,
  ...customerPersistenceErrors,
] as const;

export const customerWriteErrors = [
  EffectHttpForbidden,
  ...customerDomainErrors,
  ...customerPersistenceErrors,
] as const;

export const CustomerApiProfileSuccessSchema = createApiSuccessSchema(
  CustomerApiProfileSchema
);
export const CustomerApiNullableProfileSuccessSchema = createApiSuccessSchema(
  Schema.NullOr(CustomerApiProfileSchema)
);
export const CustomerApiListSuccessSchema = createApiSuccessSchema(
  CustomerApiListSchema
);
export const CustomerApiGroupSuccessSchema = createApiSuccessSchema(
  CustomerApiGroupSchema
);
export const CustomerPaymentIdentitySuccessSchema = createApiSuccessSchema(
  Schema.NullOr(CustomerPaymentIdentitySchema)
);

const customerAdminGroupIdentifier = "customerAdmin";

/** Customer admin Effect HTTP contract for commerce-management operations. */
export const customerAdminHttpApiGroup = HttpApiGroup.make(
  customerAdminGroupIdentifier
)
  .add(
    HttpApiEndpoint.post("customerCreate", "/admin/customers", {
      error: customerWriteErrors,
      payload: CreateCustomerInputSchema,
      success: CustomerApiProfileSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.post("customerGet", "/admin/customers/get", {
      error: customerReadErrors,
      payload: CustomerIdentifierSchema,
      success: CustomerApiNullableProfileSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.get("customerList", "/admin/customers", {
      error: customerReadErrors,
      success: CustomerApiListSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.patch("customerProfileUpdate", "/admin/customers", {
      error: customerWriteErrors,
      payload: UpdateCustomerProfileInputSchema,
      success: CustomerApiProfileSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.post("customerAddressCreate", "/admin/customer-addresses", {
      error: customerWriteErrors,
      payload: CreateCustomerAddressInputSchema,
      success: CustomerApiProfileSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.post("customerGroupCreate", "/admin/customer-groups", {
      error: customerWriteErrors,
      payload: CreateCustomerGroupInputSchema,
      success: CustomerApiGroupSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.post(
      "customerGroupAssign",
      "/admin/customer-groups/assign",
      {
        error: customerWriteErrors,
        payload: CustomerGroupAssignmentInputSchema,
        success: CustomerApiProfileSuccessSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post("customerAuthLink", "/admin/customers/auth-link", {
      error: customerWriteErrors,
      payload: LinkCustomerAuthInputSchema,
      success: CustomerApiProfileSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.post(
      "customerResolveFromAuth",
      "/admin/customers/resolve-auth",
      {
        error: customerReadErrors,
        payload: ResolveCustomerFromAuthInputSchema,
        success: CustomerApiNullableProfileSuccessSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post(
      "customerPaymentIdentityGet",
      "/admin/customers/payment-identity",
      {
        error: customerReadErrors,
        payload: CustomerIdentifierSchema,
        success: CustomerPaymentIdentitySuccessSchema,
      }
    )
  )
  .middleware(EffectHttpExecutionMiddleware)
  .middleware(EffectHttpAuthMiddleware)
  .middleware(EffectHttpRequestContextMiddleware);

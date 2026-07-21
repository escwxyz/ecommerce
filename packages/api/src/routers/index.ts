import type { CreateCheckoutRouteFragmentOptions } from "@ecommerce/checkout/router";
import { createCheckoutRouteFragment } from "@ecommerce/checkout/router";
import type { AdminMetadataModel } from "@ecommerce/core/admin";
import type { CreateFulfillmentRouteFragmentOptions } from "@ecommerce/fulfillment/router";
import { createFulfillmentRouteFragment } from "@ecommerce/fulfillment/router";
import type { CreateNotificationEventRouteFragmentOptions } from "@ecommerce/notification-event/router";
import { createNotificationEventRouteFragment } from "@ecommerce/notification-event/router";
import type { CreateOrderRouteFragmentOptions } from "@ecommerce/order/router";
import { createOrderRouteFragment } from "@ecommerce/order/router";
import type { CreatePaymentRouteFragmentOptions } from "@ecommerce/payment/router";
import { createPaymentRouteFragment } from "@ecommerce/payment/router";
import type { CreatePromotionRouteFragmentOptions } from "@ecommerce/promotion/router";
import { createPromotionRouteFragment } from "@ecommerce/promotion/router";
import type { CreateTaxRouteFragmentOptions } from "@ecommerce/tax/router";
import { createTaxRouteFragment } from "@ecommerce/tax/router";
import { z } from "zod";

import { createAdminMetadataModel } from "../admin-metadata";
import type { ApiRouteFragment } from "../assembly";
import { createApiRouteFragment } from "../assembly";
import {
  defineProtectedApiProcedure,
  definePublicApiProcedure,
} from "../procedures";

const HealthCheckOutputSchema = z.literal("OK");

const PrivateDataOutputSchema = z.object({
  message: z.literal("This is private"),
  user: z.unknown(),
});

const AdminPermissionDescriptorSchema = z.object({
  action: z.string(),
  key: z.custom<`${string}:${string}`>(
    (value) => typeof value === "string" && value.includes(":")
  ),
  resource: z.string(),
  scope: z.string().optional(),
});

const AdminMetadataSourceSchema = z.object({
  key: z.string(),
  label: z.string(),
  tier: z.enum(["native", "sandbox"]).optional(),
  type: z.enum(["module", "plugin"]),
});

const AdminOperationReferenceSchema = z.object({
  key: z.string(),
  label: z.string().optional(),
  permission: z
    .union([
      z.custom<`${string}:${string}`>(
        (value) => typeof value === "string" && value.includes(":")
      ),
      AdminPermissionDescriptorSchema,
    ])
    .optional(),
});

const AdminPrimitiveDescriptorSchema = z.object({
  key: z.string(),
  kind: z.string(),
  label: z.string().optional(),
  operation: AdminOperationReferenceSchema.optional(),
});

const AdminMetadataSurfaceSchema = z.object({
  description: z.string().optional(),
  id: z.string(),
  key: z.string(),
  kind: z.enum(["form", "navigation", "resource", "table", "widget"]),
  label: z.string(),
  operations: z.record(z.string(), AdminOperationReferenceSchema).optional(),
  order: z.number().optional(),
  path: z.string().optional(),
  permission: AdminPermissionDescriptorSchema.optional(),
  primitive: AdminPrimitiveDescriptorSchema.optional(),
  primitives: z.array(AdminPrimitiveDescriptorSchema).readonly(),
  source: AdminMetadataSourceSchema,
  title: z.string().optional(),
});

const AdminMetadataOutputSchema = z.object({
  sources: z.array(AdminMetadataSourceSchema).readonly(),
  surfaces: z.array(AdminMetadataSurfaceSchema).readonly(),
}) satisfies z.ZodType<AdminMetadataModel>;

export const coreRouteFragment = createApiRouteFragment({
  key: "builtin:core",
  owner: "builtin",
  router: {
    healthCheck: definePublicApiProcedure({
      input: z.unknown(),
      output: HealthCheckOutputSchema,
      route: {
        method: "GET",
        path: "/health",
        successDescription: "API health check returned.",
      },
    }).handler(() => "OK"),
    privateData: defineProtectedApiProcedure({
      input: z.unknown(),
      output: PrivateDataOutputSchema,
      route: {
        method: "GET",
        path: "/private-data",
        successDescription: "Private data returned.",
      },
    }).handler(({ context }) => ({
      message: "This is private",
      user: context.session?.user,
    })),
    adminMetadata: defineProtectedApiProcedure({
      input: z.unknown(),
      output: AdminMetadataOutputSchema,
      route: {
        method: "GET",
        path: "/admin/metadata",
        successDescription: "Admin metadata returned.",
      },
    }).handler(({ context }) => createAdminMetadataModel(context)),
  },
});

export interface CreateBuiltinRouteFragmentsOptions {
  readonly checkout?: CreateCheckoutRouteFragmentOptions;
  readonly fulfillment?: CreateFulfillmentRouteFragmentOptions;
  readonly notificationEvent?: CreateNotificationEventRouteFragmentOptions;
  readonly order?: CreateOrderRouteFragmentOptions;
  readonly payment?: CreatePaymentRouteFragmentOptions;
  readonly promotion?: CreatePromotionRouteFragmentOptions;
  readonly tax?: CreateTaxRouteFragmentOptions;
}

export const createBuiltinRouteFragments = ({
  checkout,
  fulfillment,
  notificationEvent,
  order,
  payment,
  promotion,
  tax,
}: CreateBuiltinRouteFragmentsOptions = {}) =>
  [
    coreRouteFragment,
    createApiRouteFragment({
      ...createNotificationEventRouteFragment(notificationEvent),
      owner: "module",
    }),
    createApiRouteFragment({
      ...createPromotionRouteFragment(promotion),
      owner: "module",
    }),
    createApiRouteFragment({
      ...createTaxRouteFragment(tax),
      owner: "module",
    }),
    createApiRouteFragment({
      ...createPaymentRouteFragment(payment),
      owner: "module",
    }),
    createApiRouteFragment({
      ...createFulfillmentRouteFragment(fulfillment),
      owner: "module",
    }),
    createApiRouteFragment({
      ...createOrderRouteFragment(order),
      owner: "module",
    }),
    createApiRouteFragment({
      ...createCheckoutRouteFragment(checkout),
      owner: "module",
    }),
  ] as const satisfies readonly ApiRouteFragment[];

export const builtinRouteFragments = createBuiltinRouteFragments();

import type { AdminMetadataModel } from "@ecommerce/core/admin";
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
}

export const createBuiltinRouteFragments = (
  _options: CreateBuiltinRouteFragmentsOptions = {}
) =>
  [coreRouteFragment] as const satisfies readonly ApiRouteFragment[];

export const builtinRouteFragments = createBuiltinRouteFragments();

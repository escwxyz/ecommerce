export interface DefineApiContractRouteOptions {
  readonly deprecated?: boolean;
  readonly description: string;
  readonly method: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
  readonly operationId: string;
  readonly path: `/${string}`;
  readonly successDescription: string;
  readonly summary: string;
  readonly tags?: readonly string[];
}

/**
 * Defines transport-neutral route metadata for module-owned Effect HTTP
 * contracts. This replaces the former oRPC contract wrapper so modules can
 * retain descriptive operation metadata without coupling to generated oRPC
 * routers or clients.
 */
export const defineApiContractRoute = ({
  tags = [],
  ...options
}: DefineApiContractRouteOptions) => ({
  ...options,
  tags: [...tags],
});

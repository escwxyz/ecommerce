import { oc } from "@orpc/contract";

const DEFAULT_STORE_TAGS = ["Store"] as const;

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

export const defineApiContractRoute = ({
  tags = DEFAULT_STORE_TAGS,
  ...options
}: DefineApiContractRouteOptions) =>
  oc.route({
    ...options,
    tags: [...tags],
  });

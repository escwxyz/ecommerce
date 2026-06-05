import { oc } from "@orpc/contract";

const DEFAULT_PRODUCT_TAGS = ["Products"] as const;

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
  tags = DEFAULT_PRODUCT_TAGS,
  ...options
}: DefineApiContractRouteOptions) =>
  oc.route({
    ...options,
    tags: [...tags],
  });

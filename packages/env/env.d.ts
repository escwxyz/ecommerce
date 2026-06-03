import { type server } from "@ecommerce/infra/alchemy.run";
import * as Cloudflare from "alchemy/Cloudflare";

// This file infers types for the cloudflare:workers environment from your Alchemy Worker.
// @see https://alchemy.run/concepts/bindings/#type-safe-bindings

export type CloudflareEnv = Cloudflare.InferEnv<typeof server>;

declare global {
  type Env = CloudflareEnv;
}

declare module "cloudflare:workers" {
  namespace Cloudflare {
    export interface Env extends CloudflareEnv {}
  }
}

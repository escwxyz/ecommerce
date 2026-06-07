import type { BetterAuthOptions } from "better-auth";
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";

import { createCommerceAuthAccessControl } from "./access-control";
import type { AuthPermissionStatement } from "./permissions";

type BetterAuthDatabase = NonNullable<BetterAuthOptions["database"]>;

export interface CreateAuthOptions {
  baseURL: string;
  database: BetterAuthDatabase;
  permissionStatement?: AuthPermissionStatement;
  secret: string;
  trustedOrigins: readonly string[];
}

export function createAuth({
  baseURL,
  database,
  permissionStatement,
  secret,
  trustedOrigins,
}: CreateAuthOptions) {
  const { commerceAccessControl, commerceAuthRoles } =
    createCommerceAuthAccessControl(permissionStatement);

  return betterAuth({
    advanced: {
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "none",
        secure: true,
      },
      // uncomment crossSubDomainCookies setting when ready to deploy and replace <your-workers-subdomain> with your actual workers subdomain
      // https://developers.cloudflare.com/workers/wrangler/configuration/#workersdev
      // crossSubDomainCookies: {
      //   enabled: true,
      //   domain: "<your-workers-subdomain>",
      // },
    },
    baseURL,
    database,
    emailAndPassword: {
      enabled: true,
    },
    plugins: [
      admin({
        ac: commerceAccessControl,
        roles: commerceAuthRoles,
      }),
    ],
    // uncomment cookieCache setting when ready to deploy to Cloudflare using *.workers.dev domains
    // session: {
    //   cookieCache: {
    //     enabled: true,
    //     maxAge: 60,
    //   },
    // },
    secret,
    trustedOrigins: [...trustedOrigins],
  });
}

export type AuthService = ReturnType<typeof createAuth>;

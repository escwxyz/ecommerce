import { DatabaseSync } from "node:sqlite";

import { createAuth } from "./factory";
import type { AuthService } from "./factory";

/**
 * Better Auth CLI schema generation needs a real local SQLite adapter. Runtime
 * code must continue to call createAuth with the Worker-provided D1 binding.
 */
export const auth: AuthService = createAuth({
  baseURL: "http://localhost:3000",
  database: new DatabaseSync(":memory:"),
  secret: "better-auth-cli-schema-generation-secret",
  trustedOrigins: ["http://localhost:3000"],
});

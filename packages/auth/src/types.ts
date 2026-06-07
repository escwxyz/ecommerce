import type { AuthService } from "./factory";

export type AuthSession = Awaited<ReturnType<AuthService["api"]["getSession"]>>;

export type AuthUser = NonNullable<AuthSession>["user"];

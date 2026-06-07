import type {
  ColumnType,
  Insertable,
  Kysely,
  Migration,
  Selectable,
} from "kysely";

export const authUserTableName = "user" as const;
export const authSessionTableName = "session" as const;
export const authAccountTableName = "account" as const;
export const authVerificationTableName = "verification" as const;

export const authSessionUserIdIndexName = "session_userId_idx" as const;
export const authAccountUserIdIndexName = "account_userId_idx" as const;
export const authVerificationIdentifierIndexName =
  "verification_identifier_idx" as const;

type BooleanColumn = ColumnType<boolean, boolean | number, boolean | number>;
type DateColumn = ColumnType<Date, Date | string, Date | string>;

/**
 * Better Auth user table including the admin plugin fields.
 *
 * Column names intentionally follow Better Auth's default camelCase database
 * names because the runtime Better Auth adapter is not configured with custom
 * field mappings.
 */
export interface AuthUserTable {
  banExpires: DateColumn | null;
  banReason: string | null;
  banned: BooleanColumn | null;
  createdAt: DateColumn;
  email: string;
  emailVerified: BooleanColumn;
  id: string;
  image: string | null;
  name: string;
  role: string | null;
  updatedAt: DateColumn;
}

export interface AuthSessionTable {
  createdAt: DateColumn;
  expiresAt: DateColumn;
  id: string;
  impersonatedBy: string | null;
  ipAddress: string | null;
  token: string;
  updatedAt: DateColumn;
  userAgent: string | null;
  userId: string;
}

export interface AuthAccountTable {
  accessToken: string | null;
  accessTokenExpiresAt: DateColumn | null;
  accountId: string;
  createdAt: DateColumn;
  id: string;
  idToken: string | null;
  password: string | null;
  providerId: string;
  refreshToken: string | null;
  refreshTokenExpiresAt: DateColumn | null;
  scope: string | null;
  updatedAt: DateColumn;
  userId: string;
}

export interface AuthVerificationTable {
  createdAt: DateColumn;
  expiresAt: DateColumn;
  id: string;
  identifier: string;
  updatedAt: DateColumn;
  value: string;
}

export interface AuthDatabase {
  account: AuthAccountTable;
  session: AuthSessionTable;
  user: AuthUserTable;
  verification: AuthVerificationTable;
}

export const authSchema = {
  account: authAccountTableName,
  session: authSessionTableName,
  user: authUserTableName,
  verification: authVerificationTableName,
} as const;

export type AuthUserRow = Selectable<AuthUserTable>;
export type AuthUserInsert = Insertable<AuthUserTable>;
export type AuthSessionRow = Selectable<AuthSessionTable>;
export type AuthSessionInsert = Insertable<AuthSessionTable>;
export type AuthAccountRow = Selectable<AuthAccountTable>;
export type AuthAccountInsert = Insertable<AuthAccountTable>;
export type AuthVerificationRow = Selectable<AuthVerificationTable>;
export type AuthVerificationInsert = Insertable<AuthVerificationTable>;
export type AuthDatabaseSchema = AuthDatabase;
export type AuthSchemaKey = keyof AuthDatabase;

export const authMigration: Migration = {
  down: async (db: Kysely<unknown>) => {
    await db.schema.dropTable(authVerificationTableName).ifExists().execute();
    await db.schema.dropTable(authAccountTableName).ifExists().execute();
    await db.schema.dropTable(authSessionTableName).ifExists().execute();
    await db.schema.dropTable(authUserTableName).ifExists().execute();
  },
  up: async (db: Kysely<unknown>) => {
    await db.schema
      .createTable(authUserTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey().notNull())
      .addColumn("name", "text", (column) => column.notNull())
      .addColumn("email", "text", (column) => column.notNull().unique())
      .addColumn("emailVerified", "integer", (column) => column.notNull())
      .addColumn("image", "text")
      .addColumn("createdAt", "date", (column) => column.notNull())
      .addColumn("updatedAt", "date", (column) => column.notNull())
      .addColumn("role", "text")
      .addColumn("banned", "integer")
      .addColumn("banReason", "text")
      .addColumn("banExpires", "date")
      .execute();

    await db.schema
      .createTable(authSessionTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey().notNull())
      .addColumn("expiresAt", "date", (column) => column.notNull())
      .addColumn("token", "text", (column) => column.notNull().unique())
      .addColumn("createdAt", "date", (column) => column.notNull())
      .addColumn("updatedAt", "date", (column) => column.notNull())
      .addColumn("ipAddress", "text")
      .addColumn("userAgent", "text")
      .addColumn("userId", "text", (column) =>
        column
          .notNull()
          .references(`${authUserTableName}.id`)
          .onDelete("cascade")
      )
      .addColumn("impersonatedBy", "text")
      .execute();

    await db.schema
      .createIndex(authSessionUserIdIndexName)
      .ifNotExists()
      .on(authSessionTableName)
      .column("userId")
      .execute();

    await db.schema
      .createTable(authAccountTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey().notNull())
      .addColumn("accountId", "text", (column) => column.notNull())
      .addColumn("providerId", "text", (column) => column.notNull())
      .addColumn("userId", "text", (column) =>
        column
          .notNull()
          .references(`${authUserTableName}.id`)
          .onDelete("cascade")
      )
      .addColumn("accessToken", "text")
      .addColumn("refreshToken", "text")
      .addColumn("idToken", "text")
      .addColumn("accessTokenExpiresAt", "date")
      .addColumn("refreshTokenExpiresAt", "date")
      .addColumn("scope", "text")
      .addColumn("password", "text")
      .addColumn("createdAt", "date", (column) => column.notNull())
      .addColumn("updatedAt", "date", (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex(authAccountUserIdIndexName)
      .ifNotExists()
      .on(authAccountTableName)
      .column("userId")
      .execute();

    await db.schema
      .createTable(authVerificationTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey().notNull())
      .addColumn("identifier", "text", (column) => column.notNull())
      .addColumn("value", "text", (column) => column.notNull())
      .addColumn("expiresAt", "date", (column) => column.notNull())
      .addColumn("createdAt", "date", (column) => column.notNull())
      .addColumn("updatedAt", "date", (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex(authVerificationIdentifierIndexName)
      .ifNotExists()
      .on(authVerificationTableName)
      .column("identifier")
      .execute();
  },
};

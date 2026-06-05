import { sql } from "kysely";

export const currentTimestampMs = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

export const sqliteTimestampColumnType = "integer" as const;

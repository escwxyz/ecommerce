import type { DevelopmentSeedValue, DevelopmentSeedWrite } from "./fixtures";

const quoteIdentifier = (identifier: string): string =>
  `"${identifier.replaceAll('"', '""')}"`;

const serializeValue = (value: DevelopmentSeedValue): string => {
  if (value === null) {
    return "NULL";
  }

  if (typeof value === "number") {
    return String(value);
  }

  return `'${value.replaceAll("'", "''")}'`;
};

const createUpsertStatement = ({
  conflictColumns,
  row,
  table,
}: DevelopmentSeedWrite): string => {
  const columns = Object.keys(row);
  const updateColumns = columns.filter(
    (column) => !conflictColumns.includes(column)
  );
  const conflictTarget = conflictColumns.map(quoteIdentifier).join(", ");
  const conflictAction =
    updateColumns.length === 0
      ? "DO NOTHING"
      : `DO UPDATE SET ${updateColumns
          .map(
            (column) =>
              `${quoteIdentifier(column)} = excluded.${quoteIdentifier(column)}`
          )
          .join(", ")}`;

  return `INSERT INTO ${quoteIdentifier(table)} (${columns
    .map(quoteIdentifier)
    .join(", ")}) VALUES (${columns
    .map((column) => serializeValue(row[column] ?? null))
    .join(", ")}) ON CONFLICT (${conflictTarget}) ${conflictAction};`;
};

export const generateSeedSql = (
  writes: readonly DevelopmentSeedWrite[]
): string =>
  [
    "BEGIN TRANSACTION;",
    ...writes.map(createUpsertStatement),
    "COMMIT;",
    "",
  ].join("\n");

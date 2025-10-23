import { logDB } from "./db";

interface LogTableInfo {
  qualifiedName: string;
  schema: string | null;
}

const LOG_TABLE_NAME = "logs";

let cachedInfo: LogTableInfo | null = null;

const preferredSchemaOrder = ["public", "app_log", "app_avatar"];

const quoteIdentifier = (identifier: string): string =>
  `"${identifier.replace(/"/g, '""')}"`;

const buildQualifiedName = (schema: string | null): string => {
  if (!schema) {
    return quoteIdentifier(LOG_TABLE_NAME);
  }
  return `${quoteIdentifier(schema)}.${quoteIdentifier(LOG_TABLE_NAME)}`;
};

const fetchCandidateSchemas = async (): Promise<string[]> => {
  const rows = await logDB.rawQueryAll<{ table_schema: string }>(
    `
      SELECT table_schema
      FROM information_schema.tables
      WHERE table_name = $1
      ORDER BY
        CASE
          WHEN table_schema = $2 THEN 0
          WHEN table_schema = $3 THEN 1
          WHEN table_schema = $4 THEN 2
          ELSE 3
        END,
        table_schema
    `,
    LOG_TABLE_NAME,
    preferredSchemaOrder[0],
    preferredSchemaOrder[1],
    preferredSchemaOrder[2]
  );

  const seen = new Set<string>();
  const schemas: string[] = [];
  for (const row of rows) {
    if (!seen.has(row.table_schema)) {
      seen.add(row.table_schema);
      schemas.push(row.table_schema);
    }
  }

  return schemas;
};

const schemaHasRows = async (qualifiedName: string): Promise<boolean> => {
  const result = await logDB.rawQueryRow<{ has_rows: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM ${qualifiedName} LIMIT 1) AS has_rows`
  );

  return Boolean(result?.has_rows);
};

export async function getLogTableInfo(): Promise<LogTableInfo> {
  if (cachedInfo) {
    return cachedInfo;
  }

  try {
    const schemas = await fetchCandidateSchemas();

    for (const schema of schemas) {
      const qualifiedName = buildQualifiedName(schema);
      try {
        if (await schemaHasRows(qualifiedName)) {
          cachedInfo = { qualifiedName, schema };
          return cachedInfo;
        }
      } catch (error) {
        console.warn(
          `[log] Failed to inspect table ${qualifiedName}:`,
          error instanceof Error ? error.message : error
        );
      }
    }

    if (schemas.length > 0) {
      const schema = schemas[0];
      cachedInfo = {
        qualifiedName: buildQualifiedName(schema),
        schema,
      };
      return cachedInfo;
    }
  } catch (error) {
    console.warn(
      "[log] Unable to resolve logs table dynamically:",
      error instanceof Error ? error.message : error
    );
  }

  cachedInfo = {
    qualifiedName: buildQualifiedName(null),
    schema: null,
  };
  return cachedInfo;
}

export async function listAvailableLogSchemas(): Promise<string[]> {
  const rows = await logDB.rawQueryAll<{ table_schema: string }>(
    `
      SELECT table_schema
      FROM information_schema.tables
      WHERE table_name = $1
      ORDER BY table_schema
    `,
    LOG_TABLE_NAME
  );

  return rows.map((row) => row.table_schema);
}

export function resetLogTableCache(): void {
  cachedInfo = null;
}

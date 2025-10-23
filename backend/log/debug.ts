import { api } from "encore.dev/api";
import { logDB } from "./db";
import { getLogTableInfo, listAvailableLogSchemas } from "./table-resolver";

interface DebugResponse {
  tableExists: boolean;
  rowCount: number;
  sampleRows: any[];
  error?: string;
  databaseName?: string;
  availableSchemas?: string[];
  resolvedTable?: string;
}

// Debug endpoint to check database state
export const debug = api<void, DebugResponse>(
  { expose: true, method: "GET", path: "/log/debug", auth: false },
  async () => {
    try {
      const dbNameRow = await logDB.rawQueryRow<{ current_database: string }>(
        `SELECT current_database() AS current_database`
      );
      const databaseName = dbNameRow?.current_database ?? "unknown";

      const schemas = await listAvailableLogSchemas();
      const tableExists = schemas.length > 0;

      if (!tableExists) {
        return {
          tableExists: false,
          rowCount: 0,
          sampleRows: [],
          databaseName,
          availableSchemas: schemas,
          error: "No logs table found in any schema",
        };
      }

      const { qualifiedName: logTable } = await getLogTableInfo();

      const countRow = await logDB.rawQueryRow<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM ${logTable}`
      );
      const rowCount = parseInt(countRow?.count ?? "0", 10);

      const sampleRows = await logDB.rawQueryAll(
        `
          SELECT id,
                 source,
                 timestamp,
                 LEFT(request::text, 100)  AS request_preview,
                 LEFT(response::text, 100) AS response_preview
          FROM ${logTable}
          ORDER BY timestamp DESC
          LIMIT 5
        `
      );

      return {
        tableExists: true,
        rowCount,
        sampleRows,
        databaseName,
        availableSchemas: schemas,
        resolvedTable: logTable,
      };
    } catch (error: any) {
      return {
        tableExists: false,
        rowCount: 0,
        sampleRows: [],
        error: error?.message ?? String(error),
      };
    }
  }
);

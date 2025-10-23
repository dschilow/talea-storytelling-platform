import { api } from "encore.dev/api";
import { logDB } from "./db";

interface DebugResponse {
  tableExists: boolean;
  rowCount: number;
  sampleRows: any[];
  error?: string;
  allTables?: string[];
  databaseName?: string;
}

// Debug endpoint to check database state
export const debug = api<void, DebugResponse>(
  { expose: true, method: "GET", path: "/log/debug", auth: false },
  async () => {
    try {
      // Get current database name
      const dbNameResult = await logDB.query<{ current_database: string }>`
        SELECT current_database()
      `;
      const databaseName = dbNameResult[0]?.current_database || "unknown";

      // Get all tables in the database
      const allTablesResult = await logDB.query<{ tablename: string }>`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      `;
      const allTablesArray = Array.isArray(allTablesResult) ? allTablesResult : Array.from(allTablesResult);
      const allTables = allTablesArray.map(row => row.tablename);

      // Check if table exists
      const tableCheck = await logDB.query<{ exists: boolean }>`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'logs' AND table_schema = 'public'
        ) as exists
      `;

      const tableExists = tableCheck[0]?.exists || false;

      if (!tableExists) {
        return {
          tableExists: false,
          rowCount: 0,
          sampleRows: [],
          allTables,
          databaseName,
          error: "Table 'logs' does not exist in public schema"
        };
      }

      // Get row count
      const countResult = await logDB.query<{ count: string }>`
        SELECT COUNT(*)::text as count FROM logs
      `;
      const rowCount = parseInt(countResult[0]?.count || "0", 10);

      // Get sample rows
      const sampleRows = await logDB.query`
        SELECT id, source, timestamp,
               LEFT(request::text, 100) as request_preview,
               LEFT(response::text, 100) as response_preview
        FROM logs
        ORDER BY timestamp DESC
        LIMIT 5
      `;

      return {
        tableExists: true,
        rowCount,
        sampleRows,
        allTables,
        databaseName,
      };
    } catch (error: any) {
      return {
        tableExists: false,
        rowCount: 0,
        sampleRows: [],
        error: error.message
      };
    }
  }
);

import { api } from "encore.dev/api";
import { logDB } from "./db";

interface DebugResponse {
  tableExists: boolean;
  rowCount: number;
  sampleRows: any[];
  error?: string;
}

// Debug endpoint to check database state
export const debug = api<void, DebugResponse>(
  { expose: true, method: "GET", path: "/log/debug", auth: false },
  async () => {
    try {
      // Check if table exists
      const tableCheck = await logDB.query<{ exists: boolean }>`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'logs'
        ) as exists
      `;

      const tableExists = tableCheck[0]?.exists || false;

      if (!tableExists) {
        return {
          tableExists: false,
          rowCount: 0,
          sampleRows: [],
          error: "Table 'logs' does not exist"
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

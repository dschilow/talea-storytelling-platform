import { api } from "encore.dev/api";
import { logDB } from "./db";

interface LogSource {
  name: string;
  count: number;
  lastActivity: Date | null;
}

interface GetLogSourcesResponse {
  sources: LogSource[];
}

// Gets available log sources with statistics from PostgreSQL.
export const getSources = api<void, GetLogSourcesResponse>(
  { expose: true, method: "GET", path: "/log/getSources" },
  async () => {
    try {
      // Query database for source statistics
      const rows = await logDB.query<{
        source: string;
        count: number;
        last_activity: Date | null;
      }>`
        SELECT
          source,
          COUNT(*)::int as count,
          MAX(timestamp) as last_activity
        FROM logs
        GROUP BY source
        ORDER BY last_activity DESC NULLS LAST
      `;

      // Convert query result to array (Encore returns iterator)
      const rowsArray = Array.isArray(rows) ? rows : Array.from(rows);

      const sources: LogSource[] = rowsArray.map(row => ({
        name: row.source,
        count: row.count,
        lastActivity: row.last_activity
      }));

      return { sources };
    } catch (error) {
      console.error("Error getting log sources:", error);
      return { sources: [] };
    }
  }
);

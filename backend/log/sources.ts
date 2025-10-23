import { api } from "encore.dev/api";
import { logDB } from "./db";
import { getLogTableInfo } from "./table-resolver";

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
      console.log("[log/getSources] Fetching sources...");

      const { qualifiedName: logTable } = await getLogTableInfo();

      const rows = await logDB.rawQueryAll<{
        source: string;
        count: number;
        last_activity: Date | null;
      }>(
        `
          SELECT
            source,
            COUNT(*)::int AS count,
            MAX(timestamp) AS last_activity
          FROM ${logTable}
          GROUP BY source
          ORDER BY last_activity DESC NULLS LAST
        `
      );

      console.log(`[log/getSources] Query returned ${rows.length} sources`);

      const sources: LogSource[] = rows.map((row) => ({
        name: row.source,
        count: row.count,
        lastActivity: row.last_activity,
      }));

      return { sources };
    } catch (error) {
      console.error("[log/getSources] Error getting log sources:", error);
      return { sources: [] };
    }
  }
);

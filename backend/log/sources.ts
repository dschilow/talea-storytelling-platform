import { api } from "encore.dev/api";
import { logBucket } from "./logger";

interface LogSource {
  name: string;
  count: number;
  lastActivity: Date | null;
}

interface GetLogSourcesResponse {
  sources: LogSource[];
}

// Gets available log sources with statistics.
export const getSources = api<void, GetLogSourcesResponse>(
  { expose: true, method: "GET", path: "/logs/sources" },
  async () => {
    const sourceCounts = new Map<string, { count: number; lastActivity: Date | null }>();

    try {
      for await (const entry of logBucket.list({})) {
        const pathParts = entry.name.split('/');
        if (pathParts.length >= 2) {
          const source = pathParts[0];
          const current = sourceCounts.get(source) || { count: 0, lastActivity: null };
          
          // Extract timestamp from filename for last activity
          const filename = pathParts[pathParts.length - 1];
          const timestampMatch = filename.match(/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z)/);
          if (timestampMatch) {
            const timestamp = new Date(timestampMatch[1].replace(/-/g, ':'));
            if (!current.lastActivity || timestamp > current.lastActivity) {
              current.lastActivity = timestamp;
            }
          }
          
          current.count++;
          sourceCounts.set(source, current);
        }
      }

      const sources: LogSource[] = Array.from(sourceCounts.entries()).map(([name, data]) => ({
        name,
        count: data.count,
        lastActivity: data.lastActivity,
      }));

      // Sort by count (descending)
      sources.sort((a, b) => b.count - a.count);

      return { sources };
    } catch (error) {
      console.error("Error getting log sources:", error);
      return { sources: [] };
    }
  }
);

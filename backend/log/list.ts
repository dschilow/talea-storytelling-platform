import { api } from "encore.dev/api";
import { logBucket } from "./logger";

export interface LogEntry {
  id: string;
  source: 'openai-story-generation' | 'runware-single-image' | 'runware-batch-image' | 'openai-avatar-analysis';
  timestamp: Date;
  request: any;
  response: any;
  metadata?: any;
}

interface ListLogsRequest {
  source?: string;
  limit?: number;
  date?: string; // YYYY-MM-DD format
}

interface ListLogsResponse {
  logs: LogEntry[];
  totalCount: number;
}

// Lists log entries from the bucket.
export const list = api<ListLogsRequest, ListLogsResponse>(
  { expose: true, method: "GET", path: "/logs" },
  async (req) => {
    const logs: LogEntry[] = [];
    const limit = req.limit || 100;
    const sourceFilter = req.source;
    const dateFilter = req.date;

    try {
      const prefixes: string[] = [];
      if (sourceFilter) {
        let prefix = `${sourceFilter}/`;
        if (dateFilter) {
          prefix += `${dateFilter}/`;
        }
        prefixes.push(prefix);
      } else if (dateFilter) {
        const allSources = ['openai-story-generation', 'runware-single-image', 'runware-batch-image', 'openai-avatar-analysis'];
        for (const source of allSources) {
          prefixes.push(`${source}/${dateFilter}/`);
        }
      }

      const logEntries: { name: string }[] = [];
      if (prefixes.length > 0) {
        for (const prefix of prefixes) {
          for await (const entry of logBucket.list({ prefix })) {
            logEntries.push(entry);
          }
        }
      } else {
        // No filters, list everything (this will be slow)
        for await (const entry of logBucket.list({})) {
          logEntries.push(entry);
        }
      }

      // Sort by name descending to get newest first, as name contains timestamp
      logEntries.sort((a, b) => b.name.localeCompare(a.name));

      // Download only the limited number of logs
      for (const entry of logEntries.slice(0, limit)) {
        try {
          const logData = await logBucket.download(entry.name);
          const logEntry = JSON.parse(logData.toString('utf-8')) as LogEntry;
          logs.push(logEntry);
        } catch (err) {
          console.warn(`Failed to parse log entry ${entry.name}:`, err);
        }
      }

      // Final sort by actual timestamp, as filename sort is an approximation
      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return {
        logs,
        totalCount: logEntries.length,
      };
    } catch (error) {
      console.error("Error listing logs:", error);
      return {
        logs: [],
        totalCount: 0,
      };
    }
  }
);

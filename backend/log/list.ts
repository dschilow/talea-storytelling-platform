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
      let count = 0;
      for await (const entry of logBucket.list({})) {
        if (count >= limit) break;

        // Apply source filter
        if (sourceFilter) {
          const pathParts = entry.name.split('/');
          if (pathParts.length < 2 || pathParts[0] !== sourceFilter) {
            continue;
          }
        }

        // Apply date filter
        if (dateFilter) {
          const pathParts = entry.name.split('/');
          if (pathParts.length < 2 || pathParts[1] !== dateFilter) {
            continue;
          }
        }

        try {
          const logData = await logBucket.download(entry.name);
          const logEntry = JSON.parse(logData.toString('utf-8')) as LogEntry;
          logs.push(logEntry);
          count++;
        } catch (err) {
          console.warn(`Failed to parse log entry ${entry.name}:`, err);
        }
      }

      // Sort by timestamp (newest first)
      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return {
        logs,
        totalCount: logs.length,
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

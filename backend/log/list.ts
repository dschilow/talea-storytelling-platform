import { api } from "encore.dev/api";
import { logBucket } from "./logger";

export interface LogEntry {
  id: string;
  source: 'openai-story-generation' | 'runware-single-image' | 'runware-batch-image' | 'openai-avatar-analysis' | 'openai-avatar-analysis-stable' | 'openai-doku-generation' | 'openai-tavi-chat';
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

const ALL_SOURCES = [
  'openai-story-generation',
  'runware-single-image',
  'runware-batch-image',
  'openai-avatar-analysis',
  'openai-avatar-analysis-stable',
  'openai-doku-generation',
  'openai-tavi-chat',
];

// Lists log entries from the bucket.
export const list = api<ListLogsRequest, ListLogsResponse>(
  { expose: true, method: "GET", path: "/log/list" },
  async (req) => {
    const limit = req.limit || 50;
    const sourceFilter = req.source;
    const dateFilter = req.date;

    try {
      const logNames: string[] = [];

      if (dateFilter) {
        // Efficiently list for a specific date
        const sources = sourceFilter ? [sourceFilter] : ALL_SOURCES;
        for (const source of sources) {
          const prefix = `${source}/${dateFilter}/`.replace(/\//g, '\\');
          for await (const entry of logBucket.list({ prefix })) {
            logNames.push(entry.name);
          }
        }
      } else {
        // No date filter, scan recent days to find latest logs.
        const sources = sourceFilter ? [sourceFilter] : ALL_SOURCES;
        const datesToScan: string[] = [];
        for (let i = 0; i < 7; i++) { // Scan last 7 days
            const d = new Date();
            d.setDate(d.getDate() - i);
            datesToScan.push(d.toISOString().split('T')[0]);
        }

        for (const date of datesToScan) {
            for (const source of sources) {
                const prefix = `${source}/${date}/`.replace(/\//g, '\\');
                for await (const entry of logBucket.list({ prefix })) {
                    logNames.push(entry.name);
                }
            }
            // Optimization: if we have enough logs after scanning a day, we can stop.
            if (logNames.length >= limit) break;
        }
      }

      // Sort by name descending to get newest first, as name contains sortable timestamp.
      logNames.sort((a, b) => b.localeCompare(a));

      const logsToDownload = logNames.slice(0, limit);
      const logs: LogEntry[] = [];

      // Use Promise.all for concurrent downloads
      await Promise.all(logsToDownload.map(async (name) => {
        try {
          const logData = await logBucket.download(name);
          logs.push(JSON.parse(logData.toString('utf-8')) as LogEntry);
        } catch (err) {
          console.warn(`Failed to parse log entry ${name}:`, err);
        }
      }));

      // Final sort by actual timestamp, as filename sort is an approximation
      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return {
        logs,
        totalCount: logNames.length,
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

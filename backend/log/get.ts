import { api, APIError } from "encore.dev/api";
import { logBucket } from "./logger";
import type { LogEntry } from "./list";

interface GetLogRequest {
  id: string;
}

// Retrieves a specific log entry by ID.
export const get = api<GetLogRequest, LogEntry>(
  { expose: true, method: "GET", path: "/logs/:id" },
  async ({ id }) => {
    try {
      // Search for the log entry by ID across all paths
      for await (const entry of logBucket.list({})) {
        if (entry.name.includes(id)) {
          try {
            const logData = await logBucket.download(entry.name);
            const logEntry = JSON.parse(logData.toString('utf-8')) as LogEntry;
            if (logEntry.id === id) {
              return logEntry;
            }
          } catch (err) {
            console.warn(`Failed to parse log entry ${entry.name}:`, err);
          }
        }
      }

      throw APIError.notFound(`Log entry with ID ${id} not found`);
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      console.error("Error retrieving log:", error);
      throw APIError.internal("Failed to retrieve log entry");
    }
  }
);

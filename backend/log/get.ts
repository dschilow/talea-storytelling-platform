import { api, APIError } from "encore.dev/api";
import { logDB, type LogRow } from "./db";
import type { LogEntry } from "./list";
import { getLogTableInfo } from "./table-resolver";

interface GetLogRequest {
  id: string;
}

// Retrieves a specific log entry by ID from the database.
export const get = api<GetLogRequest, LogEntry>(
  { expose: true, method: "GET", path: "/log/get/:id" },
  async ({ id }) => {
    try {
      const { qualifiedName: logTable } = await getLogTableInfo();
      const row = await logDB.rawQueryRow<LogRow>(
        `
          SELECT id, source, timestamp, request, response, metadata
          FROM ${logTable}
          WHERE id = $1
          LIMIT 1
        `,
        id
      );

      if (!row) {
        throw APIError.notFound(`Log entry with ID ${id} not found`);
      }

      return {
        id: row.id,
        source: row.source as any,
        timestamp: row.timestamp,
        request: row.request,
        response: row.response,
        metadata: row.metadata,
      };
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      console.error("Error retrieving log:", error);
      throw APIError.internal("Failed to retrieve log entry");
    }
  }
);

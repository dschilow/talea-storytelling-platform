import { api, APIError } from "encore.dev/api";
import { avatarDB } from "../avatar/db";
import type { LogRow } from "./db";
import type { LogEntry } from "./list";

interface GetLogRequest {
  id: string;
}

// Retrieves a specific log entry by ID from the database.
export const get = api<GetLogRequest, LogEntry>(
  { expose: true, method: "GET", path: "/log/get/:id" },
  async ({ id }) => {
    try {
      const rows = await avatarDB.query<LogRow>`
        SELECT id, source, timestamp, request, response, metadata
        FROM logs
        WHERE id = ${id}
        LIMIT 1
      `;

      if (rows.length === 0) {
        throw APIError.notFound(`Log entry with ID ${id} not found`);
      }

      const row = rows[0];
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

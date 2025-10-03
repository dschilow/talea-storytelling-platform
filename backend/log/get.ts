import { api, APIError } from "encore.dev/api";
import type { LogEntry } from "./list";

interface GetLogRequest {
  id: string;
}

// Retrieves a specific log entry by ID (disabled - object storage removed).
export const get = api<GetLogRequest, LogEntry>(
  { expose: true, method: "GET", path: "/log/get/:id" },
  async ({ id }) => {
    throw APIError.notFound("Log storage disabled for Railway deployment");
  }
);

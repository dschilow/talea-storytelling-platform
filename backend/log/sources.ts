import { api } from "encore.dev/api";

interface LogSource {
  name: string;
  count: number;
  lastActivity: Date | null;
}

interface GetLogSourcesResponse {
  sources: LogSource[];
}

// Gets available log sources (disabled - object storage removed for Railway).
export const getSources = api<void, GetLogSourcesResponse>(
  { expose: true, method: "GET", path: "/log/getSources" },
  async () => {
    return { sources: [] };
  }
);

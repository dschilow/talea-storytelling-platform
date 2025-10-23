import { api } from "encore.dev/api";
import { avatarDB } from "../avatar/db";
import type { LogRow } from "./db";

export interface LogEntry {
  id: string;
  source: 'openai-story-generation' | 'runware-single-image' | 'runware-batch-image' | 'openai-avatar-analysis' | 'openai-avatar-analysis-stable' | 'openai-doku-generation' | 'openai-tavi-chat' | 'openai-story-generation-mcp';
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

// Lists log entries from the database.
export const list = api<ListLogsRequest, ListLogsResponse>(
  { expose: true, method: "GET", path: "/log/list" },
  async (req) => {
    const limit = req.limit || 50;
    const sourceFilter = req.source;
    const dateFilter = req.date;

    try {
      console.log(`📊 [log/list] Fetching logs with limit=${limit}, source=${sourceFilter}, date=${dateFilter}`);

      let query = `
        SELECT id, source, timestamp, request, response, metadata
        FROM logs
        WHERE 1=1
      `;
      const params: any[] = [];

      // Add source filter if provided
      if (sourceFilter) {
        params.push(sourceFilter);
        query += ` AND source = $${params.length}`;
      }

      // Add date filter if provided
      if (dateFilter) {
        params.push(dateFilter);
        query += ` AND DATE(timestamp) = $${params.length}`;
      }

      // Order by timestamp descending (newest first)
      query += ` ORDER BY timestamp DESC`;

      // Limit results
      params.push(limit);
      query += ` LIMIT $${params.length}`;

      console.log(`📊 [log/list] Query: ${query.replace(/\s+/g, ' ').trim()}`);
      console.log(`📊 [log/list] Params:`, params);

      const rows = await avatarDB.query<LogRow>(query, ...params);

      // Convert query result to array (Encore returns iterator)
      const rowsArray = Array.isArray(rows) ? rows : Array.from(rows);

      console.log(`📊 [log/list] Query returned ${rowsArray.length} rows`);
      if (rowsArray.length > 0) {
        console.log(`📊 [log/list] First row:`, { id: rowsArray[0].id, source: rowsArray[0].source });
      }

      const logs: LogEntry[] = rowsArray.map(row => ({
        id: row.id,
        source: row.source as any,
        timestamp: row.timestamp,
        request: row.request,
        response: row.response,
        metadata: row.metadata,
      }));

      // Get total count for the same filters (without limit)
      let countQuery = `
        SELECT COUNT(*) as count
        FROM logs
        WHERE 1=1
      `;
      const countParams: any[] = [];

      if (sourceFilter) {
        countParams.push(sourceFilter);
        countQuery += ` AND source = $${countParams.length}`;
      }

      if (dateFilter) {
        countParams.push(dateFilter);
        countQuery += ` AND DATE(timestamp) = $${countParams.length}`;
      }

      const countResult = await avatarDB.query<{ count: number }>(countQuery, ...countParams);
      const countArray = Array.isArray(countResult) ? countResult : Array.from(countResult);
      const totalCount = countArray[0]?.count || 0;

      console.log(`📊 [log/list] Total count: ${totalCount}`);

      return {
        logs,
        totalCount: Number(totalCount),
      };
    } catch (error) {
      console.error("❌ [log/list] Error listing logs:", error);
      return {
        logs: [],
        totalCount: 0,
      };
    }
  }
);

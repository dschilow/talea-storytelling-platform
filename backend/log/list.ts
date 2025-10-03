import { api } from "encore.dev/api";

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

// Lists log entries (disabled - object storage removed for Railway).
export const list = api<ListLogsRequest, ListLogsResponse>(
  { expose: true, method: "GET", path: "/log/list" },
  async (req) => {
    return {
      logs: [],
      totalCount: 0,
    };
  }
);

// Type definitions for log database operations
// All log operations use avatarDB directly since there's only one PostgreSQL instance in Railway

export interface LogRow {
  id: string;
  source: string;
  timestamp: Date;
  request: any;
  response: any;
  metadata?: any;
  created_at: Date;
}

// Re-export avatarDB for log operations
export { avatarDB as logDB } from "../avatar/db";

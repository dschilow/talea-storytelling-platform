// Use avatarDB for logs to share the same PostgreSQL instance in Railway
// The logs table is created via avatar/migrations/7_create_logs.up.sql
import { avatarDB } from "../avatar/db";

// Export avatarDB as logDB for backward compatibility
export const logDB = avatarDB;

export interface LogRow {
  id: string;
  source: string;
  timestamp: Date;
  request: any;
  response: any;
  metadata?: any;
  created_at: Date;
}

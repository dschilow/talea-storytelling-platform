// Re-export avatarDB as logDB to use the same database instance
// This fixes the issue where logDB was pointing to a separate database
// that doesn't exist in Railway (only one PostgreSQL instance)
import { avatarDB } from "../avatar/db";

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

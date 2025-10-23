// This file only exports types now.
// All log operations use avatarDB directly from ../avatar/db
// The logs table is created via avatar/migrations/7_create_logs.up.sql

export interface LogRow {
  id: string;
  source: string;
  timestamp: Date;
  request: any;
  response: any;
  metadata?: any;
  created_at: Date;
}

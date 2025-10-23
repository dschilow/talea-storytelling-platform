import { SQLDatabase } from "encore.dev/storage/sqldb";

// Database for storing logs
// Note: Using "avatar" database name to share the same PostgreSQL instance in Railway
// All Encore databases map to the same Railway PostgreSQL service
export const logDB = new SQLDatabase("avatar", {
  migrations: "./migrations",
});

export interface LogRow {
  id: string;
  source: string;
  timestamp: Date;
  request: any;
  response: any;
  metadata?: any;
  created_at: Date;
}

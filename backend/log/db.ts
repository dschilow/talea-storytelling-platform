import { SQLDatabase } from "encore.dev/storage/sqldb";

// Use the main "railway" database where all tables exist
// This matches the single PostgreSQL instance in Railway
export const logDB = new SQLDatabase("railway", {
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

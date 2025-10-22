import { SQLDatabase } from "encore.dev/storage/sqldb";

// Database for storing logs
export const logDB = new SQLDatabase("log", {
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

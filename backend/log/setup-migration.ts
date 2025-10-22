// Manual migration endpoint for creating logs table on Railway
import { api } from "encore.dev/api";
import { logDB } from "./db";

interface MigrationResponse {
  success: boolean;
  message: string;
}

// Endpoint to manually run the logs table migration
export const runMigration = api<void, MigrationResponse>(
  { expose: true, method: "POST", path: "/log/run-migration", auth: false },
  async () => {
    console.log("🔧 Running logs table migration...");

    try {
      // Create logs table
      await logDB.exec`
        CREATE TABLE IF NOT EXISTS logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          source TEXT NOT NULL,
          timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          request JSONB NOT NULL,
          response JSONB NOT NULL,
          metadata JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `;
      console.log("✅ logs table created");

      // Create indices
      await logDB.exec`
        CREATE INDEX IF NOT EXISTS idx_logs_source_timestamp ON logs(source, timestamp DESC);
      `;
      console.log("✅ idx_logs_source_timestamp created");

      await logDB.exec`
        CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp DESC);
      `;
      console.log("✅ idx_logs_timestamp created");

      console.log("🎉 Migration completed successfully!");

      return {
        success: true,
        message: "Logs table migration completed successfully"
      };
    } catch (error: any) {
      console.error("❌ Migration failed:", error.message);
      return {
        success: false,
        message: `Migration failed: ${error.message}`
      };
    }
  }
);

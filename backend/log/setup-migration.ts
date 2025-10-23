// Manual migration endpoint for creating logs table on Railway
import { api } from "encore.dev/api";
import { avatarDB } from "../avatar/db";

interface MigrationResponse {
  success: boolean;
  message: string;
  details?: string;
}

// Endpoint to manually run the logs table migration
export const runMigration = api<void, MigrationResponse>(
  { expose: true, method: "POST", path: "/log/run-migration", auth: false },
  async () => {
    console.log("🔧 Running logs table migration...");
    const steps: string[] = [];

    try {
      // Create logs table
      await avatarDB.exec`
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
      steps.push("logs table created");

      // Create indices
      await avatarDB.exec`
        CREATE INDEX IF NOT EXISTS idx_logs_source_timestamp ON logs(source, timestamp DESC);
      `;
      console.log("✅ idx_logs_source_timestamp created");
      steps.push("idx_logs_source_timestamp created");

      await avatarDB.exec`
        CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp DESC);
      `;
      console.log("✅ idx_logs_timestamp created");
      steps.push("idx_logs_timestamp created");

      // Verify table was created
      const verifyResult = await avatarDB.query<{ exists: boolean }>`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'logs'
        ) as exists
      `;
      const tableExists = verifyResult[0]?.exists || false;
      steps.push(`Table verification: ${tableExists ? 'SUCCESS' : 'FAILED'}`);

      console.log("🎉 Migration completed successfully!");

      return {
        success: true,
        message: "Logs table migration completed successfully",
        details: steps.join(', ')
      };
    } catch (error: any) {
      console.error("❌ Migration failed:", error.message);
      console.error("Stack:", error.stack);
      return {
        success: false,
        message: `Migration failed: ${error.message}`,
        details: `Steps completed: ${steps.join(', ')}`
      };
    }
  }
);

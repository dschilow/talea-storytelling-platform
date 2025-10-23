// Manual migration endpoint for creating logs table on Railway
import { api } from "encore.dev/api";
import { logDB } from "./db";
import { listAvailableLogSchemas, resetLogTableCache } from "./table-resolver";

interface MigrationResponse {
  success: boolean;
  message: string;
  details?: string;
}

const PUBLIC_LOG_TABLE = `"public"."logs"`;

// Endpoint to manually run the logs table migration
export const runMigration = api<void, MigrationResponse>(
  { expose: true, method: "POST", path: "/log/run-migration", auth: false },
  async () => {
    console.log("[log/run-migration] Running logs table migration...");
    const steps: string[] = [];

    try {
      // Create logs table under the public schema so legacy data remains visible.
      await logDB.rawExec(
        `
          CREATE TABLE IF NOT EXISTS ${PUBLIC_LOG_TABLE} (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            source TEXT NOT NULL,
            timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            request JSONB NOT NULL,
            response JSONB NOT NULL,
            metadata JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `
      );
      console.log("[log/run-migration] logs table created/verified");
      steps.push("logs table created");

      // Create indices to keep queries fast.
      await logDB.rawExec(
        `
          CREATE INDEX IF NOT EXISTS idx_logs_source_timestamp
          ON ${PUBLIC_LOG_TABLE}(source, timestamp DESC)
        `
      );
      console.log("[log/run-migration] idx_logs_source_timestamp created/verified");
      steps.push("idx_logs_source_timestamp created");

      await logDB.rawExec(
        `
          CREATE INDEX IF NOT EXISTS idx_logs_timestamp
          ON ${PUBLIC_LOG_TABLE}(timestamp DESC)
        `
      );
      console.log("[log/run-migration] idx_logs_timestamp created/verified");
      steps.push("idx_logs_timestamp created");

      resetLogTableCache();
      const schemas = await listAvailableLogSchemas();
      steps.push(`Available schemas: ${schemas.join(", ") || "none"}`);

      console.log("[log/run-migration] Migration completed successfully");

      return {
        success: true,
        message: "Logs table migration completed successfully",
        details: steps.join("; "),
      };
    } catch (error: any) {
      console.error("[log/run-migration] Migration failed:", error?.message ?? error);
      return {
        success: false,
        message: `Migration failed: ${error?.message ?? error}`,
        details: `Steps completed: ${steps.join("; ")}`,
      };
    }
  }
);

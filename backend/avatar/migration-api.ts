import { api } from "encore.dev/api";
import { avatarDB } from "./db";

interface RunMigrationRequest {
    migrationSql: string;
    migrationName: string;
}

interface RunMigrationResponse {
    success: boolean;
    message: string;
    error?: string;
}

/**
 * Runs a raw SQL migration on the avatar database.
 * This is a utility endpoint for manual migrations on Railway.
 * 
 * SECURITY NOTE: This should be protected in production!
 */
export const runMigrationSql = api<RunMigrationRequest, RunMigrationResponse>(
    { expose: true, method: "POST", path: "/avatar/run-migration-sql", auth: false },
    async (req) => {
        console.log(`🔄 Running migration: ${req.migrationName}`);

        try {
            // Split SQL into individual statements and execute them
            const statements = req.migrationSql
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0);

            // Execute each statement using Encore's DB client
            const pool = (avatarDB as any).pool;
            if (!pool) {
                throw new Error('Database pool not available');
            }

            for (const statement of statements) {
                await pool.query(statement);
            }

            console.log(`✅ Migration ${req.migrationName} completed successfully`);

            return {
                success: true,
                message: `Migration ${req.migrationName} executed successfully`
            };
        } catch (error: any) {
            console.error(`❌ Migration ${req.migrationName} failed:`, error);

            return {
                success: false,
                message: `Migration ${req.migrationName} failed`,
                error: error.message || String(error)
            };
        }
    }
);

/**
 * Checks the current state of the avatars table
 */
export const checkAvatarSchema = api(
    { expose: true, method: "GET", path: "/avatar/check-schema", auth: false },
    async () => {
        try {
            const columnsResult = await avatarDB.queryAll<{ column_name: string; data_type: string; column_default: string | null }>`
        SELECT column_name, data_type, column_default
        FROM information_schema.columns
        WHERE table_name = 'avatars'
        ORDER BY ordinal_position
      `;

            return {
                success: true,
                columns: columnsResult
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message || String(error)
            };
        }
    }
);

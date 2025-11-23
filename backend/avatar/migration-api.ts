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
            console.log(`[Migration SQL] SQL length: ${req.migrationSql.length} characters`);

            // Split SQL into individual statements
            // Remove comments first, then split by semicolons
            const sqlWithoutComments = req.migrationSql
                .split('\n')
                .filter(line => !line.trim().startsWith('--'))
                .join('\n');

            const statements = sqlWithoutComments
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0);

            console.log(`[Migration SQL] Found ${statements.length} SQL statements to execute`);

            // Execute each statement separately using Encore's exec method
            let executedCount = 0;
            for (let i = 0; i < statements.length; i++) {
                const statement = statements[i];
                if (statement.length === 0) continue;

                try {
                    await avatarDB.exec(statement);
                    executedCount++;

                    // Log progress every 10 statements
                    if ((i + 1) % 10 === 0) {
                        console.log(`[Migration SQL] Progress: ${i + 1}/${statements.length} statements executed`);
                    }
                } catch (stmtErr: any) {
                    // Check if it's a duplicate key error - that's OK
                    if (stmtErr.message && stmtErr.message.includes("duplicate key")) {
                        console.log(`[Migration SQL] Statement ${i + 1}: Duplicate entry (skipping)`);
                        executedCount++;
                        continue;
                    }
                    // Otherwise, log but continue
                    console.error(`[Migration SQL] Statement ${i + 1} failed:`, stmtErr.message);
                }
            }

            console.log(`✅ Migration ${req.migrationName} completed successfully`);
            console.log(`[Migration SQL] Executed ${executedCount}/${statements.length} statements successfully`);

            return {
                success: true,
                message: `Migration ${req.migrationName} executed ${executedCount}/${statements.length} statements successfully`
            };
        } catch (error: any) {
            console.error(`❌ Migration ${req.migrationName} failed:`, error);

            // Check if it's a duplicate key error
            if (error.message && error.message.includes("duplicate key")) {
                return {
                    success: true,
                    message: `Migration ${req.migrationName} - some records already exist (skipped duplicates)`
                };
            }

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

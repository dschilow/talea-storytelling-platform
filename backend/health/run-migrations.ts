import { api, APIError } from "encore.dev/api";
import { storyDB } from "../story/db";
import { avatarDB } from "../avatar/db";
import { fairytalesDB } from "../fairytales/db";
import { userDB } from "../user/db";
import fs from "fs";
import path from "path";
import { compareMigrationFiles, splitMigrationStatements } from "./migration-order";

export interface MigrationResponse {
  success: boolean;
  message: string;
  migrationsRun: string[];
  errors: string[];
}

function isExpectedIdempotencyError(error: unknown): boolean {
  const candidate = error as { code?: string; message?: string };
  if (["42P07", "42701", "23505"].includes(candidate?.code || "")) return true;
  const message = String(candidate?.message || "").toLowerCase();
  return (
    message.includes("already exists") ||
    message.includes("duplicate column") ||
    message.includes("duplicate key")
  );
}

/**
 * Runs every numbered `.up.sql` migration file (user, avatar, story, fairy
 * tales) idempotently against the respective service database. This is the
 * canonical way schema changes reach Railway prod: the container does NOT run
 * Encore auto-migrations, so /health invokes this once per process boot.
 */
export async function runAllNumberedMigrationFiles(): Promise<MigrationResponse> {
  {
    const migrationsRun: string[] = [];
    const errors: string[] = [];

    console.log("🔄 Starting numbered migration file run...");

    try {
      // Helper function to run SQL file
      const runSqlFile = async (filePath: string, db: any) => {
        try {
          const sql = fs.readFileSync(filePath, "utf-8");
          
          // Preserve PostgreSQL dollar blocks and statements preceded by comments.
          const statements = splitMigrationStatements(sql);

          for (const statement of statements) {
            if (statement.length > 0) {
              try {
                await db.exec(statement + ";");
              } catch (stmtErr: any) {
                if (isExpectedIdempotencyError(stmtErr)) {
                  console.log(`  Migration statement already applied: ${String(stmtErr.message).substring(0, 100)}`);
                  continue;
                }
                // A real statement failure means the migration file did not run.
                // Propagate it so the endpoint cannot report a false success.
                throw stmtErr;

              }
            }
          }
          
          migrationsRun.push(filePath);
          console.log(`✅ Success: ${filePath}`);
        } catch (err: any) {
          const errorMsg = `Failed ${filePath}: ${err.message}`;
          errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      };

      // Get base path
      const basePath = process.cwd();

      // 1. User migrations run against the dedicated user service database.
      console.log("👤 Running user migrations...");
      const userMigrationsPath = path.join(basePath, "user", "migrations");
      if (fs.existsSync(userMigrationsPath)) {
        const userFiles = fs
          .readdirSync(userMigrationsPath)
          .filter((f) => f.endsWith(".up.sql"))
          .sort(compareMigrationFiles);
        for (const file of userFiles) {
          await runSqlFile(path.join(userMigrationsPath, file), userDB);
        }
      }

      // 2. Avatar migrations
      console.log("🎭 Running avatar migrations...");
      const avatarMigrationsPath = path.join(basePath, "avatar", "migrations");
      if (fs.existsSync(avatarMigrationsPath)) {
        const avatarFiles = fs
          .readdirSync(avatarMigrationsPath)
          .filter((f) => f.endsWith(".up.sql"))
          .sort(compareMigrationFiles);
        for (const file of avatarFiles) {
          await runSqlFile(path.join(avatarMigrationsPath, file), avatarDB);
        }
      }

      // 3. Story migrations
      console.log("📖 Running story migrations...");
      const storyMigrationsPath = path.join(basePath, "story", "migrations");
      if (fs.existsSync(storyMigrationsPath)) {
        const storyFiles = fs
          .readdirSync(storyMigrationsPath)
          .filter((f) => f.endsWith(".up.sql"))
          .sort(compareMigrationFiles);
        for (const file of storyFiles) {
          await runSqlFile(path.join(storyMigrationsPath, file), storyDB);
        }
      }

      // 4. Fairy Tales migrations - WICHTIG!
      console.log("✨ Running fairy tales migrations...");
      const fairytalesMigrationsPath = path.join(
        basePath,
        "fairytales",
        "migrations"
      );
      if (fs.existsSync(fairytalesMigrationsPath)) {
        const fairytalesFiles = fs
          .readdirSync(fairytalesMigrationsPath)
          .filter((f) => f.endsWith(".up.sql"))
          .sort(compareMigrationFiles);
        for (const file of fairytalesFiles) {
          await runSqlFile(
            path.join(fairytalesMigrationsPath, file),
            fairytalesDB
          );
        }
      }

      console.log(
        `✅ Migrations completed: ${migrationsRun.length} successful, ${errors.length} failed`
      );

      return {
        success: errors.length === 0,
        message:
          errors.length === 0
            ? `Successfully ran ${migrationsRun.length} migrations`
            : `Ran ${migrationsRun.length} migrations with ${errors.length} errors`,
        migrationsRun,
        errors,
      };
    } catch (err: any) {
      console.error("❌ Migration failed:", err);
      throw APIError.internal(`Migration failed: ${err.message}`);
    }
  }
}

/**
 * Manual migration trigger endpoint
 * Call this URL to create all database tables
 * URL: POST /health/run-migrations
 */
export const runMigrations = api(
  { expose: false, method: "POST", path: "/health/run-migrations", auth: false },
  async (): Promise<MigrationResponse> => runAllNumberedMigrationFiles()
);

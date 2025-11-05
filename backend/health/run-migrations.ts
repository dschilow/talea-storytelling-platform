import { api, APIError } from "encore.dev/api";
import { storyDB } from "../story/db";
import { avatarDB } from "../avatar/db";
import { fairytalesDB } from "../fairytales/db";
import fs from "fs";
import path from "path";

export interface MigrationResponse {
  success: boolean;
  message: string;
  migrationsRun: string[];
  errors: string[];
}

/**
 * Manual migration trigger endpoint
 * Call this URL to create all database tables
 * URL: POST /health/run-migrations
 */
export const runMigrations = api(
  { expose: true, method: "POST", path: "/health/run-migrations", auth: false },
  async (): Promise<MigrationResponse> => {
    const migrationsRun: string[] = [];
    const errors: string[] = [];

    console.log("🔄 Starting manual migrations...");

    try {
      // Helper function to run SQL file
      const runSqlFile = async (filePath: string, db: any) => {
        try {
          const sql = fs.readFileSync(filePath, "utf-8");
          
          // Split SQL file into individual statements and execute them
          const statements = sql
            .split(";")
            .map((s) => s.trim())
            .filter((s) => s.length > 0 && !s.startsWith("--"));

          for (const statement of statements) {
            if (statement.length > 0) {
              try {
                await db.exec(statement + ";");
              } catch (stmtErr: any) {
                // Log but continue - some statements might already exist
                console.log(`  ⚠️  Statement warning: ${stmtErr.message.substring(0, 100)}`);
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

      // 1. User migrations (use avatarDB since user doesn't have separate DB)
      console.log("👤 Running user migrations...");
      const userMigrationsPath = path.join(basePath, "user", "migrations");
      if (fs.existsSync(userMigrationsPath)) {
        const userFiles = fs
          .readdirSync(userMigrationsPath)
          .filter((f) => f.endsWith(".up.sql"))
          .sort();
        for (const file of userFiles) {
          await runSqlFile(path.join(userMigrationsPath, file), avatarDB);
        }
      }

      // 2. Avatar migrations
      console.log("🎭 Running avatar migrations...");
      const avatarMigrationsPath = path.join(basePath, "avatar", "migrations");
      if (fs.existsSync(avatarMigrationsPath)) {
        const avatarFiles = fs
          .readdirSync(avatarMigrationsPath)
          .filter((f) => f.endsWith(".up.sql"))
          .sort();
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
          .sort();
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
          .sort();
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
);

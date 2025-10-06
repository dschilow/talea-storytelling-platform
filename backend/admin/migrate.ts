import { api } from "encore.dev/api";
import fs from "fs";
import path from "path";

// Import database instances from their respective modules
import { avatarDB } from "../avatar/db";
import { dokuDB } from "../doku/db";
import { userDB } from "../user/profile";
import { personalityDB } from "../ai/personality-tracker";
import { storyDB } from "../story/generate";

interface MigrateResponse {
  success: boolean;
  message: string;
  details: string[];
}

// Run all database migrations
export const migrate = api(
  { expose: true, method: "POST", path: "/admin/migrate", auth: true },
  async (): Promise<MigrateResponse> => {
    const details: string[] = [];

    try {
      details.push("🔄 Starting database migrations...");

      const databases = [
        { name: "avatar", db: avatarDB },
        { name: "doku", db: dokuDB },
        { name: "story", db: storyDB },
        { name: "user", db: userDB },
        { name: "personality_tracking", db: personalityDB },
      ];

      for (const { name, db } of databases) {
        details.push(`\n📦 Migrating ${name} database...`);

        const migrationsDir = path.join(process.cwd(), name, "migrations");

        if (!fs.existsSync(migrationsDir)) {
          details.push(`⚠️ No migrations found for ${name}`);
          continue;
        }

        const files = fs
          .readdirSync(migrationsDir)
          .filter((f) => f.endsWith(".up.sql"))
          .sort();

        for (const file of files) {
          const sql = fs.readFileSync(
            path.join(migrationsDir, file),
            "utf-8"
          );

          try {
            await db.exec(sql);
            details.push(`✅ ${name}: ${file}`);
          } catch (error: any) {
            if (error.message?.includes("already exists")) {
              details.push(`⏭️ ${name}: ${file} (already applied)`);
            } else {
              throw error;
            }
          }
        }
      }

      details.push("\n✅ All migrations completed successfully!");

      return {
        success: true,
        message: "Migrations completed",
        details,
      };
    } catch (error: any) {
      details.push(`\n❌ Migration failed: ${error.message}`);

      return {
        success: false,
        message: error.message,
        details,
      };
    }
  }
);

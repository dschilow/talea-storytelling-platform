import { SQLDatabase } from "encore.dev/storage/sqldb";
import fs from "fs";
import path from "path";

// Function to run all migrations
async function runMigrations() {
  console.log("🔄 Starting database migrations...");

  const databases = [
    { name: "avatar", db: SQLDatabase.named("avatar") },
    { name: "doku", db: SQLDatabase.named("doku") },
    { name: "story", db: SQLDatabase.named("story") },
    { name: "user", db: SQLDatabase.named("user") },
    { name: "personality_tracking", db: SQLDatabase.named("personality_tracking") },
  ];

  for (const { name, db } of databases) {
    console.log(`\n📦 Running migrations for ${name} database...`);

    const migrationsDir = path.join(__dirname, name, "migrations");

    if (!fs.existsSync(migrationsDir)) {
      console.log(`⚠️  No migrations directory found for ${name}`);
      continue;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.up.sql'))
      .sort();

    for (const file of files) {
      console.log(`  ├─ Running ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

      try {
        await db.exec(sql);
        console.log(`  ✅ ${file} completed`);
      } catch (error: any) {
        // Ignore "already exists" errors
        if (error.message.includes('already exists')) {
          console.log(`  ⏭️  ${file} skipped (already applied)`);
        } else {
          console.error(`  ❌ ${file} failed:`, error.message);
          throw error;
        }
      }
    }
  }

  console.log("\n✅ All migrations completed!");
}

// Run migrations on module load (only in production)
if (process.env.NODE_ENV === 'production' || process.env.RUN_MIGRATIONS === 'true') {
  runMigrations().catch(err => {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  });
}

export { runMigrations };

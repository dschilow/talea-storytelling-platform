// Run this with: bun run migrate-railway.ts
import { readFileSync } from 'fs';

const DATABASE_URL = 'postgresql://postgres:HqJVXXiJiVtiCOJuOmEatCjuTEULvpjr@switchback.proxy.rlwy.net:38603/railway';

async function runMigrations() {
  console.log('🔄 Connecting to Railway PostgreSQL...');

  try {
    // Import pg dynamically
    const pg = await import('pg');
    const { Client } = pg.default;

    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    console.log('✅ Connected to database');

    // Read and execute migrations
    const sql = readFileSync('./all-migrations.sql', 'utf-8');
    console.log('\n📦 Running all migrations...\n');

    await client.query(sql);

    console.log('\n✅ All migrations completed successfully!');

    // Verify tables were created
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('\n📋 Tables created:');
    result.rows.forEach((row: any) => {
      console.log(`  ✓ ${row.table_name}`);
    });

    await client.end();
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    if (error.message.includes('already exists')) {
      console.log('\n⚠️  Some tables already exist - this is OK if you ran migrations before');
    }
    process.exit(1);
  }
}

runMigrations();

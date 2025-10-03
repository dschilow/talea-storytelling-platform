import pg from 'pg';
import fs from 'fs';

const { Client } = pg;

// PostgreSQL connection details (from Railway)
const connectionString = 'postgresql://postgres:HqJVXXiJiVtiCOJuOmEatCjuTEULvpjr@postgres.railway.internal:5432/railway';

async function runMigrations() {
  console.log('🔄 Connecting to PostgreSQL...');

  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Read the SQL file
    const sql = fs.readFileSync('./all-migrations.sql', 'utf-8');

    console.log('📦 Running migrations...');
    await client.query(sql);

    console.log('✅ All migrations completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();

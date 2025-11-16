#!/usr/bin/env node

/**
 * Manual migration runner for Railway PostgreSQL
 * Executes fairy tale migrations 10-13 directly
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Railway PostgreSQL connection (fairytales database)
const DATABASE_URL = "postgresql://postgres:HqJVXXiJiVtiCOJuOmEatCjuTEULvpjr@autorack.proxy.rlwy.net:42832/railway";

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: false
});

async function checkCurrentState() {
  console.log('📊 Checking current database state...\n');

  try {
    // Check fairy_tales count
    const talesResult = await pool.query('SELECT COUNT(*) FROM fairy_tales');
    console.log(`✓ Current fairy tales: ${talesResult.rows[0].count}`);

    // Check which migrations have run
    const migrationsResult = await pool.query(`
      SELECT migration_version
      FROM schema_migrations
      WHERE service_name = 'fairytales'
      ORDER BY migration_version
    `);

    console.log(`✓ Completed migrations:`);
    migrationsResult.rows.forEach(row => {
      console.log(`  - ${row.migration_version}`);
    });

    return parseInt(talesResult.rows[0].count);
  } catch (error) {
    console.error('❌ Error checking state:', error.message);
    throw error;
  }
}

async function runMigration(migrationNumber, name) {
  console.log(`\n🔄 Running Migration ${migrationNumber}: ${name}...`);

  const migrationFile = path.join(
    __dirname,
    'backend',
    'fairytales',
    'migrations',
    `${migrationNumber}_${name}.up.sql`
  );

  if (!fs.existsSync(migrationFile)) {
    console.log(`⚠️  Migration file not found: ${migrationFile}`);
    return false;
  }

  const sql = fs.readFileSync(migrationFile, 'utf8');

  try {
    await pool.query(sql);

    // Record migration in schema_migrations table
    await pool.query(`
      INSERT INTO schema_migrations (service_name, migration_version, applied_at)
      VALUES ('fairytales', $1, NOW())
      ON CONFLICT (service_name, migration_version) DO NOTHING
    `, [migrationNumber]);

    console.log(`✅ Migration ${migrationNumber} completed successfully`);
    return true;
  } catch (error) {
    console.error(`❌ Error running migration ${migrationNumber}:`, error.message);
    console.error('SQL Error:', error.detail || error.hint || '');
    return false;
  }
}

async function main() {
  console.log('🚀 Talea Fairy Tales Migration Runner\n');
  console.log('Connected to:', DATABASE_URL.replace(/:[^:]*@/, ':****@'), '\n');

  try {
    // Check current state
    const currentCount = await checkCurrentState();

    if (currentCount >= 50) {
      console.log('\n✅ Database already has 50+ fairy tales. No migrations needed.');
      await pool.end();
      return;
    }

    console.log(`\n📝 Need to add ${50 - currentCount} more tales to reach 50 total.\n`);

    // Run migrations 10-13
    const migrations = [
      [10, 'add_47_classic_fairy_tales'],
      [11, 'add_andersen_fairy_tales'],
      [12, 'add_russian_arabian_fairy_tales'],
      [13, 'add_classics_legends_fables']
    ];

    let successCount = 0;

    for (const [number, name] of migrations) {
      const success = await runMigration(number, name);
      if (success) successCount++;
    }

    console.log(`\n📊 Final Results:`);
    console.log(`  Migrations executed: ${successCount}/${migrations.length}`);

    // Check final count
    const finalResult = await pool.query('SELECT COUNT(*) FROM fairy_tales');
    const finalCount = parseInt(finalResult.rows[0].count);

    console.log(`  Final fairy tale count: ${finalCount}`);

    if (finalCount === 50) {
      console.log('\n🎉 SUCCESS! Database now has exactly 50 fairy tales!');
    } else if (finalCount > 50) {
      console.log('\n⚠️  Warning: Database has more than 50 tales (possible duplicates)');
    } else {
      console.log(`\n⚠️  Warning: Only ${finalCount} tales found (expected 50)`);
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

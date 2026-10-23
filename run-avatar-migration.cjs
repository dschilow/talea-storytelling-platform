#!/usr/bin/env node

/**
 * Manual migration runner for Railway PostgreSQL
 * Executes avatar migration 8 (add inventory and skills columns)
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Railway PostgreSQL connection (avatar database)
// Using credentials from Railway environment variables
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set (use the Railway DATABASE_PUBLIC_URL).");
  process.exit(1);
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: false
});

async function checkCurrentState() {
    console.log('📊 Checking current database state...\n');

    try {
        // Check if columns already exist
        const columnsResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'avatars' 
      AND column_name IN ('inventory', 'skills')
    `);

        console.log(`✓ Existing inventory/skills columns: ${columnsResult.rows.length}`);

        if (columnsResult.rows.length > 0) {
            console.log('  Found columns:');
            columnsResult.rows.forEach(row => {
                console.log(`    - ${row.column_name}`);
            });
        }

        // Check avatar count
        const avatarResult = await pool.query('SELECT COUNT(*) FROM avatars');
        console.log(`✓ Current avatars: ${avatarResult.rows[0].count}`);

        // Check which migrations have run
        const migrationsResult = await pool.query(`
      SELECT migration_version
      FROM schema_migrations
      WHERE service_name = 'avatar'
      ORDER BY migration_version
    `);

        console.log(`✓ Completed avatar migrations:`);
        migrationsResult.rows.forEach(row => {
            console.log(`  - ${row.migration_version}`);
        });

        return columnsResult.rows.length;
    } catch (error) {
        console.error('❌ Error checking state:', error.message);
        throw error;
    }
}

async function runMigration() {
    console.log('\n🔄 Running Migration 8: add_inventory_and_skills...');

    const migrationFile = path.join(
        __dirname,
        'backend',
        'avatar',
        'migrations',
        '8_add_inventory_and_skills.up.sql'
    );

    if (!fs.existsSync(migrationFile)) {
        console.log(`⚠️  Migration file not found: ${migrationFile}`);
        return false;
    }

    const sql = fs.readFileSync(migrationFile, 'utf8');
    console.log('\n📄 SQL to execute:');
    console.log(sql);

    try {
        await pool.query(sql);

        // Record migration in schema_migrations table
        await pool.query(`
      INSERT INTO schema_migrations (service_name, migration_version, applied_at)
      VALUES ('avatar', '8', NOW())
      ON CONFLICT (service_name, migration_version) DO NOTHING
    `);

        console.log(`✅ Migration 8 completed successfully`);
        return true;
    } catch (error) {
        console.error(`❌ Error running migration 8:`, error.message);
        console.error('SQL Error:', error.detail || error.hint || '');
        return false;
    }
}

async function main() {
    console.log('🚀 Talea Avatar Migration Runner\n');
    console.log('Connected to:', DATABASE_URL.replace(/:[^:]*@/, ':****@'), '\n');

    try {
        // Check current state
        const existingColumns = await checkCurrentState();

        if (existingColumns >= 2) {
            console.log('\n✅ Migration already applied. Columns "inventory" and "skills" already exist.');
            await pool.end();
            return;
        }

        console.log(`\n📝 Need to add inventory and skills columns.\n`);

        // Run migration 8
        const success = await runMigration();

        console.log(`\n📊 Final Results:`);
        console.log(`  Migration executed: ${success ? 'YES' : 'NO'}`);

        // Check final state
        const finalResult = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'avatars' 
      AND column_name IN ('inventory', 'skills')
    `);

        console.log(`  Final columns added: ${finalResult.rows.length}`);
        finalResult.rows.forEach(row => {
            console.log(`    - ${row.column_name} (${row.data_type}, default: ${row.column_default})`);
        });

        if (finalResult.rows.length === 2) {
            console.log('\n🎉 SUCCESS! Migration completed. Inventory and skills columns added!');
        } else {
            console.log(`\n⚠️  Warning: Only ${finalResult.rows.length} columns found (expected 2)`);
        }

    } catch (error) {
        console.error('\n❌ Fatal error:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();

#!/usr/bin/env bun
/**
 * Script to manually run user database migrations via API
 * Used when migration files aren't copied to Railway Docker container
 */

import * as fs from 'fs';
import * as path from 'path';

const BACKEND_URL = 'https://backend-2-production-3de1.up.railway.app';
const MIGRATIONS_DIR = './backend/user/migrations';

async function runMigration(migrationFile: string, sql: string): Promise<boolean> {
  console.log(`🔄 Running ${migrationFile}...`);

  try {
    const response = await fetch(`${BACKEND_URL}/user/run-migration-sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql }),
    });

    const result = await response.json();

    if (result.success) {
      console.log(`  ✅ ${migrationFile} completed successfully (${result.statementsExecuted} statements)`);
      return true;
    } else {
      console.error(`  ❌ ${migrationFile} failed: ${result.message}`);
      return false;
    }
  } catch (error: any) {
    console.error(`  ❌ ${migrationFile} failed:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Talea User Migrations Runner (API Mode)\n');

  // Get all .up.sql files
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.up.sql'))
    .sort();

  if (files.length === 0) {
    console.log('⚠️  No migration files found in', MIGRATIONS_DIR);
    return;
  }

  console.log(`📁 Found ${files.length} migration file(s):\n`);

  let successCount = 0;
  let failCount = 0;

  for (const file of files) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    const success = await runMigration(file, sql);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log('\n📊 Final Results:');
  console.log(`  Migrations executed: ${successCount}/${files.length}`);
  if (failCount > 0) {
    console.log(`  Failed: ${failCount}`);
  }

  if (successCount === files.length) {
    console.log('\n🎉 SUCCESS! All migrations completed!');
  } else {
    console.log('\n⚠️  Some migrations failed. Check the logs above.');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});

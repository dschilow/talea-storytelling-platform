#!/usr/bin/env node
// Manual Migration Runner for Migration 14 (Role Matching Requirements)
// Executes SQL migration via Railway API endpoint

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const RAILWAY_API_URL = 'https://backend-2-production-3de1.up.railway.app';

async function runMigration() {
  console.log('🚀 Running Migration 14: Role Matching Requirements');
  console.log('');

  // Read migration SQL file
  const migrationPath = join(__dirname, 'backend', 'fairytales', 'migrations', '14_add_role_matching_requirements.up.sql');
  const sql = readFileSync(migrationPath, 'utf-8');

  console.log(`📄 Loaded migration file (${sql.length} characters)`);
  console.log('');

  try {
    // Execute migration via API
    console.log('🔄 Executing migration on Railway...');
    const response = await fetch(`${RAILWAY_API_URL}/fairytales/run-migration-sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        migrationName: '14_add_role_matching_requirements',
        sql: sql,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('Result:', JSON.stringify(result, null, 2));
    console.log('');
    console.log('🎉 Database schema updated with role matching requirements!');
    console.log('   - species_requirement column added');
    console.log('   - gender_requirement column added');
    console.log('   - age_requirement column added');
    console.log('   - size_requirement column added');
    console.log('   - social_class_requirement column added');
    console.log('');
    console.log('✅ Story generation should now work correctly!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('');
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

runMigration();

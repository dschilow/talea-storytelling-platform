const fs = require('fs');

console.log('🎭 Running Migration 14...\n');

const migrationPath = 'backend/fairytales/migrations/14_add_role_matching_requirements.up.sql';
const sqlContent = fs.readFileSync(migrationPath, 'utf8');

const API_BASE = 'https://backend-2-production-3de1.up.railway.app';

async function runMigration() {
  try {
    console.log('📤 Sending migration to API...');

    const response = await fetch(`${API_BASE}/fairytales/run-migration-sql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sql: sqlContent,
        migrationName: '14_add_role_matching_requirements'
      })
    });

    const result = await response.json();

    if (response.ok && result.success) {
      console.log('\n✅ SUCCESS!');
      console.log(`   ${result.message}`);
      console.log('\nNext steps:');
      console.log('  1. Import characters: Logs/talea-characters-2025-11-19T12-41-27-184Z.json');
      console.log('  2. Push code changes: git push');
      console.log('  3. Test story generation');
    } else {
      console.log('\n⚠️  Migration response:', result.message);
      if (result.message && result.message.includes('already exist')) {
        console.log('\n✅ Columns already exist - that\'s OK!');
        console.log('   Migration was probably already run.');
      }
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  }
}

runMigration();

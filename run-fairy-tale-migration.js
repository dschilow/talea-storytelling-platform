const fs = require('fs');

console.log('=' .repeat(80));
console.log('🎭 FAIRY TALE MIGRATION 14: Character Matching Requirements');
console.log('='.repeat(80));
console.log();

// Read migration file
const migrationPath = 'backend/fairytales/migrations/14_add_role_matching_requirements.up.sql';
const sqlContent = fs.readFileSync(migrationPath, 'utf8');

console.log(`📄 Read migration file: ${migrationPath}`);
console.log(`   Size: ${sqlContent.length} characters`);

// Split into statements
const statements = sqlContent
  .split(';')
  .map(s => s.trim())
  .filter(s => s && !s.startsWith('--') && s.length > 10);

console.log(`\n🔄 Found ${statements.length} SQL statements to execute`);
console.log('\nExecuting via API...\n');

const API_BASE = 'https://backend-2-production-3de1.up.railway.app';

async function executeStatements() {
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];

    if (i % 10 === 0 && i > 0) {
      console.log(`   Progress: ${i}/${statements.length} statements...`);
    }

    try {
      const response = await fetch(`${API_BASE}/fairytales/run-migration-sql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql: statement + ';',
          migrationName: '14_add_role_matching_requirements'
        })
      });

      if (response.ok) {
        successCount++;
      } else {
        const errorText = await response.text();
        const lowerError = errorText.toLowerCase();

        // Check if it's an "already exists" error (acceptable)
        if (lowerError.includes('already exists') || lowerError.includes('duplicate')) {
          console.log(`   ⚠️  Statement ${i + 1}: Column already exists (skipping)`);
          successCount++;
        } else {
          console.log(`   ❌ Statement ${i + 1} failed: ${response.status}`);
          console.log(`      Error: ${errorText.substring(0, 100)}`);
          errorCount++;
        }
      }

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.log(`   ❌ Statement ${i + 1} error: ${error.message}`);
      errorCount++;
    }
  }

  console.log(`\n📊 Migration Results:`);
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${errorCount}`);
  console.log(`   📝 Total: ${statements.length}`);

  console.log('\n' + '='.repeat(80));
  if (errorCount === 0) {
    console.log('✅ SUCCESS! Migration completed without errors');
    console.log();
    console.log('Next steps:');
    console.log('  1. Import new characters from: Logs/talea-characters-2025-11-19T12-41-27-184Z.json');
    console.log('  2. Test story generation with "Klassische Märchen" genre');
    console.log('  3. Verify König is human (not Eichhörnchen!)');
  } else {
    console.log(`⚠️  PARTIAL SUCCESS: ${successCount} succeeded, ${errorCount} failed`);
    console.log();
    console.log('Some statements failed - this may be OK if columns already exist');
  }
  console.log('='.repeat(80));
}

executeStatements().catch(err => {
  console.error('\n❌ MIGRATION FAILED:', err.message);
  process.exit(1);
});

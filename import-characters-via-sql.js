const fs = require('fs');

console.log('🚀 Importing 12 new characters to database via SQL...\n');

const API_BASE = 'https://backend-2-production-3de1.up.railway.app';

// Read the merged character file (84 characters total)
const allCharacters = JSON.parse(
  fs.readFileSync('Logs/talea-characters-2025-11-19T12-41-27-184Z.json', 'utf8')
);

// Get the 12 NEW characters (last 12 in the file)
const newCharacters = allCharacters.slice(-12);

console.log(`📊 Total characters in file: ${allCharacters.length}`);
console.log(`➕ New characters to import: ${newCharacters.length}`);
console.log('\nNew characters:');
newCharacters.forEach((char, i) => {
  console.log(`  ${i + 1}. ${char.name} (${char.visualProfile?.species || 'unknown'}, ${char.role})`);
});

function escapeString(str) {
  if (!str) return '';
  return str.replace(/'/g, "''");
}

function generateInsertSQL(char) {
  const emotionalNature = JSON.stringify(char.emotionalNature || { dominant: 'calm', secondary: [], triggers: [] });
  const visualProfile = JSON.stringify(char.visualProfile || { description: '', species: 'unknown', colorPalette: [] });

  return `
INSERT INTO character_pool (
  id, name, role, archetype, emotional_nature, visual_profile, image_url,
  max_screen_time, available_chapters, canon_settings,
  recent_usage_count, total_usage_count, last_used_at,
  is_active, created_at, updated_at
) VALUES (
  '${char.id}',
  '${escapeString(char.name)}',
  '${escapeString(char.role)}',
  '${escapeString(char.archetype)}',
  '${escapeString(emotionalNature)}',
  '${escapeString(visualProfile)}',
  ${char.imageUrl ? `'${escapeString(char.imageUrl)}'` : 'NULL'},
  ${char.maxScreenTime || 50},
  ARRAY[${(char.availableChapters || [1, 2, 3, 4, 5]).join(',')}],
  ARRAY[${(char.canonSettings || []).map(s => `'${escapeString(s)}'`).join(',')}]::text[],
  ${char.recentUsageCount || 0},
  ${char.totalUsageCount || 0},
  ${char.lastUsedAt ? `'${char.lastUsedAt}'` : 'NULL'},
  ${char.isActive !== false},
  '${char.createdAt || new Date().toISOString()}',
  '${char.updatedAt || new Date().toISOString()}'
)
ON CONFLICT (id) DO NOTHING;
`.trim();
}

async function importCharacters() {
  console.log('\n' + '='.repeat(80));
  console.log('Starting import via SQL...\n');

  let successCount = 0;
  let errorCount = 0;
  let alreadyExists = 0;

  for (const char of newCharacters) {
    try {
      const sql = generateInsertSQL(char);

      const response = await fetch(`${API_BASE}/fairytales/run-migration-sql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql: sql,
          migrationName: 'import-new-characters'
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.message && result.message.includes('already exists')) {
          console.log(`⚠️  Already exists: ${char.name}`);
          alreadyExists++;
        } else {
          console.log(`✅ Imported: ${char.name}`);
          successCount++;
        }
      } else {
        const errorText = await response.text();
        const lowerError = errorText.toLowerCase();

        // Check if it's a duplicate key error
        if (lowerError.includes('duplicate') || lowerError.includes('unique constraint') || lowerError.includes('already exists')) {
          console.log(`⚠️  Already exists: ${char.name}`);
          alreadyExists++;
        } else {
          console.log(`❌ Failed: ${char.name} - ${errorText}`);
          errorCount++;
        }
      }
    } catch (err) {
      console.log(`❌ Failed: ${char.name} - ${err.message}`);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 IMPORT RESULTS:');
  console.log(`   ✅ Successfully imported: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   ℹ️  Already existed: ${alreadyExists}`);

  if (errorCount === 0) {
    console.log('\n🎉 SUCCESS! All 12 new characters are now in the database!');
    console.log('   Pool size: 72 → 84 characters');
  } else {
    console.log('\n⚠️  Some characters failed to import - check errors above');
  }
  console.log('='.repeat(80));
}

importCharacters().catch(err => {
  console.error('\n❌ IMPORT FAILED:', err.message);
  process.exit(1);
});

const fs = require('fs');

console.log('🚀 Importing 12 new characters to database...\n');

const API_BASE = 'https://backend-2-production-3de1.up.railway.app';

// Read the merged character file (84 characters total)
const allCharacters = JSON.parse(
  fs.readFileSync('Logs/talea-characters-2025-11-19T12-41-27-184Z.json', 'utf8')
);

// Filter only the 12 NEW characters (without usageStats or with recentUsageCount: 0)
const newCharacters = allCharacters.filter(char => {
  // New characters have either no usageStats or explicit counts of 0
  const hasNoStats = !char.usageStats || Object.keys(char.usageStats).length === 0;
  const hasZeroStats = char.recentUsageCount === 0 && char.totalUsageCount === 0;
  return hasNoStats || hasZeroStats;
});

console.log(`📊 Total characters in file: ${allCharacters.length}`);
console.log(`➕ New characters to import: ${newCharacters.length}`);
console.log('\nNew characters:');
newCharacters.forEach((char, i) => {
  console.log(`  ${i + 1}. ${char.name} (${char.visualProfile?.species || 'unknown'}, ${char.role})`);
});

async function importCharacters() {
  console.log('\n' + '='.repeat(80));
  console.log('Starting import...\n');

  let successCount = 0;
  let errorCount = 0;
  let alreadyExists = 0;

  for (const char of newCharacters) {
    try {
      // Prepare character data for API (strip out DB-only fields)
      const characterData = {
        name: char.name,
        role: char.role,
        archetype: char.archetype,
        emotionalNature: char.emotionalNature,
        visualProfile: char.visualProfile,
        imageUrl: char.imageUrl,
        maxScreenTime: char.maxScreenTime || 50,
        availableChapters: char.availableChapters || [1, 2, 3, 4, 5],
        canonSettings: char.canonSettings || [],
        isActive: char.isActive ?? true
      };

      const response = await fetch(`${API_BASE}/story/character-pool`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ character: characterData })
      });

      if (response.ok) {
        console.log(`✅ Imported: ${char.name}`);
        successCount++;
      } else {
        const errorText = await response.text();
        const lowerError = errorText.toLowerCase();

        // Check if it's a duplicate key error
        if (lowerError.includes('duplicate') || lowerError.includes('unique constraint')) {
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
    console.log('\n🎉 SUCCESS! All new characters are now in the database!');
  } else {
    console.log('\n⚠️  Some characters failed to import - check errors above');
  }
  console.log('='.repeat(80));
}

importCharacters().catch(err => {
  console.error('\n❌ IMPORT FAILED:', err.message);
  process.exit(1);
});

const fs = require('fs');
const crypto = require('crypto');

console.log('🔧 Fixing character IDs...');

// Read new characters
const newChars = JSON.parse(fs.readFileSync('Logs/new-characters-for-pool.json', 'utf8'));

// Add UUIDs to characters that don't have them
let fixedCount = 0;
newChars.forEach(char => {
  if (!char.id) {
    char.id = crypto.randomUUID();
    fixedCount++;
    console.log(`✅ Added ID to: ${char.name} → ${char.id}`);
  }

  // Add timestamps if missing
  if (!char.createdAt) {
    char.createdAt = new Date().toISOString();
  }
  if (!char.updatedAt) {
    char.updatedAt = new Date().toISOString();
  }

  // Add isActive if missing
  if (char.isActive === undefined) {
    char.isActive = true;
  }

  // Add usage counts if missing
  if (char.recentUsageCount === undefined) {
    char.recentUsageCount = 0;
  }
  if (char.totalUsageCount === undefined) {
    char.totalUsageCount = 0;
  }
});

console.log(`📊 Fixed ${fixedCount} characters`);

// Save fixed version
fs.writeFileSync('Logs/new-characters-for-pool.json', JSON.stringify(newChars, null, 2));
console.log('💾 Saved: Logs/new-characters-for-pool.json');

// Now merge with old pool
const oldChars = JSON.parse(fs.readFileSync('Logs/talea-characters-2025-11-19T12-41-27-184Z.json', 'utf8'));

// Remove any existing new chars from old pool (in case of re-run)
const newCharNames = new Set(newChars.map(c => c.name));
const filteredOld = oldChars.filter(c => !newCharNames.has(c.name));

console.log(`📊 Old pool: ${oldChars.length} characters`);
console.log(`📊 After filtering duplicates: ${filteredOld.length} characters`);
console.log(`➕ New chars: ${newChars.length} characters`);

// Merge
const merged = [...filteredOld, ...newChars];

console.log(`✅ Total: ${merged.length} characters`);

// Write merged file
fs.writeFileSync('Logs/talea-characters-2025-11-19T12-41-27-184Z.json', JSON.stringify(merged, null, 2));
console.log('💾 Updated: Logs/talea-characters-2025-11-19T12-41-27-184Z.json');

console.log('\n✅ Done! Characters are ready for import.');

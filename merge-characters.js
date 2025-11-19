const fs = require('fs');

console.log('📦 Merging character pools...');

// Read files
const oldChars = JSON.parse(fs.readFileSync('Logs/talea-characters-2025-11-19T12-41-27-184Z.json', 'utf8'));
const newChars = JSON.parse(fs.readFileSync('Logs/new-characters-for-pool.json', 'utf8'));

console.log(`📊 Old pool: ${oldChars.length} characters`);
console.log(`➕ New chars: ${newChars.length} characters`);

// Merge
const merged = [...oldChars, ...newChars];

console.log(`✅ Total: ${merged.length} characters`);

// Write merged file
fs.writeFileSync('Logs/talea-characters-updated-with-new.json', JSON.stringify(merged, null, 2));
console.log('💾 Saved to: Logs/talea-characters-updated-with-new.json');

// Also update the original file for import
fs.writeFileSync('Logs/talea-characters-2025-11-19T12-41-27-184Z.json', JSON.stringify(merged, null, 2));
console.log('💾 Updated: Logs/talea-characters-2025-11-19T12-41-27-184Z.json');

console.log('\n✅ Done! Import this file into your admin panel.');

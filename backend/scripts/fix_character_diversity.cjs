const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '..', '..', 'Logs');
const filename = 'talea-characters-2026-01-19T20-07-00-627Z.json';
const filePath = path.join(logDir, filename);
const outputPath = path.join(logDir, 'talea-characters-enhanced.json');

try {
    console.log(`Reading from: ${filePath}`);
    const rawData = fs.readFileSync(filePath, 'utf8');
    const characters = JSON.parse(rawData);

    let modifications = 0;

    characters.forEach(char => {
        let modified = false;

        // 1. Fix Capitalization for "the X"
        if (char.name && char.name.startsWith('the ')) {
            char.name = 'The ' + char.name.substring(4);
            modified = true;
        }

        // 2. Enrich Triggers
        let currentTriggers = [];
        // Normalize location of triggers (emotionalNature vs root)
        if (char.emotionalNature && char.emotionalNature.triggers) {
            currentTriggers = char.emotionalNature.triggers;
        } else if (char.triggers) {
            currentTriggers = char.triggers;
        }

        const newTags = new Set(currentTriggers);

        // Add Role
        if (char.role) {
            newTags.add(char.role.toLowerCase());
        }

        // Add Species (split)
        if (char.visualProfile && char.visualProfile.species) {
            const parts = char.visualProfile.species.toLowerCase().split('_');
            parts.forEach(p => newTags.add(p));
        }

        // Add Archetype parts? (e.g. "magical_mentor" -> "magical", "mentor")
        if (char.archetype) {
            const parts = char.archetype.toLowerCase().split('_');
            parts.forEach(p => newTags.add(p));
        }

        const enrichedTriggers = Array.from(newTags).sort();

        // Detect if changes made (simple length check or content check)
        if (enrichedTriggers.length !== currentTriggers.length) {
            modified = true;
        }

        // Write back
        if (char.emotionalNature && char.emotionalNature.triggers) {
            char.emotionalNature.triggers = enrichedTriggers;
        } else {
            char.triggers = enrichedTriggers;
        }

        if (modified) modifications++;
    });

    console.log(`Modified ${modifications} characters.`);

    fs.writeFileSync(outputPath, JSON.stringify(characters, null, 2), 'utf8');
    console.log(`Wrote enhanced data to: ${outputPath}`);

} catch (err) {
    console.error('Error:', err);
}

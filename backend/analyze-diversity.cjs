const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '..', 'Logs');
const filename = 'talea-characters-2026-01-19T20-07-00-627Z.json';
const filePath = path.join(logDir, filename);

try {
    const rawData = fs.readFileSync(filePath, 'utf8');
    const characters = JSON.parse(rawData);

    const genericTriggers = ["adventure", "children", "friends", "help"].sort().join(',');
    const genericChars = characters.filter(char => {
        let triggers = [];
        if (char.emotionalNature && char.emotionalNature.triggers) {
            triggers = char.emotionalNature.triggers.sort();
        } else if (char.triggers) {
            triggers = char.triggers.sort();
        }
        return triggers.join(',') === genericTriggers;
    });

    // Analyze Settings in this group
    const settingsCounts = {};
    const settingsSets = {};

    genericChars.forEach(c => {
        const setKey = (c.canonSettings || []).sort().join(',');
        settingsSets[setKey] = (settingsSets[setKey] || 0) + 1;

        (c.canonSettings || []).forEach(s => {
            settingsCounts[s] = (settingsCounts[s] || 0) + 1;
        });
    });

    console.log(`\n--- Settings Combinations in Generic Group ---`);
    Object.entries(settingsSets)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([k, v]) => console.log(`${v}x: [${k}]`));

} catch (err) {
    console.error('Error:', err);
}

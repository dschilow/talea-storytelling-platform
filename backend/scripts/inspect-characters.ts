
import fs from 'fs';
import path from 'path';

const logPath = path.join(process.cwd(), 'Logs', 'talea-characters-2025-11-21T09-29-09-152Z.json');

try {
    const content = fs.readFileSync(logPath, 'utf-8');
    const characters = JSON.parse(content);

    console.log(`Found ${characters.length} characters.`);

    characters.forEach((char: any) => {
        console.log('------------------------------------------------');
        console.log(`Name: ${char.name}`);
        console.log(`Role: ${char.role || 'N/A'}`);
        console.log(`Visual Profile:`, JSON.stringify(char.visualProfile, null, 2));
    });

} catch (error) {
    console.error('Error reading file:', error);
}

import * as fs from 'fs';
import * as path from 'path';

// Configuration
const TARGET_FILE = process.argv[2];

if (!TARGET_FILE) {
    console.error('Please provide the path to the character JSON file as an argument.');
    process.exit(1);
}

// Comprehensive German to English Dictionary
const TRANSLATION_MAP: { [key: string]: string } = {
    // Titles
    'Herr': 'Mr',
    'Frau': 'Ms',

    // Professions & Roles
    'Bäcker': 'Baker', 'Bäckerin': 'Baker',
    'Polizist': 'Police Officer', 'Polizistin': 'Police Officer',
    'Lehrer': 'Teacher', 'Lehrerin': 'Teacher',
    'Arzt': 'Doctor', 'Ärztin': 'Doctor',
    'König': 'King', 'Königin': 'Queen',
    'Prinz': 'Prince', 'Prinzessin': 'Princess',
    'Ritter': 'Knight',
    'Schmied': 'Blacksmith',
    'Bauer': 'Farmer', 'Bäuerin': 'Farmer',
    'Müller': 'Miller',
    'Jäger': 'Hunter', 'Jägerin': 'Hunter',
    'Fischer': 'Fisherman',
    'Händler': 'Merchant', 'Händlerin': 'Merchant',
    'Wirt': 'Innkeeper', 'Wirtin': 'Innkeeper',
    'Zauberer': 'Wizard', 'Zauberin': 'Sorceress',
    'Hexe': 'Witch',
    'Fee': 'Fairy',
    'Elfe': 'Elf', 'Elf': 'Elf',
    'Zwerg': 'Dwarf',
    'Riese': 'Giant',
    'Drache': 'Dragon',
    'Geist': 'Ghost',
    'Gespenst': 'Ghost',
    'Steinwächter': 'Stone Guardian',
    'Wächter': 'Guardian',
    'Krieger': 'Warrior', 'Kriegerin': 'Warrior',
    'Dieb': 'Thief', 'Diebin': 'Thief',
    'Pirat': 'Pirate',
    'Kapitän': 'Captain',
    'Pilot': 'Pilot', 'Pilotin': 'Pilot',
    'Feuerwehrmann': 'Firefighter', 'Feuerwehrfrau': 'Firefighter',
    'Astronaut': 'Astronaut',
    'Detektiv': 'Detective',
    'Koch': 'Chef', 'Köchin': 'Chef',
    'Gärtner': 'Gardener',
    'Wissenschaftler': 'Scientist', 'Wissenschaftlerin': 'Scientist',
    'Busfahrer': 'Bus Driver', 'Busfahrerin': 'Bus Driver',
    'Maler': 'Painter', 'Malerin': 'Painter',
    'Verkäufer': 'Shopkeeper', 'Verkäuferin': 'Shopkeeper',
    'Bibliothekar': 'Librarian', 'Bibliothekarin': 'Librarian',

    // Nature & Objects
    'Sonne': 'Sun',
    'Mond': 'Moon',
    'Stern': 'Star',
    'Wolke': 'Cloud',
    'Nebel': 'Mist',
    'Nebelfee': 'Mist Fairy',
    'Silberfunke': 'Silver Spark',
    'Sonnenblume': 'Sunflower',
    'Blume': 'Flower',
    'Baum': 'Tree',

    // Animals
    'Eichhörnchen': 'Squirrel',
    'Bär': 'Bear',
    'Hase': 'Rabbit', 'Kaninchen': 'Bunny',
    'Fuchs': 'Fox',
    'Wolf': 'Wolf',
    'Eule': 'Owl',
    'Adler': 'Eagle',
    'Löwe': 'Lion',
    'Tiger': 'Tiger',
    'Katze': 'Cat', 'Kater': 'Cat',
    'Hund': 'Dog',
    'Maus': 'Mouse',
    'Ratte': 'Rat',
    'Pferd': 'Horse',
    'Einhorn': 'Unicorn',
    'Frosch': 'Frog',
    'Kröte': 'Toad',
    'Schlange': 'Snake',
    'Spinne': 'Spider',
    'Biene': 'Bee',
    'Ameise': 'Ant',
    'Schmetterling': 'Butterfly',
    'Hirsch': 'Deer',
    'Reh': 'Deer',
    'Wildschwein': 'Boar',
    'Dachs': 'Badger',
    'Igel': 'Hedgehog',
    'Maulwurf': 'Mole',
    'Rabe': 'Raven',
    'Krähe': 'Crow',
    'Ente': 'Duck',
    'Schwan': 'Swan',
    'Gans': 'Goose',
    'Huhn': 'Chicken',
    'Hahn': 'Rooster',
    'Kuh': 'Cow',
    'Schaf': 'Sheep',
    'Ziege': 'Goat',
    'Schwein': 'Pig',
    'Esel': 'Donkey',
    'Vogel': 'Bird',

    // Family & General
    'Oma': 'Grandma', 'Großmutter': 'Grandmother',
    'Opa': 'Grandpa', 'Großvater': 'Grandfather',
    'Mama': 'Mom', 'Mutter': 'Mother',
    'Papa': 'Dad', 'Vater': 'Father',
    'Junge': 'Boy',
    'Mädchen': 'Girl',
    'Mann': 'Man',
    'Kind': 'Child',
    'Baby': 'Baby',
    'Freund': 'Friend', 'Freundin': 'Friend',
    'Nachbar': 'Neighbor', 'Nachbarin': 'Neighbor'
};

interface VisualProfile {
    colorPalette: string[];
    description: string;
    imagePrompt: string;
    species: string;
}

interface Character {
    id: string;
    name: string;
    archetype: string;
    visualProfile: VisualProfile;
    [key: string]: any;
}

function cleanString(str: string): string {
    let cleaned = str;
    // Replace German articles/prepositions often found in names
    cleaned = cleaned.replace(/\bder\b/gi, 'the');
    cleaned = cleaned.replace(/\bdie\b/gi, 'the');
    cleaned = cleaned.replace(/\bdas\b/gi, 'the');
    cleaned = cleaned.replace(/\bund\b/gi, 'and');
    cleaned = cleaned.replace(/\bmit\b/gi, 'with');
    cleaned = cleaned.replace(/\bohne\b/gi, 'without');
    cleaned = cleaned.replace(/\bvon\b/gi, 'of');
    cleaned = cleaned.replace(/\bvom\b/gi, 'from the');
    cleaned = cleaned.replace(/\bim\b/gi, 'in the');
    cleaned = cleaned.replace(/\bam\b/gi, 'at the');
    return cleaned;
}

function translateName(name: string): { cleanName: string, role: string | null, fullEnglishName: string } {
    // 1. Check for "Name der [Role]" pattern (e.g., "Brumm der Steinwächter")
    const derMatch = name.match(/^(.+?)\s+(?:der|die|das)\s+(.+)$/i);
    if (derMatch) {
        const coreName = derMatch[1];
        const germanRole = derMatch[2];
        const englishRole = TRANSLATION_MAP[germanRole] || cleanString(germanRole);
        return {
            cleanName: coreName,
            role: englishRole,
            fullEnglishName: `${coreName} the ${englishRole}`
        };
    }

    // 2. Check for "[Role] [Name]" pattern (e.g., "Bäcker Braun", "Herr Briefmann")
    const parts = name.split(' ');
    const firstWord = parts[0];

    if (TRANSLATION_MAP[firstWord]) {
        const englishRole = TRANSLATION_MAP[firstWord];
        const coreName = parts.slice(1).join(' ');

        // Special handling for Titles (Mr, Ms, Dr, etc.)
        // If the role is a title, we keep the order: "Mr. Briefmann"
        if (['Mr', 'Ms', 'Mrs', 'Dr', 'Prof'].includes(englishRole)) {
            return {
                cleanName: coreName,
                role: englishRole,
                fullEnglishName: `${englishRole}. ${coreName}`
            };
        }

        // Default: "Braun the Baker"
        return {
            cleanName: coreName,
            role: englishRole,
            fullEnglishName: `${coreName} the ${englishRole}`
        };
    }

    // 3. Fallback: Just clean the string
    return {
        cleanName: name,
        role: null,
        fullEnglishName: cleanString(name)
    };
}

function enhanceVisualProfile(char: Character): VisualProfile {
    const originalVp: Partial<VisualProfile> = char.visualProfile || {};
    const { cleanName, role, fullEnglishName } = translateName(char.name);

    // Determine core descriptors
    let coreType = 'character';
    if (char.archetype === 'adventurer') coreType = 'adventurer';
    if (char.archetype === 'innocent') coreType = 'child';
    if (role) coreType = role.toLowerCase();

    // Construct description
    const englishDescription = fullEnglishName;

    // Clean up image prompt
    let prompt = originalVp.imagePrompt || '';

    // 1. Translate known German words in the prompt
    // Sort keys by length descending to avoid partial matches (e.g. matching "Elf" inside "Elfe" if not careful, though \b helps)
    const sortedKeys = Object.keys(TRANSLATION_MAP).sort((a, b) => b.length - a.length);

    sortedKeys.forEach(german => {
        const regex = new RegExp(`\\b${german}\\b`, 'gi');
        prompt = prompt.replace(regex, TRANSLATION_MAP[german]);
    });

    // 2. Clean common German artifacts
    prompt = prompt.replace(/\(Die \.\.\.\)/gi, '');
    prompt = prompt.replace(/\(Der \.\.\.\)/gi, '');
    prompt = prompt.replace(/\(Das \.\.\.\)/gi, '');
    prompt = cleanString(prompt);

    // 3. Fix "Portrait of..."
    if (prompt.startsWith('Portrait of')) {
        // Replace the potentially German name in "Portrait of [Name]" with the English one
        const nameRegex = new RegExp(`Portrait of ${char.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
        prompt = prompt.replace(nameRegex, `Portrait of ${fullEnglishName}`);

        // Also try replacing just the first word if it was a role
        const parts = char.name.split(' ');
        if (TRANSLATION_MAP[parts[0]]) {
            const roleRegex = new RegExp(`Portrait of ${parts[0]}`, 'i');
            prompt = prompt.replace(roleRegex, `Portrait of ${TRANSLATION_MAP[parts[0]]}`);
        }
    }

    // 4. Ensure Consistency Tags
    if (!prompt.includes('Consistency:')) {
        prompt += ' Consistency: Same face, hair, and clothing in all scenes.';
    }

    // 5. Final sanity check for "Portrait of"
    if (!prompt.startsWith('Portrait of')) {
        prompt = `Portrait of ${fullEnglishName}, ${prompt}`;
    }

    return {
        colorPalette: originalVp.colorPalette || [],
        species: originalVp.species || 'human',
        description: englishDescription,
        imagePrompt: prompt
    };
}

// Main Execution
try {
    const rawData = fs.readFileSync(TARGET_FILE, 'utf-8');
    const characters: Character[] = JSON.parse(rawData);

    console.log(`Deep cleaning ${characters.length} characters...`);

    const updatedCharacters = characters.map(char => {
        const { fullEnglishName } = translateName(char.name);
        const newVp = enhanceVisualProfile(char);

        return {
            ...char,
            name: fullEnglishName, // Explicitly update the name
            visualProfile: newVp
        };
    });

    // Write back
    fs.writeFileSync(TARGET_FILE, JSON.stringify(updatedCharacters, null, 2));
    console.log(`Successfully updated characters in ${TARGET_FILE}`);

} catch (error) {
    console.error('Error processing file:', error);
    process.exit(1);
}

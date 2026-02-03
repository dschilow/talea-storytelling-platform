import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const filePath = 'C:\\MyProjects\\Talea\\talea-storytelling-platform\\Logs\\sample\\talea-characters-2026-02-03T08-29-34-102Z.json';

// Read existing characters
const rawData = fs.readFileSync(filePath, 'utf-8');
const existingCharacters = JSON.parse(rawData);

interface Character {
    id: string;
    isActive: boolean;
    name: string;
    archetype: string;
    role: string;
    species: string; // Helper for visualProfile
    description: string; // Helper for visualProfile
    imagePrompt: string; // Helper for visualProfile
    dominantPersonality: string;
    secondaryTraits: string[];
    speechStyle: string[];
    catchphrase: string;
    catchphraseContext: string;
    emotionalTriggers: string[];
    quirk: string;
    // Computed fields for JSON structure
    emotionalNature?: any;
    visualProfile?: any;
    availableChapters?: number[];
    canonSettings?: string[];
    createdAt?: string;
    updatedAt?: string;
    maxScreenTime?: number;
    recentUsageCount?: number;
    totalUsageCount?: number;
    imageUrl?: string;
}

const newTemplates: Character[] = [
    {
        id: crypto.randomUUID(),
        isActive: true,
        name: "König Karl der Weise",
        archetype: "royal",
        role: "mentor",
        species: "human_king",
        description: "König Karl der Weise",
        imagePrompt: "Portrait of King Karl, elderly king with grey beard, golden crown, red velvet cloak, sitting on a throne, wise and kind face. Storybook illustration style, majestic.",
        dominantPersonality: "gerecht",
        secondaryTraits: ["müde", "verantwortungsvoll", "gütig"],
        speechStyle: ["hoheitsvoll", "bedächtig", "sanft"],
        catchphrase: "In meinem Königreich zählt jedes Wort.",
        catchphraseContext: "bei wichtigen Entscheidungen",
        emotionalTriggers: ["Ungerechtigkeit", "Sorge um das Volk", "alte Legenden"],
        quirk: "streicht sich nachdenklich durch den Bart"
    },
    {
        id: crypto.randomUUID(),
        isActive: true,
        name: "Wolf Grimbart",
        archetype: "predator",
        role: "antagonist",
        species: "wolf",
        description: "Wolf Grimbart",
        imagePrompt: "Portrait of Wolf Grimbart, grey wolf with glowing yellow eyes, sharp teeth, wearing a tattered vest, lurking in shadows. Storybook illustration style, slightly scary.",
        dominantPersonality: "listig",
        secondaryTraits: ["hungrig", "charmant", "gefährlich"],
        speechStyle: ["schmeichelnd", "knurrend", "zweideutig"],
        catchphrase: "Zum Fressen gern habe ich... gute Geschichten!",
        catchphraseContext: "bevor er jemanden reinlegt",
        emotionalTriggers: ["Hunger", "Vollmond", "Rotkäppchen"],
        quirk: "leckt sich über die Lippen, wenn er jemanden ansieht"
    },
    {
        id: crypto.randomUUID(),
        isActive: true,
        name: "Frosch Quak",
        archetype: "creature",
        role: "helper",
        species: "frog",
        description: "Frosch Quak",
        imagePrompt: "Portrait of Frog Quak, bright green frog sitting on a lily pad, wearing a tiny golden crown, arrogant expression. Storybook illustration style, funny.",
        dominantPersonality: "eingebildet",
        secondaryTraits: ["adlig (denkt er)", "laut", "nass"],
        speechStyle: ["quakend", "vornehm", "fordernd"],
        catchphrase: "Küss mich! Ich bin eigentlich ein Prinz! Wirklich!",
        catchphraseContext: "zu jeder Prinzessin die vorbeikommt",
        emotionalTriggers: ["Fliegen", "Störche", "trockene Haut"],
        quirk: "bläst sich auf, wenn er wichtig wirken will"
    },
    {
        id: crypto.randomUUID(),
        isActive: true,
        name: "Schwarzmagier Morbus",
        archetype: "villain",
        role: "antagonist",
        species: "human_dark_wizard",
        description: "Schwarzmagier Morbus",
        imagePrompt: "Portrait of Dark Mage Morbus, wearing black robes with runes, pale skin, holding a staff with a dark purple crystal, ominous aura. Storybook illustration style, dark and mysterious.",
        dominantPersonality: "machtgierig",
        secondaryTraits: ["kalt", "intelligent", "herzlos"],
        speechStyle: ["flüsternd", "bedrohlich", "hochtrabend"],
        catchphrase: "Dunkelheit ist nur der Schatten meiner Macht.",
        catchphraseContext: "wenn er einen bösen Zauber wirkt",
        emotionalTriggers: ["Licht", "Verlieren", "positive Gefühle"],
        quirk: "spielt mit einem dunklen Kristall in seiner Hand"
    },
    {
        id: crypto.randomUUID(),
        isActive: true,
        name: "Räuberhauptmann Rotbart",
        archetype: "villain",
        role: "antagonist",
        species: "human_bandit_leader",
        description: "Räuberhauptmann Rotbart",
        imagePrompt: "Portrait of Robber Captain Redbeard, big man with bushy red beard, eye patch, scar, holding a saber, threatening laugh. Storybook illustration style, dynamic.",
        dominantPersonality: "grob",
        secondaryTraits: ["laut", "jähzornig", "stark"],
        speechStyle: ["brüllend", "lachend", "gemein"],
        catchphrase: "Gold oder Leben! Am besten beides!",
        catchphraseContext: "beim Überfall",
        emotionalTriggers: ["Gold", "Insubordination", "leere Schatztruhen"],
        quirk: "klopft ständig auf seinen Säbel"
    },
    {
        id: crypto.randomUUID(),
        isActive: true,
        name: "Kobold Kicher",
        archetype: "trickster",
        role: "antagonist",
        species: "goblin",
        description: "Kobold Kicher",
        imagePrompt: "Portrait of Goblin Kicher, small green goblin, long pointed ears, wearing rags, carrying a bag of stolen shiny things, mischievous grin. Storybook illustration style.",
        dominantPersonality: "hinterhältig",
        secondaryTraits: ["schnell", "diebisch", "nervig"],
        speechStyle: ["kichernd", "schnell", "reimend"],
        catchphrase: "Hihihi! Das gehört jetzt mir! Schnapp!",
        catchphraseContext: "wenn er etwas stiehlt",
        emotionalTriggers: ["Glitzernde Dinge", "Gefangenwerden", "Schokolade"],
        quirk: "hüpft von einem Bein auf das andere"
    }
];

const enrichedNewCharacters = newTemplates.map(char => {
    return {
        ...char,
        emotionalNature: {
            dominant: (char.dominantPersonality === "frech" || char.dominantPersonality === "listig" || char.dominantPersonality === "hinterhältig") ? "mischievous" :
                (char.dominantPersonality === "weise" || char.dominantPersonality === "gerecht") ? "wise" :
                    (char.dominantPersonality === "mutig" || char.dominantPersonality === "tatkräftig" || char.dominantPersonality === "grob") ? "brave" : // grob -> brave mapping for convenience
                        (char.dominantPersonality === "liebevoll" || char.dominantPersonality === "fürsorglich") ? "kind" : "neutral",
            secondary: char.secondaryTraits.map(t => {
                return "trait";
            }),
            triggers: char.emotionalTriggers.map(t => "trigger")
        },
        visualProfile: {
            colorPalette: ["primary", "secondary", "accent"],
            description: char.description,
            imagePrompt: char.imagePrompt,
            species: char.species
        },
        availableChapters: [1, 2, 3, 4, 5],
        canonSettings: ["forest", "village", "castle", "home", "cave"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        maxScreenTime: 60,
        recentUsageCount: 0,
        totalUsageCount: 0,
        imageUrl: "" // New characters don't have images yet
    };
});

const updatedCharacters = [...existingCharacters, ...enrichedNewCharacters];

fs.writeFileSync(filePath, JSON.stringify(updatedCharacters, null, 2));
console.log(`Successfully added ${enrichedNewCharacters.length} characters. Total count: ${updatedCharacters.length}.`);

import * as fs from 'fs';

const filePath = 'C:\\MyProjects\\Talea\\talea-storytelling-platform\\Logs\\sample\\talea-characters-2026-02-03T11-31-35-218Z.json';

const rawData = fs.readFileSync(filePath, 'utf-8');
const characters = JSON.parse(rawData);

const englishToGermanNames: Record<string, string> = {
    "Astronaut Nova": "Astronautin Nova",
    "Baker Bruno": "Bäcker Bruno",
    "Tracker Dog Bello": "Bello der Spürhund",
    "Detective Sniff": "Detektiv Schnüffel",
    "Dragon Sparky": "Drache Fauchi",
    "Dr. Johann Healgood": "Dr. Johann Heilgut",
    "Squirrel Flash": "Eichhörnchen Flitz",
    "Unicorn Starshine": "Einhorn Sternenglanz",
    "Fairy Rosalie": "Fee Rosalie",
    "Firefighter Fanni": "Feuerwehrfrau Fanni",
    "Frog Croak": "Frosch Quak",
    "Gardener Flora": "Gärtnerin Flora",
    "Ghost Spooky": "Gespenst Schrecki",
    "Witch Herbwise": "Hexe Kräuterweis",
    "Captain Bubble": "Kapitän Blubbert",
    "Goblin Giggle": "Kobold Kicher",
    "Queen Klara": "Königin Klara",
    "King Karl the Wise": "König Karl der Weise",
    "Teacher Lämpel": "Lehrerin Lämpel",
    "Leo Lionheart": "Leo Löwenmut",
    "Mia Curiosity": "Mia Neugier",
    "Mimi Velvetpaw": "Mimi Samtpfote",
    "Grandma Hearty": "Oma Herzlich",
    "Police Officer Peter": "Polizist Peter",
    "Postman Paperboat": "Postbote Papierschiff",
    "Princess Lilia": "Prinzessin Lilia",
    "Professor Gadget": "Professor Tüftel",
    "Robber Captain Redbeard": "Räuberhauptmann Rotbart",
    "Robber Rascal": "Räuber Raubauke",
    "Knight Rustfree": "Ritter Rostfrei",
    "Robo-X": "Robo-X",
    "Dark Mage Morbus": "Schwarzmagier Morbus",
    "Troll Grumble": "Troll Grummel",
    "Wolf Grimbeard": "Wolf Grimbart",
    "Wizard Star-Trail": "Zauberer Sternenschweif",
    "Dwarf Goldtooth": "Zwerg Goldzahn"
};

const updatedCharacters = characters.map((char: any) => {
    const germanName = englishToGermanNames[char.name];
    if (germanName) {
        return {
            ...char,
            name: germanName,
            // Also revert description if it matches the name (common pattern)
            description: germanName,
            visualProfile: {
                ...char.visualProfile,
                description: germanName
            }
        };
    }
    return char;
});

fs.writeFileSync(filePath, JSON.stringify(updatedCharacters, null, 2));
console.log(`Reverted names for ${updatedCharacters.length} characters to German.`);

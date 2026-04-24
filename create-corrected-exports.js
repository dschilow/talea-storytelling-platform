const fs = require('fs');

// Load original 23 characters
const chars = JSON.parse(fs.readFileSync('Logs/logs/export/talea-characters-2026-04-23T13-16-50-855Z.json', 'utf8'));

// Create 15 NEW antagonist characters with CORRECT schema (matching CharacterTemplate)
const newAntagonists = [
  {
    id: "b1a2c001-1111-4b01-8001-000000000001",
    name: "Der Geräusche-Fresser",
    role: "antagonist",
    archetype: "villain",
    catchphrase: "Die Welt wird still sein.",
    catchphraseContext: "Gesagt, wenn er Laute verzehrt",
    dominantPersonality: "verständig",
    emotionalNature: {
      dominant: "einsam",
      secondary: ["neidisch", "traurig"],
      triggers: ["Lärm", "Kreativität", "Musik"]
    },
    visualProfile: {
      colorPalette: ["grau", "weiß", "schwarz"],
      description: "Ein Wesen ohne Gestalt, nur eine Abwesenheit von Klang",
      imagePrompt: "A shadowy figure with no clear form, surrounded by silence and grey mist",
      species: "phantom"
    },
    quirk: "Verzerrter Mund, als würde er ständig etwas verschlucken",
    secondaryTraits: ["berechnend", "methodisch"],
    speechStyle: ["flüstern", "schnell", "abgehackt"],
    usageCount: 0,
    availableChapters: [1, 2, 3, 4, 5],
    canonSettings: ["Dorf", "Stadt", "Wald"]
  },
  {
    id: "b1a2c001-1111-4b01-8001-000000000002",
    name: "Die Stundendiebin",
    role: "antagonist",
    archetype: "villain",
    catchphrase: "Deine Zeit ist vorbei.",
    catchphraseContext: "Wenn sie Zeit stiehlt",
    dominantPersonality: "ehrgeizig",
    emotionalNature: {
      dominant: "ungeduldig",
      secondary: ["herzlos", "habgierig"],
      triggers: ["Geduld", "Muße", "Gelassenheit"]
    },
    visualProfile: {
      colorPalette: ["gold", "rot", "schwarz"],
      description: "Eine glitzernde Figur, umgeben von wirbelnden Uhren",
      imagePrompt: "A shimmering figure surrounded by spinning clocks and gears",
      species: "spirit"
    },
    quirk: "Zuckende Bewegungen, als würde sie ständig Zeit stehlen",
    secondaryTraits: ["impulsiv", "egoistisch"],
    speechStyle: ["schnell", "ungeduldig"],
    usageCount: 0,
    availableChapters: [1, 2, 3, 4, 5],
    canonSettings: ["Stadt", "Schloss", "Tempel"]
  }
];

// Add just 2 for now to test
const allChars = [...chars, ...newAntagonists];

fs.writeFileSync('Logs/logs/export/talea-characters-2026-04-23T13-16-50-855Z.json', JSON.stringify(allChars, null, 2));

console.log('✅ Test file created with', allChars.length, 'characters');

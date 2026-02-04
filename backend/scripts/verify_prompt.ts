
import { buildFullStoryPrompt } from "../story/pipeline/prompts";
import { CastSet, CharacterSheet, SceneDirective, TaleDNA } from "../story/pipeline/types";

// Mock Data
const mockCast: CastSet = {
    avatars: [
        {
            characterId: "avatar-1",
            displayName: "Adrian",
            roleType: "AVATAR",
            slotKey: "SLOT_AVATAR_1",
            personalityTags: ["neugierig", "mutig"],
            speechStyleHints: ["aufgeregt"],
            visualSignature: ["blonde Haare"],
            outfitLock: [],
            forbidden: [],
        } as CharacterSheet
    ],
    poolCharacters: [
        {
            characterId: "char-1",
            displayName: "Bäcker Bruno",
            roleType: "HELPER",
            slotKey: "SLOT_HELPER_1",
            personalityTags: ["gemütlich"],
            speechStyleHints: ["schmatzend", "warm"],
            enhancedPersonality: {
                dominant: "gemütlich",
                secondary: ["freundlich"],
                speechPatterns: ["schmatzend"],
                emotionalTriggers: ["Hunger"],
                dialogueStyle: "casual",
                catchphrase: "Frisch und knusprig!",
                quirk: "hat immer Mehl im Gesicht"
            },
            catchphrase: "Frisch und knusprig!",
            catchphraseContext: "beim Anbieten von Gebäck",
            visualSignature: [],
            outfitLock: [],
            forbidden: [],
        } as CharacterSheet,
        {
            characterId: "char-2",
            displayName: "Räuber Raubauke",
            roleType: "ANTAGONIST",
            slotKey: "SLOT_ANTAGONIST_1",
            personalityTags: ["frech"],
            speechStyleHints: ["polternd"],
            enhancedPersonality: {
                dominant: "frech",
                secondary: ["gierig"],
                speechPatterns: ["laut"],
                emotionalTriggers: ["Gold"],
                dialogueStyle: "grumpy",
                catchphrase: "Her mit dem Gold!",
                quirk: "spielt mit Münze"
            },
            catchphrase: "Her mit dem Gold!",
            // Context missing intentionally to test fallback/optional
            visualSignature: [],
            outfitLock: [],
            forbidden: []
        } as CharacterSheet
    ],
    artifact: {
        artifactId: "art-1",
        name: "Drachenauge",
        storyUseRule: "sieht weit",
        visualRule: "leuchtet",
    },
    slotAssignments: {}
};

const mockDirectives: SceneDirective[] = [
    {
        chapter: 1,
        setting: "Bäckerei",
        goal: "Kuchen kaufen",
        conflict: "Kein Mehl mehr",
        outcome: "Sie finden altes Mehl",
        charactersOnStage: ["SLOT_AVATAR_1", "SLOT_HELPER_1"],
        // artifactUsage: "nicht genutzt", // Optional
        canonAnchorLine: "",
        imageAvoid: [],
        imageMustShow: []
    } as any,
    {
        chapter: 2,
        setting: "Wald",
        goal: "Räuber finden",
        conflict: "Räuber ist stark",
        outcome: "Räuber läuft weg",
        charactersOnStage: ["SLOT_AVATAR_1", "SLOT_ANTAGONIST_1"],
        artifactUsage: "Drachenauge leuchtet",
        canonAnchorLine: "",
        imageAvoid: [],
        imageMustShow: []
    } as any
];

const mockDna: TaleDNA = {
    toneBounds: { targetTone: "Witzig", contentRules: [] }
} as any;

const prompt = buildFullStoryPrompt({
    directives: mockDirectives,
    cast: mockCast,
    dna: mockDna,
    language: "de",
    ageRange: { min: 6, max: 8 },
    totalWordTarget: 1400,
    totalWordMin: 1200,
    totalWordMax: 1600,
    wordsPerChapter: { min: 250, max: 350 },
    tone: "Abenteuerlich"
});

console.log(prompt);

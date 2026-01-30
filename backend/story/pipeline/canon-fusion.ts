// Canon-Fusion System V2 for Organic Character Integration
// Ensures characters feel like they "belong" to the story, not added on top
// V2: Personality-driven integration with dialogue cues, catchphrase placement, and emotional beats

import type {
    CastSet,
    SceneDirective,
    CanonFusionPlan,
    CanonFusionPlanV2,
    CharacterSheet,
    CharacterIntegrationPoint,
    CharacterIntegrationV2,
    ArtifactArcPlan,
    BeatType,
} from "./types";

// ─── Banned Phrases ────────────────────────────────────────────────────────
// These indicate "aufgeklebte" (pasted-on) characters - non-organic integration

export const CANON_FUSION_BANNED_PHRASES_DE = [
    "gehören seit jeher",
    "ganz selbstverständlich dabei",
    "schon immer teil",
    "wie schon immer",
    "natürlich gehören",
    "sie waren schon immer",
    "es war schon immer so",
    "als wäre es immer so gewesen",
    "als hätten sie schon immer",
    "wie eh und je",
    "schon immer dazugehört",
    "als ob sie immer schon",
];

export const CANON_FUSION_BANNED_PHRASES_EN = [
    "always been part of",
    "naturally belonged",
    "as if they had always",
    "they had always been",
    "from time immemorial",
    "since the beginning of time",
    "as it had always been",
    "fitting right in as always",
    "they belonged here since",
    "as if born into this world",
];

export const ALL_BANNED_PHRASES = [
    ...CANON_FUSION_BANNED_PHRASES_DE,
    ...CANON_FUSION_BANNED_PHRASES_EN
];

// ─── Motivation Map (personality → motivation) ─────────────────────────────

const MOTIVATION_MAP_DE: Record<string, string[]> = {
    neugierig: ["will unbedingt wissen, was hier passiert", "kann es kaum erwarten, das Geheimnis zu lüften", "stellt sofort tausend Fragen"],
    mutig: ["will das Abenteuer bestehen", "stellt sich der Herausforderung", "geht als Erste voran"],
    hilfsbereit: ["möchte den anderen helfen", "sieht sofort, wo Hilfe gebraucht wird", "springt ein, ohne zu zögern"],
    schüchtern: ["beobachtet erst einmal aus der Ferne", "traut sich langsam näher", "flüstert einen wichtigen Hinweis"],
    frech: ["mischt sich ungefragt ein", "hat direkt eine freche Idee", "grinst und prescht vor"],
    weise: ["erkennt sofort das wahre Problem", "wartet geduldig auf den richtigen Moment", "teilt eine alte Weisheit"],
    ängstlich: ["zittert, geht aber trotzdem mit", "klammert sich an einen Freund", "findet Mut in der Gruppe"],
    lustig: ["bringt alle zum Lachen mitten im Chaos", "macht einen Witz über die Gefahr", "lockert die angespannte Stimmung"],
    grummelig: ["brummt, dass alles Unsinn ist, hilft aber heimlich", "beschwert sich, geht aber mit", "tut so als interessiere es nicht"],
    verträumt: ["hat plötzlich eine Vision", "erinnert sich an ein altes Lied", "entdeckt etwas, das andere übersehen"],
    loyal: ["bleibt an der Seite des Freundes", "weicht nicht von der Gruppe", "verspricht, nie aufzugeben"],
    kreativ: ["hat eine unerwartete Idee", "bastelt etwas aus dem Nichts", "sieht eine Lösung, die niemand erwartet"],
};

const MOTIVATION_MAP_EN: Record<string, string[]> = {
    curious: ["wants to know what's happening", "can't wait to uncover the secret", "asks a dozen questions at once"],
    brave: ["wants to face the adventure", "steps forward without hesitation", "leads the way"],
    helpful: ["sees where help is needed", "jumps in without being asked", "reaches out a helping hand"],
    shy: ["watches from a distance first", "slowly dares to come closer", "whispers an important clue"],
    cheeky: ["barges in uninvited", "has a bold idea right away", "grins and rushes ahead"],
    wise: ["sees the real problem immediately", "waits patiently for the right moment", "shares ancient wisdom"],
    fearful: ["trembles but still comes along", "clings to a friend for support", "finds courage in the group"],
    funny: ["cracks a joke in the middle of chaos", "laughs about the danger", "lightens the tense mood"],
    grumpy: ["grumbles that it's all nonsense but secretly helps", "complains but tags along", "pretends not to care"],
    dreamy: ["has a sudden vision", "remembers an old song", "notices something others overlook"],
    loyal: ["stays by their friend's side", "never leaves the group", "promises never to give up"],
    creative: ["comes up with an unexpected idea", "crafts something from nothing", "sees a solution nobody expected"],
};

// ─── Action Map (role + personality → concrete action) ─────────────────────

const ACTION_TEMPLATES_DE: Record<string, Record<string, string[]>> = {
    HELPER: {
        default: ["gibt einen wertvollen Tipp", "reicht eine helfende Hand", "zeigt einen versteckten Weg"],
        neugierig: ["entdeckt einen Hinweis und teilt ihn", "findet ein verstecktes Detail"],
        mutig: ["stellt sich schützend vor die anderen", "geht voran, um den Weg zu prüfen"],
        schüchtern: ["flüstert einen entscheidenden Hinweis", "zeigt still auf die Lösung"],
    },
    MENTOR: {
        default: ["zeigt den richtigen Weg", "erzählt eine alte Weisheit", "stellt die richtige Frage"],
        weise: ["erkennt das Muster und erklärt es", "nickt wissend und deutet in die richtige Richtung"],
    },
    COMIC_RELIEF: {
        default: ["bringt alle zum Lachen", "stolpert über etwas Wichtiges", "löst das Problem aus Versehen"],
        lustig: ["macht einen Witz, der überraschend hilft", "lacht so laut, dass etwas passiert"],
        frech: ["provoziert den Gegner mit einem Spruch", "lenkt alle mit einer frechen Bemerkung ab"],
    },
    TRICKSTER: {
        default: ["spielt einen Streich", "tauscht heimlich etwas aus", "verwirrt den Gegner mit einer List"],
        frech: ["hat einen besonders frechen Plan", "grinst und dreht den Spieß um"],
    },
    PROTAGONIST: {
        default: ["trifft eine wichtige Entscheidung", "führt die Gruppe an", "löst das Rätsel"],
        mutig: ["stellt sich der größten Gefahr", "gibt nicht auf, auch wenn es schwer wird"],
        neugierig: ["entdeckt den entscheidenden Hinweis", "stellt die Frage, die alles verändert"],
    },
    AVATAR: {
        default: ["trifft eine wichtige Entscheidung", "hat eine besondere Idee", "zeigt eine neue Fähigkeit"],
        mutig: ["springt mutig ein", "beschützt einen Freund"],
        neugierig: ["entdeckt etwas Erstaunliches", "probiert etwas Neues aus"],
        hilfsbereit: ["hilft einem Freund in Not", "teilt großzügig"],
    },
};

const ACTION_TEMPLATES_EN: Record<string, Record<string, string[]>> = {
    HELPER: {
        default: ["provides a valuable hint", "offers a helping hand", "shows a hidden path"],
        curious: ["discovers a clue and shares it", "notices a hidden detail"],
        brave: ["stands protectively in front of others", "goes ahead to check the path"],
    },
    MENTOR: {
        default: ["shows the right way", "shares ancient wisdom", "asks the right question"],
    },
    COMIC_RELIEF: {
        default: ["makes everyone laugh", "stumbles over something important", "accidentally solves the problem"],
    },
    TRICKSTER: {
        default: ["plays a trick", "secretly swaps something", "confuses the opponent with a ruse"],
    },
    PROTAGONIST: {
        default: ["makes a crucial decision", "leads the group", "solves the riddle"],
    },
    AVATAR: {
        default: ["makes an important decision", "has a special idea", "shows a new ability"],
    },
};

// ─── Intro Style Templates ─────────────────────────────────────────────────

const INTRO_TEMPLATES_DE: Record<string, Record<string, string[]>> = {
    gradual: {
        HELPER: [
            `Aus dem Schatten tritt langsam ${"{name}"} hervor`,
            `Eine leise Stimme - es ist ${"{name}"}, die schon eine Weile zugehört hat`,
        ],
        MENTOR: [
            `${"{name}"} sitzt schon lange dort und beobachtet`,
            `Wie ein alter Bekannter erscheint ${"{name}"} am Wegesrand`,
        ],
        COMIC_RELIEF: [
            `Im Hintergrund raschelt etwas - ${"{name}"} versucht, nicht aufzufallen`,
        ],
        default: [
            `${"{name}"} ist schon da, als die anderen ankommen`,
            `Langsam wird ${"{name}"} in der Menge sichtbar`,
        ],
    },
    dramatic: {
        HELPER: [
            `Gerade als alles verloren scheint, springt ${"{name}"} aus dem Gebüsch`,
        ],
        MENTOR: [
            `Ein Blitz erhellt die Szene - und da steht ${"{name}"}`,
        ],
        COMIC_RELIEF: [
            `Mit einem lauten Krach fällt ${"{name}"} von einem Baum`,
        ],
        default: [
            `${"{name}"} erscheint genau im richtigen Moment`,
        ],
    },
    casual: {
        HELPER: [
            `${"{name}"} kommt zufällig vorbei`,
            `${"{name}"} bemerkt das Treiben und kommt näher`,
        ],
        default: [
            `${"{name}"} ist zufällig in der Nähe`,
        ],
    },
    mysterious: {
        MENTOR: [
            `Niemand hat ${"{name}"} kommen sehen - plötzlich ist sie einfach da`,
        ],
        default: [
            `${"{name}"} taucht wie aus dem Nichts auf`,
            `Woher ${"{name}"} kommt, weiß niemand so genau`,
        ],
    },
};

const INTRO_TEMPLATES_EN: Record<string, Record<string, string[]>> = {
    gradual: {
        default: [
            `${"{name}"} slowly steps out from the shadows`,
            `${"{name}"} has been watching quietly all along`,
        ],
    },
    dramatic: {
        default: [
            `Just when all seems lost, ${"{name}"} leaps in`,
            `${"{name}"} appears at exactly the right moment`,
        ],
    },
    casual: {
        default: [
            `${"{name}"} happens to pass by`,
            `${"{name}"} notices the commotion and comes closer`,
        ],
    },
    mysterious: {
        default: [
            `Nobody saw ${"{name}"} arrive - suddenly they're just there`,
            `Where ${"{name}"} came from, nobody knows`,
        ],
    },
};

// ─── V1: Original createCanonFusionPlan (backward compatible) ──────────────

/**
 * Creates a V1 Canon-Fusion plan. Kept for backward compatibility.
 */
export function createCanonFusionPlan(input: {
    cast: CastSet;
    directives: SceneDirective[];
    language: string;
}): CanonFusionPlan {
    const { cast, directives, language } = input;
    const isGerman = language === "de";

    const characterIntegrations: CanonFusionPlan["characterIntegrations"] = [];
    const allCharacters = [...cast.avatars, ...cast.poolCharacters];

    for (const character of allCharacters) {
        const chaptersOnStage = directives
            .filter(d => d.charactersOnStage.includes(character.slotKey))
            .map(d => d.chapter);

        if (chaptersOnStage.length === 0) continue;

        const firstChapter = Math.min(...chaptersOnStage);
        const lastChapter = Math.max(...chaptersOnStage);

        const firstDirective = directives.find(d => d.chapter === firstChapter)!;
        const entryPoint = createEntryPointV1(character, firstDirective, isGerman);

        const activeChapters: CharacterIntegrationPoint[] = [];
        for (const chapter of chaptersOnStage) {
            if (chapter === firstChapter) continue;
            const directive = directives.find(d => d.chapter === chapter)!;
            activeChapters.push(createActiveChapterPointV1(character, directive, isGerman));
        }

        const totalChapters = directives.length;
        let exitPoint: CanonFusionPlan["characterIntegrations"][0]["exitPoint"];
        if (lastChapter < totalChapters) {
            exitPoint = {
                chapter: lastChapter,
                farewell: isGerman ? generateFarewellDE(character) : generateFarewellEN(character)
            };
        }

        characterIntegrations.push({
            characterId: character.characterId,
            displayName: character.displayName,
            entryPoint,
            activeChapters,
            exitPoint
        });
    }

    let artifactArc: CanonFusionPlan["artifactArc"];
    if (cast.artifact) {
        artifactArc = createArtifactArcV1(cast.artifact, directives);
    }

    return {
        characterIntegrations,
        artifactArc,
        bannedPhrases: isGerman ? CANON_FUSION_BANNED_PHRASES_DE : CANON_FUSION_BANNED_PHRASES_EN
    };
}

// ─── V2: Enhanced Canon-Fusion with personality-driven integration ─────────

/**
 * Creates an enhanced V2 Canon-Fusion plan with:
 * - Personality-driven entry hooks (intro style)
 * - Dialogue cues per chapter
 * - Catchphrase placement (max 1x per story)
 * - Emotional beats per chapter
 * - Enhanced artifact mini-arc
 */
export function createCanonFusionPlanV2(input: {
    cast: CastSet;
    directives: SceneDirective[];
    language: string;
    totalChapters: number;
}): CanonFusionPlanV2 {
    const { cast, directives, language, totalChapters } = input;
    const isGerman = language === "de";

    const characterIntegrations: CharacterIntegrationV2[] = [];
    const allCharacters = [...cast.avatars, ...cast.poolCharacters];
    const chaptersWithCatchphrases: number[] = [];

    // Determine catchphrase chapter: pick the most impactful chapter per character
    // Only ONE catchphrase use per character per entire story
    let catchphraseAssigned = new Set<string>();

    for (const character of allCharacters) {
        const chaptersOnStage = directives
            .filter(d => d.charactersOnStage.includes(character.slotKey))
            .map(d => d.chapter);

        if (chaptersOnStage.length === 0) continue;

        const firstChapter = Math.min(...chaptersOnStage);
        const lastChapter = Math.max(...chaptersOnStage);
        const personality = character.enhancedPersonality || {
            dominant: character.personalityTags?.[0] || "neugierig",
            secondary: character.personalityTags?.slice(1) || [],
            speechPatterns: character.speechStyleHints || [],
            emotionalTriggers: [],
            dialogueStyle: "casual" as const,
        };

        const introStyle = resolveIntroStyle(character);
        const catchphrase = character.catchphrase || character.enhancedPersonality?.catchphrase;

        // Determine best chapter for catchphrase (climax or most dramatic)
        let catchphraseChapter: number | undefined;
        if (catchphrase && !catchphraseAssigned.has(character.characterId)) {
            catchphraseChapter = pickCatchphraseChapter(chaptersOnStage, directives);
            catchphraseAssigned.add(character.characterId);
            if (catchphraseChapter) chaptersWithCatchphrases.push(catchphraseChapter);
        }

        // Create entry point with personality-driven intro
        const firstDirective = directives.find(d => d.chapter === firstChapter)!;
        const entryPoint = createEntryPointV2(character, firstDirective, isGerman, introStyle);

        // Create active chapters with dialogue cues and emotional beats
        const activeChapters: CharacterIntegrationV2["activeChapters"] = [];
        for (const chapter of chaptersOnStage) {
            if (chapter === firstChapter) continue;

            const directive = directives.find(d => d.chapter === chapter)!;
            const isCatchphraseChapter = chapter === catchphraseChapter;

            activeChapters.push(createActiveChapterPointV2(
                character,
                directive,
                isGerman,
                isCatchphraseChapter,
                catchphrase,
            ));
        }

        // Create exit point with emotional note
        let exitPoint: CharacterIntegrationV2["exitPoint"];
        if (lastChapter < totalChapters) {
            exitPoint = createExitPointV2(character, lastChapter, isGerman);
        }

        characterIntegrations.push({
            characterId: character.characterId,
            displayName: character.displayName,
            personalityProfile: {
                dominant: personality.dominant,
                catchphrase,
                speechStyle: personality.speechPatterns || [],
                quirk: undefined, // Filled from PoolCharacterV2 if available
            },
            entryPoint,
            activeChapters,
            exitPoint,
        });
    }

    // Build artifact arc
    let artifactArc: ArtifactArcPlan | undefined;
    if (cast.artifact) {
        artifactArc = createArtifactArcV2(cast.artifact, directives, totalChapters);
    }

    // Count dialogue cues
    const totalDialogueCues = characterIntegrations.reduce(
        (sum, ci) => sum + ci.activeChapters.filter(ac => ac.dialogueCue).length,
        0
    );

    return {
        characterIntegrations,
        artifactArc,
        bannedPhrases: isGerman ? CANON_FUSION_BANNED_PHRASES_DE : CANON_FUSION_BANNED_PHRASES_EN,
        fusionSummary: {
            characterCount: characterIntegrations.length,
            artifactActive: !!artifactArc,
            chaptersWithCatchphrases,
            totalDialogueCues,
        },
    };
}

// ─── V2 Entry Point Creation ───────────────────────────────────────────────

function createEntryPointV2(
    character: CharacterSheet,
    directive: SceneDirective,
    isGerman: boolean,
    introStyle: "gradual" | "dramatic" | "casual" | "mysterious",
): CharacterIntegrationV2["entryPoint"] {
    const templates = isGerman ? INTRO_TEMPLATES_DE : INTRO_TEMPLATES_EN;
    const styleTemplates = templates[introStyle] || templates.casual;
    const roleKey = character.roleType as string;
    const pool = styleTemplates[roleKey] || styleTemplates.default || [`${character.displayName} erscheint`];
    const hook = pool[Math.floor(Math.random() * pool.length)]
        .replace(/\{name\}/g, character.displayName);

    const motivation = generateMotivationV2(character, directive, isGerman);
    const action = generateConcreteActionV2(character, directive, isGerman);

    return {
        chapter: directive.chapter,
        narrativeHook: hook,
        motivation,
        concreteAction: action,
        plotInfluence: directive.goal,
        introStyle,
    };
}

// ─── V2 Active Chapter Point ───────────────────────────────────────────────

function createActiveChapterPointV2(
    character: CharacterSheet,
    directive: SceneDirective,
    isGerman: boolean,
    useCatchphrase: boolean,
    catchphrase?: string,
): CharacterIntegrationV2["activeChapters"][number] {
    const motivation = generateMotivationV2(character, directive, isGerman);
    const action = generateConcreteActionV2(character, directive, isGerman);
    const dialogueCue = generateDialogueCue(character, directive, isGerman);
    const emotionalBeat = resolveEmotionalBeat(directive, character, isGerman);

    return {
        chapter: directive.chapter,
        narrativeHook: "",
        motivation,
        concreteAction: action,
        plotInfluence: directive.conflict || directive.goal,
        dialogueCue,
        catchphraseUse: useCatchphrase && !!catchphrase,
        emotionalBeat,
    };
}

// ─── V2 Exit Point ─────────────────────────────────────────────────────────

function createExitPointV2(
    character: CharacterSheet,
    chapter: number,
    isGerman: boolean,
): CharacterIntegrationV2["exitPoint"] {
    const personality = character.enhancedPersonality?.dominant || "neutral";

    const farewellsDE: Record<string, string[]> = {
        mutig: [
            `${character.displayName} winkt entschlossen und geht weiter`,
            `${character.displayName} nickt zum Abschied und macht sich auf den Weg`,
        ],
        schüchtern: [
            `${character.displayName} lächelt schüchtern und verschwindet leise`,
            `${character.displayName} winkt ganz kurz und huscht davon`,
        ],
        lustig: [
            `${character.displayName} macht noch einen letzten Witz und hüpft davon`,
            `${character.displayName} ruft lachend "Bis bald!" und ist weg`,
        ],
        grummelig: [
            `${character.displayName} brummt "Na dann" und trottet davon`,
            `${character.displayName} dreht sich ohne ein Wort um, hebt aber kurz die Hand`,
        ],
        default: [
            `${character.displayName} winkt zum Abschied`,
            `${character.displayName} muss weiter, verspricht aber wiederzukommen`,
            `${character.displayName} verschwindet leise in der Ferne`,
        ],
    };

    const farewellsEN: Record<string, string[]> = {
        brave: [
            `${character.displayName} waves determinedly and moves on`,
        ],
        shy: [
            `${character.displayName} smiles shyly and slips away quietly`,
        ],
        funny: [
            `${character.displayName} cracks one last joke and bounces away`,
        ],
        grumpy: [
            `${character.displayName} grunts "Well then" and trudges off`,
        ],
        default: [
            `${character.displayName} waves goodbye`,
            `${character.displayName} has to go, but promises to return`,
        ],
    };

    const pool = isGerman
        ? (farewellsDE[personality] || farewellsDE.default)
        : (farewellsEN[personality] || farewellsEN.default);

    const farewell = pool[Math.floor(Math.random() * pool.length)];

    const emotionalNotes: Record<string, string> = isGerman
        ? { mutig: "entschlossen", schüchtern: "leise hoffnungsvoll", lustig: "fröhlich", grummelig: "verborgen warmherzig", default: "traurig aber hoffnungsvoll" }
        : { brave: "determined", shy: "quietly hopeful", funny: "cheerful", grumpy: "secretly warm", default: "sad but hopeful" };

    return {
        chapter,
        farewell,
        emotionalNote: emotionalNotes[personality] || emotionalNotes.default,
    };
}

// ─── V2 Motivation Generation ──────────────────────────────────────────────

function generateMotivationV2(
    character: CharacterSheet,
    directive: SceneDirective,
    isGerman: boolean,
): string {
    const dominant = character.enhancedPersonality?.dominant
        || character.personalityTags?.[0]
        || (isGerman ? "neugierig" : "curious");

    const map = isGerman ? MOTIVATION_MAP_DE : MOTIVATION_MAP_EN;
    const pool = map[dominant] || map[isGerman ? "neugierig" : "curious"] || [];

    if (pool.length === 0) {
        return isGerman ? "hat einen Grund hier zu sein" : "has a reason to be here";
    }

    return pool[Math.floor(Math.random() * pool.length)];
}

// ─── V2 Concrete Action Generation ────────────────────────────────────────

function generateConcreteActionV2(
    character: CharacterSheet,
    directive: SceneDirective,
    isGerman: boolean,
): string {
    const role = character.roleType as string;
    const dominant = character.enhancedPersonality?.dominant
        || character.personalityTags?.[0]
        || (isGerman ? "neugierig" : "curious");

    const templates = isGerman ? ACTION_TEMPLATES_DE : ACTION_TEMPLATES_EN;
    const roleTemplates = templates[role] || templates.AVATAR || { default: ["tut etwas Sichtbares"] };

    // Try personality-specific action first, fall back to default
    const pool = roleTemplates[dominant] || roleTemplates.default || [];
    if (pool.length === 0) {
        return isGerman ? "tut etwas Sichtbares" : "does something visible";
    }

    return pool[Math.floor(Math.random() * pool.length)];
}

// ─── Dialogue Cue Generation ───────────────────────────────────────────────

function generateDialogueCue(
    character: CharacterSheet,
    directive: SceneDirective,
    isGerman: boolean,
): string | undefined {
    const personality = character.enhancedPersonality;
    if (!personality) return undefined;

    const style = personality.dialogueStyle || "casual";
    const dominant = personality.dominant;

    // Generate a dialogue cue hint based on personality
    const cuesDE: Record<string, Record<string, string>> = {
        casual: {
            neugierig: "stellt eine neugierige Frage über das Geschehen",
            mutig: "macht einen entschlossenen Vorschlag",
            hilfsbereit: "bietet freundlich Hilfe an",
            frech: "macht eine freche Bemerkung",
            default: "sagt etwas Passendes zur Situation",
        },
        formal: {
            weise: "gibt einen bedachten Rat",
            default: "spricht förmlich und klar",
        },
        playful: {
            lustig: "macht einen Witz über die Lage",
            frech: "neckt jemanden liebevoll",
            default: "sagt etwas Verspieltes",
        },
        wise: {
            weise: "teilt eine bedeutungsvolle Erkenntnis",
            default: "gibt einen weisen Hinweis",
        },
        grumpy: {
            grummelig: "brummt etwas Unzufriedenes, das aber hilft",
            default: "antwortet knapp aber treffend",
        },
    };

    const cuesEN: Record<string, Record<string, string>> = {
        casual: {
            curious: "asks a curious question about what's happening",
            brave: "makes a determined suggestion",
            helpful: "kindly offers help",
            cheeky: "makes a cheeky remark",
            default: "says something fitting",
        },
        formal: { default: "speaks formally and clearly" },
        playful: { default: "says something playful" },
        wise: { default: "shares a meaningful insight" },
        grumpy: { default: "grumbles something unhelpful-sounding but useful" },
    };

    const cues = isGerman ? cuesDE : cuesEN;
    const styleCues = cues[style] || cues.casual;
    return styleCues[dominant] || styleCues.default;
}

// ─── Emotional Beat Resolution ─────────────────────────────────────────────

function resolveEmotionalBeat(
    directive: SceneDirective,
    character: CharacterSheet,
    isGerman: boolean,
): string | undefined {
    const mood = directive.mood;
    if (!mood) return undefined;

    const dominant = character.enhancedPersonality?.dominant || "";

    const beatsDE: Record<string, Record<string, string>> = {
        TENSE: {
            mutig: "überwindet die Angst",
            schüchtern: "zittert, aber bleibt standhaft",
            ängstlich: "klammert sich an, findet dann Mut",
            default: "spürt die Anspannung",
        },
        FUNNY: {
            lustig: "ist in seinem Element",
            grummelig: "kann ein Schmunzeln nicht unterdrücken",
            default: "lacht mit",
        },
        SAD: {
            hilfsbereit: "tröstet einen anderen",
            ängstlich: "weint leise",
            mutig: "hält die Tränen zurück",
            default: "ist betroffen",
        },
        TRIUMPH: {
            mutig: "jubelt laut",
            schüchtern: "lächelt still und zufrieden",
            lustig: "tanzt vor Freude",
            default: "ist erleichtert und glücklich",
        },
        COZY: { default: undefined },
        WONDER: { default: "staunt" },
        MYSTERIOUS: { default: "horcht auf" },
        SCARY_LIGHT: {
            mutig: "stellt sich der Angst",
            ängstlich: "versteckt sich hinter einem Freund",
            default: "ist nervös",
        },
        SCARY_HEAVY: {
            mutig: "schützt die anderen",
            default: "hat Angst, gibt aber nicht auf",
        },
    };

    const beatsEN: Record<string, Record<string, string>> = {
        TENSE: { default: "feels the tension" },
        FUNNY: { default: "laughs along" },
        SAD: { default: "is moved" },
        TRIUMPH: { default: "is relieved and happy" },
        COZY: { default: undefined },
        WONDER: { default: "is amazed" },
        MYSTERIOUS: { default: "listens carefully" },
        SCARY_LIGHT: { default: "feels nervous" },
        SCARY_HEAVY: { default: "is scared but doesn't give up" },
    };

    const beats = isGerman ? beatsDE : beatsEN;
    const moodBeats = beats[mood] || {};
    return moodBeats[dominant] || moodBeats.default;
}

// ─── Catchphrase Chapter Selection ─────────────────────────────────────────

function pickCatchphraseChapter(
    chaptersOnStage: number[],
    directives: SceneDirective[],
): number | undefined {
    if (chaptersOnStage.length === 0) return undefined;

    // Prefer climax or twist chapters for catchphrase
    const moodPriority: Record<string, number> = {
        TRIUMPH: 5,
        TENSE: 4,
        MYSTERIOUS: 3,
        FUNNY: 2,
    };

    let bestChapter = chaptersOnStage[0];
    let bestScore = 0;

    for (const ch of chaptersOnStage) {
        const directive = directives.find(d => d.chapter === ch);
        if (!directive?.mood) continue;
        const score = moodPriority[directive.mood] || 1;
        if (score > bestScore) {
            bestScore = score;
            bestChapter = ch;
        }
    }

    return bestChapter;
}

// ─── Intro Style Resolution ───────────────────────────────────────────────

function resolveIntroStyle(character: CharacterSheet): "gradual" | "dramatic" | "casual" | "mysterious" {
    const role = character.roleType;

    // Default intro style by role type
    switch (role) {
        case "MENTOR": return "mysterious";
        case "COMIC_RELIEF": return "dramatic";
        case "TRICKSTER": return "mysterious";
        case "GUARDIAN": return "gradual";
        case "PROTAGONIST":
        case "AVATAR": return "casual";
        default: return "casual";
    }
}

// ─── V2 Artifact Arc ──────────────────────────────────────────────────────

function createArtifactArcV2(
    artifact: CastSet["artifact"],
    directives: SceneDirective[],
    totalChapters: number,
): ArtifactArcPlan {
    const artifactChapters = directives
        .filter(d => d.artifactUsage && !d.artifactUsage.toLowerCase().includes("nicht") && !d.artifactUsage.toLowerCase().includes("not used"))
        .map(d => d.chapter);

    const discoveryChapter = Math.min(2, totalChapters);
    const failureChapter = Math.min(
        Math.max(discoveryChapter + 1, Math.floor(totalChapters / 2)),
        totalChapters - 1
    );
    const successChapter = Math.max(failureChapter + 1, totalChapters - 1);

    const activeChapters = Array.from(
        new Set([discoveryChapter, failureChapter, successChapter, ...artifactChapters])
    )
        .filter(ch => ch >= 1 && ch <= totalChapters)
        .sort((a, b) => a - b);

    return {
        artifactId: artifact.artifactId,
        artifactName: artifact.name,
        discoveryChapter,
        discoveryMethod: `entdeckt ${artifact.name}`,
        failureChapter,
        failureReason: `${artifact.name} funktioniert noch nicht richtig`,
        successChapter,
        successMethod: `${artifact.name} hilft bei der Lösung`,
        activeChapters,
    };
}

// ─── V2 → Prompt Text Conversion ──────────────────────────────────────────

/**
 * Converts a CanonFusionPlanV2 into injectable prompt sections per chapter.
 * This is used by the story writer to embed fusion directives into the AI prompt.
 */
export function fusionPlanToPromptSections(
    plan: CanonFusionPlanV2,
    language: string,
): Map<number, string> {
    const isGerman = language === "de";
    const sections = new Map<number, string>();

    for (const ci of plan.characterIntegrations) {
        // Entry chapter
        const entryChapter = ci.entryPoint.chapter;
        const entryLines: string[] = [];
        entryLines.push(isGerman
            ? `FIGUR-EINTRITT (${ci.displayName}): ${ci.entryPoint.narrativeHook}`
            : `CHARACTER ENTRY (${ci.displayName}): ${ci.entryPoint.narrativeHook}`);
        entryLines.push(isGerman
            ? `  Motivation: ${ci.entryPoint.motivation}`
            : `  Motivation: ${ci.entryPoint.motivation}`);
        entryLines.push(isGerman
            ? `  Aktion: ${ci.entryPoint.concreteAction}`
            : `  Action: ${ci.entryPoint.concreteAction}`);

        appendToSection(sections, entryChapter, entryLines.join("\n"));

        // Active chapters
        for (const ac of ci.activeChapters) {
            const lines: string[] = [];
            lines.push(isGerman
                ? `${ci.displayName}: ${ac.concreteAction}`
                : `${ci.displayName}: ${ac.concreteAction}`);

            if (ac.dialogueCue) {
                lines.push(isGerman
                    ? `  Dialog-Hinweis: ${ac.dialogueCue}`
                    : `  Dialogue cue: ${ac.dialogueCue}`);
            }
            if (ac.catchphraseUse && ci.personalityProfile.catchphrase) {
                lines.push(isGerman
                    ? `  CATCHPHRASE (genau 1x verwenden!): "${ci.personalityProfile.catchphrase}"`
                    : `  CATCHPHRASE (use exactly once!): "${ci.personalityProfile.catchphrase}"`);
            }
            if (ac.emotionalBeat) {
                lines.push(isGerman
                    ? `  Emotionaler Moment: ${ac.emotionalBeat}`
                    : `  Emotional beat: ${ac.emotionalBeat}`);
            }

            appendToSection(sections, ac.chapter, lines.join("\n"));
        }

        // Exit chapter
        if (ci.exitPoint) {
            const exitLine = isGerman
                ? `FIGUR-ABSCHIED (${ci.displayName}): ${ci.exitPoint.farewell} [${ci.exitPoint.emotionalNote}]`
                : `CHARACTER EXIT (${ci.displayName}): ${ci.exitPoint.farewell} [${ci.exitPoint.emotionalNote}]`;
            appendToSection(sections, ci.exitPoint.chapter, exitLine);
        }
    }

    // Artifact arc sections
    if (plan.artifactArc) {
        const arc = plan.artifactArc;
        appendToSection(sections, arc.discoveryChapter, isGerman
            ? `ARTEFAKT-ENTDECKUNG: ${arc.discoveryMethod}`
            : `ARTIFACT DISCOVERY: ${arc.discoveryMethod}`);
        appendToSection(sections, arc.failureChapter, isGerman
            ? `ARTEFAKT-SCHEITERN: ${arc.failureReason}`
            : `ARTIFACT FAILURE: ${arc.failureReason}`);
        appendToSection(sections, arc.successChapter, isGerman
            ? `ARTEFAKT-ERFOLG: ${arc.successMethod}`
            : `ARTIFACT SUCCESS: ${arc.successMethod}`);
    }

    return sections;
}

function appendToSection(sections: Map<number, string>, chapter: number, text: string) {
    const existing = sections.get(chapter) || "";
    sections.set(chapter, existing ? `${existing}\n${text}` : text);
}

// ─── Validate Text for Banned Phrases ──────────────────────────────────────

/**
 * Validate text for banned phrases that indicate non-organic integration
 */
export function detectBannedPhrases(text: string, language: string): string[] {
    const phrases = language === "de"
        ? CANON_FUSION_BANNED_PHRASES_DE
        : CANON_FUSION_BANNED_PHRASES_EN;

    const lowerText = text.toLowerCase();
    return phrases.filter(phrase => lowerText.includes(phrase.toLowerCase()));
}

// ─── V1 Helper Functions (kept for backward compatibility) ─────────────────

function createEntryPointV1(
    character: CharacterSheet,
    directive: SceneDirective,
    isGerman: boolean
): CharacterIntegrationPoint {
    const hookTemplates = isGerman ? {
        HELPER: [
            `${character.displayName} bemerkt das Problem und kommt näher`,
            `Zufällig ist ${character.displayName} in der Nähe`,
            `${character.displayName} hört die Stimmen und wird neugierig`
        ],
        MENTOR: [
            `${character.displayName} beobachtet die Situation von einem Hügel`,
            `${character.displayName} erscheint wie aus dem Nichts`,
        ],
        COMIC_RELIEF: [
            `${character.displayName} stolpert in die Szene`,
            `${character.displayName} folgt einem interessanten Geruch`
        ],
        PROTAGONIST: [`${character.displayName} ist bereits da`],
        AVATAR: [`${character.displayName} ist dabei`]
    } : {
        HELPER: [
            `${character.displayName} notices the problem and approaches`,
            `By chance, ${character.displayName} is nearby`,
        ],
        MENTOR: [`${character.displayName} observes from a distance`],
        COMIC_RELIEF: [`${character.displayName} stumbles into the scene`],
        PROTAGONIST: [`${character.displayName} is already there`],
        AVATAR: [`${character.displayName} is present`]
    };

    const role = character.roleType as keyof typeof hookTemplates;
    const templates = hookTemplates[role] || hookTemplates.HELPER;
    const hook = templates[Math.floor(Math.random() * templates.length)];

    return {
        chapter: directive.chapter,
        narrativeHook: hook,
        motivation: generateMotivationV1(character, directive, isGerman),
        concreteAction: generateConcreteActionV1(character, directive, isGerman),
        plotInfluence: directive.goal
    };
}

function createActiveChapterPointV1(
    character: CharacterSheet,
    directive: SceneDirective,
    isGerman: boolean
): CharacterIntegrationPoint {
    return {
        chapter: directive.chapter,
        narrativeHook: "",
        motivation: generateMotivationV1(character, directive, isGerman),
        concreteAction: generateConcreteActionV1(character, directive, isGerman),
        plotInfluence: directive.conflict || directive.goal
    };
}

function generateMotivationV1(
    character: CharacterSheet,
    directive: SceneDirective,
    isGerman: boolean
): string {
    const personality = character.enhancedPersonality || {
        dominant: character.personalityTags?.[0] || "curious"
    };

    if (isGerman) {
        switch (personality.dominant) {
            case "neugierig": case "curious": return "will wissen, was passiert";
            case "hilfsbereit": case "helpful": return "möchte helfen";
            case "mutig": case "brave": return "will das Abenteuer bestehen";
            default: return "hat einen Grund hier zu sein";
        }
    } else {
        switch (personality.dominant) {
            case "curious": return "wants to know what's happening";
            case "helpful": return "wants to help";
            case "brave": return "wants to face the adventure";
            default: return "has a reason to be here";
        }
    }
}

function generateConcreteActionV1(
    character: CharacterSheet,
    directive: SceneDirective,
    isGerman: boolean
): string {
    const role = character.roleType;
    if (isGerman) {
        switch (role) {
            case "HELPER": return "gibt einen wertvollen Tipp";
            case "MENTOR": return "zeigt den richtigen Weg";
            case "COMIC_RELIEF": return "bringt alle zum Lachen";
            case "PROTAGONIST": case "AVATAR": return "trifft eine wichtige Entscheidung";
            default: return "tut etwas Sichtbares";
        }
    } else {
        switch (role) {
            case "HELPER": return "provides a valuable hint";
            case "MENTOR": return "shows the right path";
            case "COMIC_RELIEF": return "makes everyone laugh";
            case "PROTAGONIST": case "AVATAR": return "makes an important decision";
            default: return "does something visible";
        }
    }
}

function generateFarewellDE(character: CharacterSheet): string {
    const templates = [
        `${character.displayName} winkt zum Abschied`,
        `${character.displayName} muss weiter, verspricht aber wiederzukommen`,
        `${character.displayName} verschwindet leise in der Ferne`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
}

function generateFarewellEN(character: CharacterSheet): string {
    const templates = [
        `${character.displayName} waves goodbye`,
        `${character.displayName} has to go, but promises to return`,
        `${character.displayName} quietly disappears into the distance`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
}

function createArtifactArcV1(
    artifact: CastSet["artifact"],
    directives: SceneDirective[]
): CanonFusionPlan["artifactArc"] {
    const artifactChapters = directives
        .filter(d => d.artifactUsage && !d.artifactUsage.toLowerCase().includes("nicht"))
        .map(d => d.chapter);

    if (artifactChapters.length === 0) {
        return {
            discoveryChapter: 1,
            discoveryMethod: "wird gefunden",
            successChapter: directives.length,
            successMethod: "hilft am Ende"
        };
    }

    const firstMention = Math.min(...artifactChapters);
    const lastMention = Math.max(...artifactChapters);

    return {
        discoveryChapter: Math.min(2, firstMention),
        discoveryMethod: `entdeckt das ${artifact.name}`,
        failureChapter: Math.max(2, Math.floor(directives.length / 2)),
        failureReason: `${artifact.name} funktioniert noch nicht richtig`,
        successChapter: Math.max(lastMention, directives.length - 1),
        successMethod: `${artifact.name} hilft bei der Lösung`
    };
}

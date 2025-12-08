/**
 * PROFESSIONAL STORYTELLING RULES v2.0
 *
 * Based on research from:
 * - OpenAI GPT-5 Prompting Guide (https://cookbook.openai.com/examples/gpt-5/gpt-5_prompting_guide)
 * - Children's book best practices (Astrid Lindgren, Julia Donaldson, Otfried Preußler)
 * - Prompt Engineering for Creative Writing
 *
 * Key Insight: GPT-5 follows prompts with "surgical precision" - poorly constructed
 * instructions are more damaging than with other models. Remove contradictory directives.
 *
 * IMPORTANT: All prompts should be in ENGLISH for better AI understanding.
 * The generated story content will be in the target language (German, Russian, etc.).
 */

// ============================================================================
// CRITICAL ANTI-PATTERNS TO PREVENT
// ============================================================================

/**
 * These patterns MUST be blocked in the output - they indicate the AI
 * is outputting its internal instructions instead of proper prose.
 * Patterns cover multiple languages (German, English, Russian).
 */
export const FORBIDDEN_OUTPUT_PATTERNS = [
  // Meta-instruction labels that leak into output (GERMAN)
  /^Dialoge:\s*/gm,
  /^Sensorische Details:\s*/gm,
  /^Hindernis(?:-Teaser)?:\s*/gm,
  /^Gefahr:\s*/gm,
  /^Sinne:\s*/gm,
  /^Moral(?:ische Lektion)?:\s*/gm,
  /^Konflikt:\s*/gm,
  /^Wendung:\s*/gm,
  /^Cliffhanger:\s*/gm,
  /^Emotionen?:\s*/gm,
  /^Setting:\s*/gm,
  /^Stimmung:\s*/gm,
  /^Handlung:\s*/gm,

  // Meta-instruction labels (ENGLISH)
  /^Dialogues?:\s*/gm,
  /^Sensory [Dd]etails?:\s*/gm,
  /^Obstacle(?:-[Tt]easer)?:\s*/gm,
  /^Danger:\s*/gm,
  /^Senses?:\s*/gm,
  /^Moral(?:\s+[Ll]esson)?:\s*/gm,
  /^Conflict:\s*/gm,
  /^Twist:\s*/gm,
  /^Emotions?:\s*/gm,
  /^Plot:\s*/gm,
  /^Mood:\s*/gm,
  /^Action:\s*/gm,

  // Meta-instruction labels (RUSSIAN)
  /^Диалоги?:\s*/gm,
  /^Сенсорные детали:\s*/gm,
  /^Препятствие:\s*/gm,
  /^Опасность:\s*/gm,
  /^Чувства:\s*/gm,
  /^Мораль:\s*/gm,

  // Numbered/bulleted dialogue lists (German)
  /\(\d+\)\s*["„"][^"]*[""].*,\s*(?:sagte|flüsterte|rief)/gm,
  /Dialoge?:\s*\(\d+\)/gm,

  // Numbered/bulleted dialogue lists (English)
  /\(\d+\)\s*[""][^"]*[""].*,\s*(?:said|whispered|shouted)/gm,
  /Dialogues?:\s*\(\d+\)/gm,

  // Comma-separated sensory lists (German)
  /(?:riecht|schmeckt|fühlt|klingt|sieht)\s+nach\s+[\w\s,]+,\s+[\w\s,]+,\s+[\w\s,]+/gm,

  // Comma-separated sensory lists (English)
  /(?:smells?|tastes?|feels?|sounds?|looks?)\s+like\s+[\w\s,]+,\s+[\w\s,]+,\s+[\w\s,]+/gm,
];

/**
 * Check if text contains forbidden meta-patterns
 */
export function containsMetaPatterns(text: string): { hasMeta: boolean; patterns: string[] } {
  const foundPatterns: string[] = [];

  for (const pattern of FORBIDDEN_OUTPUT_PATTERNS) {
    if (pattern.test(text)) {
      foundPatterns.push(pattern.source);
      pattern.lastIndex = 0; // Reset regex state
    }
  }

  return {
    hasMeta: foundPatterns.length > 0,
    patterns: foundPatterns
  };
}

// ============================================================================
// AGE-APPROPRIATE LANGUAGE RULES
// ============================================================================

export interface AgeGroupRules {
  ageGroup: string;
  maxWordsPerSentence: number;
  shortSentenceRatio: number;  // Percentage of sentences with <= 7 words
  mediumSentenceRatio: number; // Percentage of sentences with 8-15 words
  longSentenceRatio: number;   // Percentage of sentences with 16-25 words
  forbiddenConcepts: string[];
  vocabularyLevel: 'basic' | 'intermediate' | 'advanced';
  abstractionAllowed: boolean;
  maxMetaphorsPerChapter: number;
  dialogueMinimum: number; // Minimum dialogues per chapter
}

export const AGE_GROUP_RULES: Record<string, AgeGroupRules> = {
  '3-5': {
    ageGroup: '3-5',
    maxWordsPerSentence: 10,
    shortSentenceRatio: 0.7,  // 70% short sentences
    mediumSentenceRatio: 0.25,
    longSentenceRatio: 0.05,
    forbiddenConcepts: ['death', 'war', 'blood', 'violence', 'murder'],
    vocabularyLevel: 'basic',
    abstractionAllowed: false,
    maxMetaphorsPerChapter: 1,
    dialogueMinimum: 2,
  },
  '6-8': {
    ageGroup: '6-8',
    maxWordsPerSentence: 15,
    shortSentenceRatio: 0.5,  // 50% short sentences
    mediumSentenceRatio: 0.4,
    longSentenceRatio: 0.1,
    forbiddenConcepts: ['explicit violence', 'war', 'horror'],
    vocabularyLevel: 'intermediate',
    abstractionAllowed: false,
    maxMetaphorsPerChapter: 2,
    dialogueMinimum: 3,
  },
  '9-12': {
    ageGroup: '9-12',
    maxWordsPerSentence: 25,
    shortSentenceRatio: 0.35,
    mediumSentenceRatio: 0.45,
    longSentenceRatio: 0.2,
    forbiddenConcepts: ['explicit violence', 'horror'],
    vocabularyLevel: 'advanced',
    abstractionAllowed: true,
    maxMetaphorsPerChapter: 4,
    dialogueMinimum: 3,
  },
};

// ============================================================================
// TITLE GENERATION RULES
// ============================================================================

export const TITLE_RULES = {
  maxWords: 4,
  forbiddenPatterns: [
    // German patterns
    /^[\w]+ und das? /i,      // "Adrian und das...", "Adrian und die..."
    /^[\w]+ und der /i,       // "Adrian und der..."
    /^Die Geschichte von/i,   // "Die Geschichte von..."
    /^Das Abenteuer/i,        // "Das Abenteuer..."
    /^[\w]+s? Abenteuer/i,    // "Adrians Abenteuer"
    // English patterns
    /^[\w]+ and the /i,       // "Adrian and the..."
    /^The Story of/i,         // "The Story of..."
    /^The Adventure/i,        // "The Adventure..."
    /^[\w]+'s Adventure/i,    // "Adrian's Adventure"
    // Russian patterns
    /^[\w]+ и /i,             // "Адриан и..."
    /^История о/i,            // "История о..."
    /^Приключения/i,          // "Приключения..."
  ],
  goodExamples: [
    'The Whispering Forest',
    'Stardust',
    'The Moon Bridge',
    'Rumpel\'s Riddle',
    'The Fog Gate',
    'Cloud Dancer',
    'The Dream Feather',
    'Shadow Jumper',
  ],
  badExamples: [
    'Adrian and the Wonder Lamp of the Old Oak',
    'Alexander and the Fire of Memory',
    'Adrian and the Light from the Wooden Doll',
  ],
};

// ============================================================================
// DIALOGUE QUALITY RULES (Julia Donaldson / Astrid Lindgren Style)
// ============================================================================

export const DIALOGUE_RULES = {
  // Good dialogue tags - varied and specific (English)
  goodTags: [
    'whispered', 'shouted', 'asked', 'mumbled', 'screamed', 'giggled',
    'growled', 'squeaked', 'sighed', 'breathed', 'squeaked',
    'stammered', 'cheered', 'moaned', 'shrieked', 'hissed', 'whimpered',
  ],

  // Good dialogue tags (German) - for validation
  goodTagsDE: [
    'flüsterte', 'rief', 'fragte', 'murmelte', 'schrie', 'kicherte',
    'brummte', 'quietschte', 'seufzte', 'knurrte', 'hauchte', 'piepste',
    'stammelte', 'jubelte', 'stöhnte', 'kreischte', 'zischte', 'wimmerte',
  ],

  // Avoid overuse of basic tags
  basicTags: ['said', 'replied', 'answered', 'responded'],
  basicTagsDE: ['sagte', 'antwortete', 'meinte', 'erwiderte'],
  maxBasicTagRatio: 0.3, // Max 30% of dialogues with basic tags

  // Dialogue must have action before or after
  requiresAction: true,

  // Example of good dialogue integration
  goodExample: `
    Adrian ran to the window. "There he is!" he shouted.
    Alexander ducked behind the table. "Quiet!" he whispered.
  `,

  // Bad pattern - dialogue lists
  badExample: `
    Dialogues: (1) "Hello," said Adrian. (2) "Hi," replied Alexander.
  `,
};

// ============================================================================
// SHOW DON'T TELL RULES
// ============================================================================

export const SHOW_DONT_TELL = {
  // Forbidden "telling" phrases (English)
  forbidden: [
    /(?:he|she|it) (?:was|felt) (?:sad|happy|angry|scared|brave)/gi,
    /(?:he|she|it) had (?:fear|courage|joy)/gi,
    /(?:he|she|it) knew that/gi,
    /(?:he|she|it) remembered/gi,
    /(?:he|she|it) thought that/gi,
    /(?:he|she|it) noticed that/gi,
  ],

  // Forbidden "telling" phrases (German) - for validation
  forbiddenDE: [
    /(?:er|sie|es) (?:war|fühlte sich) (?:traurig|glücklich|wütend|ängstlich|mutig)/gi,
    /(?:er|sie|es) hatte (?:Angst|Mut|Freude)/gi,
    /(?:er|sie|es) wusste, dass/gi,
    /(?:er|sie|es) erinnerte sich/gi,
    /(?:er|sie|es) dachte, dass/gi,
    /(?:er|sie|es) bemerkte, dass/gi,
  ],

  // Better "showing" alternatives (English)
  showingAlternatives: {
    'was scared': ['hands trembled', 'heart raced', 'breath caught', 'knees went weak'],
    'was sad': ['tears ran', 'shoulders sagged', 'voice broke', 'gaze dropped'],
    'was angry': ['fists clenched', 'face turned red', 'teeth gritted'],
    'was brave': ['shoulders straightened', 'chin lifted', 'steps grew firmer'],
    'was happy': ['eyes sparkled', 'smile spread', 'jumped for joy'],
  },

  // Body language vocabulary for emotions (English)
  bodyLanguage: {
    fear: ['tremble', 'freeze', 'back away', 'swallow', 'turn pale'],
    joy: ['beam', 'hop', 'clap', 'laugh', 'dance'],
    sadness: ['sigh', 'shoulders droop', 'cry', 'slump down'],
    anger: ['stomp', 'snort', 'eyes flash', 'shake', 'clench teeth'],
    courage: ['straighten up', 'breathe deep', 'step forward', 'raise chin'],
  },

  // Body language (German) - for validation
  bodyLanguageDE: {
    fear: ['zittern', 'erstarren', 'zurückweichen', 'schlucken', 'blass werden'],
    joy: ['strahlen', 'hüpfen', 'klatschen', 'lachen', 'tanzen'],
    sadness: ['seufzen', 'Schultern hängen', 'weinen', 'zusammensinken'],
    anger: ['stampfen', 'schnauben', 'funkeln', 'beben', 'zusammenpressen'],
    courage: ['aufrichten', 'tief atmen', 'vortreten', 'Blick heben'],
  },
};

// ============================================================================
// CHAPTER STRUCTURE RULES
// ============================================================================

export const CHAPTER_STRUCTURE = {
  // First sentence must be ACTION or IMAGE, never description
  firstSentence: {
    goodStarters: [
      'action_verb', // "Adrian ran...", "The wolf jumped..."
      'sensory_image', // "A crack broke through the silence."
      'dialogue', // "Quick!" Alexander called.
    ],
    badStarters: [
      'description', // "The forest was big and dark."
      'exposition', // "Once upon a time..."
      'narrator_comment', // "You need to know that..."
    ],
  },

  // Last sentence creates tension or question
  lastSentence: {
    techniques: [
      'cliffhanger', // "Then something cracked behind him."
      'question', // "What would he do?"
      'danger_tease', // "The eyes in the darkness came closer."
      'revelation_tease', // "But Adrian didn't know that yet."
    ],
  },

  // Pacing per chapter
  pacing: {
    chapter1: { action: 0.4, dialogue: 0.3, description: 0.3 },
    chapter2: { action: 0.5, dialogue: 0.3, description: 0.2 },
    chapter3: { action: 0.6, dialogue: 0.25, description: 0.15 }, // Escalation
    chapter4: { action: 0.65, dialogue: 0.25, description: 0.1 }, // Climax approach
    chapter5: { action: 0.4, dialogue: 0.35, description: 0.25 }, // Resolution
  },

  // Mandatory suddenness words per chapter (English)
  suddennessRequired: true,
  suddennessWords: ['suddenly', 'all at once', 'then', 'in the next moment'],
  suddennessWordsDE: ['plötzlich', 'auf einmal', 'da', 'dann', 'im nächsten Moment'],
};

// ============================================================================
// REPETITION AS STYLE (Julia Donaldson Technique)
// ============================================================================

export const REPETITION_TECHNIQUE = {
  enabled: true,

  // Important properties should be repeated 3x for emphasis
  tripleRepetition: {
    example: 'Rumpel was small. Rumpel was cunning. Rumpel was dangerous.',
    use: 'character_introduction',
  },

  // Recurring motifs throughout story
  leitmotifs: {
    count: 2, // 2-3 motifs per story
    examples: ['light/darkness', 'a specific object', 'a recurring sound'],
  },

  // Catchphrases for characters
  characterPhrases: {
    enabled: true,
    maxRepeats: 3, // Same phrase max 3x in story
  },
};

// ============================================================================
// SENSORY DETAILS RULES
// ============================================================================

export const SENSORY_RULES = {
  minimumPerChapter: 3,

  // Each sense should be used at least once
  senses: {
    sight: { required: true, examples: ['colors', 'movements', 'light', 'shadows'] },
    sound: { required: true, examples: ['noises', 'voices', 'silence', 'cracking'] },
    touch: { required: true, examples: ['textures', 'temperature', 'wind', 'rough/smooth'] },
    smell: { required: false, examples: ['scents', 'stench', 'fresh', 'musty'] },
    taste: { required: false, examples: ['sweet', 'sour', 'salty', 'bitter'] },
  },

  // Avoid clichés (English)
  forbiddenClichés: [
    'smells like bread and cinnamon',
    'tastes sweet as honey',
    'soft as velvet',
    'hard as stone',
    'cold as ice',
    'hot as fire',
  ],

  // Avoid clichés (German) - for validation
  forbiddenClichésDE: [
    'riecht nach Brot und Zimt',
    'schmeckt süß wie Honig',
    'weich wie Samt',
    'hart wie Stein',
    'kalt wie Eis',
    'heiß wie Feuer',
  ],

  // Encourage specific, unexpected details (English)
  goodExamples: [
    'smells like damp earth and honey',
    'tastes like sour apples',
    'sounds like rustling paper',
    'feels like warm moss',
  ],
};

// ============================================================================
// GENERATE OPTIMIZED PROMPT ADDITIONS
// ============================================================================

/**
 * Generate the critical anti-pattern prevention block for prompts
 */
export function generateAntiPatternBlock(): string {
  return `
🚫 VERBOTENE OUTPUT-MUSTER (KRITISCH - FÜHRT ZU ABLEHNUNG):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NIEMALS Meta-Labels im Story-Text ausgeben:
❌ "Dialoge: (1) Adrian sagte..., (2) Alexander antwortete..."
❌ "Sensorische Details: Goldene Sonne, Heugeruch, raues Fell..."
❌ "Hindernis-Teaser: Ein Wolf beobachtet..."
❌ "Gefahr: Die Hexe nähert sich..."
❌ "Sinne: warm, weich, süß..."
❌ "Moral: Man soll ehrlich sein..."

Diese Informationen müssen IN DIE GESCHICHTE EINGEWOBEN werden:

✅ RICHTIG - Eingewoben:
   Die Sonne warf goldene Streifen auf den Boden. Adrian roch Heu.
   "Da war etwas", flüsterte Alexander. Im Schatten der Bäume
   bewegten sich zwei gelbe Augen.

❌ FALSCH - Als Liste:
   Sensorische Details: goldene Sonne, Heugeruch
   Dialoge: (1) "Da war etwas", sagte Alexander
   Hindernis: Wolf im Schatten

MERKE: Kein echtes Kinderbuch hat Überschriften wie "Dialoge:" oder "Sinne:".
Schreibe wie Astrid Lindgren oder Julia Donaldson - reiner Fließtext!
`;
}

/**
 * Generate age-appropriate language rules for prompt
 */
export function generateAgeLanguageBlock(ageGroup: string): string {
  const rules = AGE_GROUP_RULES[ageGroup] || AGE_GROUP_RULES['6-8'];

  return `
📖 ALTERSGERECHTE SPRACHE (${rules.ageGroup} Jahre):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SATZ-STRUKTUR (KRITISCH für Lesbarkeit):
• ${Math.round(rules.shortSentenceRatio * 100)}% KURZE Sätze (3-7 Wörter): "Der Wolf kam näher."
• ${Math.round(rules.mediumSentenceRatio * 100)}% MITTLERE Sätze (8-15 Wörter): "Adrian versteckte sich hinter dem großen Baum."
• ${Math.round(rules.longSentenceRatio * 100)}% LANGE Sätze (16-${rules.maxWordsPerSentence} Wörter): Nur für wichtige Momente!

VERBOTEN für ${rules.ageGroup} Jahre:
${rules.abstractionAllowed ? '' : '• Keine abstrakten Metaphern wie "Mut ist ein kühler Stein"'}
• Keine Wörter über ${rules.maxWordsPerSentence} pro Satz
• Maximal ${rules.maxMetaphorsPerChapter} Metaphern pro Kapitel
${rules.forbiddenConcepts.map(c => `• Kein Thema: ${c}`).join('\n')}

PFLICHT:
• Mindestens ${rules.dialogueMinimum} Dialoge pro Kapitel
• Konkrete Aktionen statt innerer Monolog
• Wörter die ${rules.ageGroup}-Jährige kennen
`;
}

/**
 * Generate title improvement rules for prompt
 */
export function generateTitleBlock(): string {
  return `
📕 TITEL-REGELN (KRITISCH für Qualität):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MAXIMUM: ${TITLE_RULES.maxWords} Wörter

❌ VERBOTENE Titel-Muster:
   • "[Name] und das [Objekt]"
   • "[Name] und die [Person]"
   • "[Name]s Abenteuer"
   • "Die Geschichte von [Name]"

✅ GUTE Titel (wie echte Bestseller):
   ${TITLE_RULES.goodExamples.slice(0, 4).map(t => `• "${t}"`).join('\n   ')}

❌ SCHLECHTE Titel (zu generisch):
   ${TITLE_RULES.badExamples.slice(0, 2).map(t => `• "${t}"`).join('\n   ')}

TECHNIK: Wähle ein geheimnisvolles Objekt, einen magischen Ort,
oder eine mysteriöse Eigenschaft aus der Geschichte als Titel.
`;
}

/**
 * Generate dialogue quality rules for prompt
 */
export function generateDialogueBlock(): string {
  return `
💬 DIALOG-QUALITÄT (wie Julia Donaldson / Astrid Lindgren):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REGEL 1: Jeder Dialog braucht AKTION davor oder danach
   ✅ Adrian rannte zum Fenster. "Da ist er!", rief er.
   ❌ "Da ist er!", sagte Adrian.

REGEL 2: Variiere Dialog-Tags (maximal 30% "sagte/antwortete")
   NUTZE: flüsterte, rief, murmelte, kicherte, hauchte, piepste,
          stammelte, jubelte, kreischte, zischte, brummte

REGEL 3: NIEMALS Dialog-Listen
   ❌ Dialoge: (1) "Hallo" (2) "Hi" (3) "Wie geht's?"
   ✅ "Hallo!", rief Adrian. Alexander grinste. "Na endlich!"

REGEL 4: Dialoge zeigen Charakter
   • Mutiger Charakter: kurze, direkte Sätze
   • Ängstlicher Charakter: stockende, fragende Sätze
   • Weiser Charakter: ruhige, bedachte Sätze
`;
}

/**
 * Generate show-don't-tell rules for prompt
 */
export function generateShowDontTellBlock(): string {
  return `
🎭 SHOW, DON'T TELL (KRITISCH für Qualität):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VERBOTEN - "Telling" (abstrakt, langweilig):
   ❌ "Adrian hatte Angst"
   ❌ "Sie fühlte sich traurig"
   ❌ "Er war mutig"
   ❌ "Alexander wusste, dass es gefährlich war"

PFLICHT - "Showing" (konkret, bildlich):
   ✅ "Adrians Hände zitterten" (statt "hatte Angst")
   ✅ "Tränen liefen über ihre Wangen" (statt "war traurig")
   ✅ "Er ballte die Fäuste und trat vor" (statt "war mutig")
   ✅ "Alexander schluckte schwer" (statt "wusste, dass...")

KÖRPERSPRACHE FÜR EMOTIONEN:
   • ANGST: zittern, erstarren, zurückweichen, schlucken, blass werden
   • FREUDE: strahlen, hüpfen, klatschen, lachen, tanzen
   • TRAUER: seufzen, Schultern hängen, weinen, zusammensinken
   • WUT: stampfen, schnauben, funkeln, beben, Zähne zusammenbeißen
   • MUT: aufrichten, tief atmen, vortreten, Blick heben
`;
}

/**
 * Generate chapter structure rules for prompt
 */
export function generateChapterStructureBlock(): string {
  return `
📚 KAPITEL-STRUKTUR (Profi-Technik):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ERSTER SATZ jedes Kapitels - AKTION oder BILD:
   ✅ "Adrian rannte los." (Aktion)
   ✅ "Ein Knacken durchbrach die Stille." (Bild)
   ✅ "Schnell!", rief Alexander. (Dialog mit Aktion)
   ❌ "Der Wald war groß und dunkel." (Beschreibung)
   ❌ "Es war einmal..." (Klischee)

LETZTER SATZ jedes Kapitels (1-4) - SPANNUNG:
   ✅ "Dann knackte etwas hinter ihm." (Cliffhanger)
   ✅ "Was würde er nur tun?" (Frage)
   ✅ "Die Augen im Dunkel kamen näher." (Gefahr)
   ❌ "Und so gingen sie nach Hause." (Flach)

PFLICHT pro Kapitel:
   • Mindestens 1x "plötzlich" oder "auf einmal" oder "im nächsten Moment"
   • Mindestens 1x unerwartete Wendung
   • Mindestens 3 sensorische Details (EINGEWOBEN, nicht gelistet!)
`;
}

/**
 * Generate the complete professional storytelling rules block for prompts (German)
 */
export function generateCompleteRulesBlock(ageGroup: string): string {
  return `
╔══════════════════════════════════════════════════════════════════════════════╗
║              PROFESSIONELLE KINDERBUCH-QUALITÄTSREGELN v2.0                  ║
║     (Basierend auf Astrid Lindgren, Julia Donaldson, Otfried Preußler)       ║
╚══════════════════════════════════════════════════════════════════════════════╝

${generateAntiPatternBlock()}

${generateTitleBlock()}

${generateAgeLanguageBlock(ageGroup)}

${generateDialogueBlock()}

${generateShowDontTellBlock()}

${generateChapterStructureBlock()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUALITÄTS-CHECKLISTE VOR AUSGABE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
☐ Keine Meta-Labels im Text (Dialoge:, Sinne:, etc.)?
☐ Titel maximal 4 Wörter, kein "[Name] und..."?
☐ Sätze kurz genug für ${ageGroup} Jahre?
☐ Dialoge mit Aktion verbunden, nicht gelistet?
☐ Emotionen durch Körpersprache gezeigt, nicht benannt?
☐ Erster Satz ist Aktion oder Bild?
☐ Letzter Satz (Kap 1-4) erzeugt Spannung?
☐ Mindestens 3 Sinne pro Kapitel eingewoben?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
}

// ============================================================================
// ENGLISH PROMPT GENERATORS (RECOMMENDED FOR GPT-5)
// ============================================================================

/**
 * Generate anti-pattern prevention block in ENGLISH
 * This is the most critical section - prevents meta-instructions leaking into output
 */
export function generateAntiPatternBlockEN(): string {
  return `
🚫 FORBIDDEN OUTPUT PATTERNS (CRITICAL - WILL CAUSE REJECTION):
══════════════════════════════════════════════════════════════════════════════

NEVER output meta-labels in the story text:
❌ "Dialogues: (1) Adrian said..., (2) Alexander replied..."
❌ "Sensory details: Golden sun, hay smell, rough fur..."
❌ "Obstacle teaser: A wolf watches..."
❌ "Danger: The witch approaches..."
❌ "Senses: warm, soft, sweet..."
❌ "Moral: One should be honest..."

These elements MUST BE WOVEN INTO THE NARRATIVE:

✅ CORRECT - Woven in:
   The sun cast golden stripes on the floor. Adrian smelled hay.
   "Something's there," Alexander whispered. In the shadows,
   two yellow eyes moved.

❌ WRONG - As a list:
   Sensory details: golden sun, hay smell
   Dialogues: (1) "Something's there," said Alexander
   Obstacle: Wolf in the shadows

REMEMBER: No real children's book has headings like "Dialogues:" or "Senses:".
Write like Astrid Lindgren or Julia Donaldson - pure flowing prose!
`;
}

/**
 * Generate title rules in ENGLISH
 */
export function generateTitleBlockEN(): string {
  return `
📕 TITLE RULES (CRITICAL FOR QUALITY):
══════════════════════════════════════════════════════════════════════════════

MAXIMUM: 4 words

❌ FORBIDDEN title patterns:
   • "[Name] and the [Object]"
   • "[Name] and the [Person]"
   • "[Name]'s Adventure"
   • "The Story of [Name]"

✅ GOOD titles (like real bestsellers):
   • "The Whispering Forest"
   • "Stardust"
   • "The Moon Bridge"
   • "Rumpel's Riddle"

❌ BAD titles (too generic):
   • "Adrian and the Wonder Lamp of the Old Oak"
   • "Alexander and the Fire of Memory"

TECHNIQUE: Choose a mysterious object, magical place, or mystical
quality from the story as the title.
`;
}

/**
 * Generate age-appropriate language rules in ENGLISH
 */
export function generateAgeLanguageBlockEN(ageGroup: string): string {
  const rules = AGE_GROUP_RULES[ageGroup] || AGE_GROUP_RULES['6-8'];

  return `
📖 AGE-APPROPRIATE LANGUAGE (${rules.ageGroup} years):
══════════════════════════════════════════════════════════════════════════════

SENTENCE STRUCTURE (CRITICAL for readability):
• ${Math.round(rules.shortSentenceRatio * 100)}% SHORT sentences (3-7 words): "The wolf came closer."
• ${Math.round(rules.mediumSentenceRatio * 100)}% MEDIUM sentences (8-15 words): "Adrian hid behind the big tree."
• ${Math.round(rules.longSentenceRatio * 100)}% LONG sentences (16-${rules.maxWordsPerSentence} words): Only for important moments!

FORBIDDEN for ${rules.ageGroup} years:
${rules.abstractionAllowed ? '' : '• No abstract metaphors like "Courage is a cool stone"'}
• No sentences over ${rules.maxWordsPerSentence} words
• Maximum ${rules.maxMetaphorsPerChapter} metaphors per chapter
${rules.forbiddenConcepts.map(c => `• No topic: ${c}`).join('\n')}

REQUIRED:
• At least ${rules.dialogueMinimum} dialogues per chapter
• Concrete actions instead of inner monologue
• Words that ${rules.ageGroup}-year-olds understand
`;
}

/**
 * Generate dialogue rules in ENGLISH
 */
export function generateDialogueBlockEN(): string {
  return `
💬 DIALOGUE QUALITY (like Julia Donaldson / Astrid Lindgren):
══════════════════════════════════════════════════════════════════════════════

RULE 1: Every dialogue needs ACTION before or after
   ✅ Adrian ran to the window. "There he is!" he shouted.
   ❌ "There he is!" said Adrian.

RULE 2: Vary dialogue tags (max 30% "said/replied")
   USE: whispered, shouted, mumbled, giggled, breathed, squeaked,
        stammered, cheered, shrieked, hissed, growled

RULE 3: NEVER dialogue lists
   ❌ Dialogues: (1) "Hello" (2) "Hi" (3) "How are you?"
   ✅ "Hello!" Adrian called. Alexander grinned. "Finally!"

RULE 4: Dialogues reveal character
   • Brave character: short, direct sentences
   • Scared character: stuttering, questioning sentences
   • Wise character: calm, thoughtful sentences
`;
}

/**
 * Generate show-don't-tell rules in ENGLISH
 */
export function generateShowDontTellBlockEN(): string {
  return `
🎭 SHOW, DON'T TELL (CRITICAL FOR QUALITY):
══════════════════════════════════════════════════════════════════════════════

FORBIDDEN - "Telling" (abstract, boring):
   ❌ "Adrian was scared"
   ❌ "She felt sad"
   ❌ "He was brave"
   ❌ "Alexander knew it was dangerous"

REQUIRED - "Showing" (concrete, visual):
   ✅ "Adrian's hands trembled" (instead of "was scared")
   ✅ "Tears ran down her cheeks" (instead of "was sad")
   ✅ "He clenched his fists and stepped forward" (instead of "was brave")
   ✅ "Alexander swallowed hard" (instead of "knew that...")

BODY LANGUAGE FOR EMOTIONS:
   • FEAR: tremble, freeze, back away, swallow, turn pale
   • JOY: beam, hop, clap, laugh, dance
   • SADNESS: sigh, shoulders droop, cry, slump down
   • ANGER: stomp, snort, eyes flash, shake, clench teeth
   • COURAGE: straighten up, breathe deep, step forward, raise chin
`;
}

/**
 * Generate chapter structure rules in ENGLISH
 */
export function generateChapterStructureBlockEN(): string {
  return `
📚 CHAPTER STRUCTURE (Professional technique):
══════════════════════════════════════════════════════════════════════════════

FIRST SENTENCE of each chapter - ACTION or IMAGE:
   ✅ "Adrian took off running." (Action)
   ✅ "A crack broke through the silence." (Image)
   ✅ "Quick!" Alexander called. (Dialogue with action)
   ❌ "The forest was big and dark." (Description)
   ❌ "Once upon a time..." (Cliché)

LAST SENTENCE of each chapter (1-4) - TENSION:
   ✅ "Then something cracked behind him." (Cliffhanger)
   ✅ "What would he do?" (Question)
   ✅ "The eyes in the darkness came closer." (Danger)
   ❌ "And so they went home." (Flat)

REQUIRED per chapter:
   • At least 1x "suddenly" or "all at once" or "in the next moment"
   • At least 1x unexpected turn
   • At least 3 sensory details (WOVEN IN, not listed!)
`;
}

/**
 * Generate the complete ENGLISH professional storytelling rules block
 * This is the recommended version for GPT-5 prompts
 */
export function generateCompleteRulesBlockEN(ageGroup: string, targetLanguage: string = 'German'): string {
  return `
╔══════════════════════════════════════════════════════════════════════════════╗
║           PROFESSIONAL CHILDREN'S BOOK QUALITY RULES v2.0                    ║
║     (Based on Astrid Lindgren, Julia Donaldson, Otfried Preußler)            ║
╚══════════════════════════════════════════════════════════════════════════════╝

IMPORTANT: Write the STORY CONTENT in ${targetLanguage}. These instructions are in
English for better AI understanding, but the generated story must be in ${targetLanguage}.

${generateAntiPatternBlockEN()}

${generateTitleBlockEN()}

${generateAgeLanguageBlockEN(ageGroup)}

${generateDialogueBlockEN()}

${generateShowDontTellBlockEN()}

${generateChapterStructureBlockEN()}

══════════════════════════════════════════════════════════════════════════════
QUALITY CHECKLIST BEFORE OUTPUT:
══════════════════════════════════════════════════════════════════════════════
☐ No meta-labels in text (Dialogues:, Senses:, etc.)?
☐ Title maximum 4 words, no "[Name] and..."?
☐ Sentences short enough for ${ageGroup} year olds?
☐ Dialogues connected with action, not listed?
☐ Emotions shown through body language, not named?
☐ First sentence is action or image?
☐ Last sentence (Ch 1-4) creates tension?
☐ At least 3 senses per chapter woven in?
══════════════════════════════════════════════════════════════════════════════

FINAL REMINDER: The story text MUST be written in ${targetLanguage}!
Only imageDescription fields should be in English.
`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Constants
  FORBIDDEN_OUTPUT_PATTERNS,
  containsMetaPatterns,
  AGE_GROUP_RULES,
  TITLE_RULES,
  DIALOGUE_RULES,
  SHOW_DONT_TELL,
  CHAPTER_STRUCTURE,
  REPETITION_TECHNIQUE,
  SENSORY_RULES,
  // German generators (legacy)
  generateAntiPatternBlock,
  generateAgeLanguageBlock,
  generateTitleBlock,
  generateDialogueBlock,
  generateShowDontTellBlock,
  generateChapterStructureBlock,
  generateCompleteRulesBlock,
  // English generators (RECOMMENDED for GPT-5)
  generateAntiPatternBlockEN,
  generateAgeLanguageBlockEN,
  generateTitleBlockEN,
  generateDialogueBlockEN,
  generateShowDontTellBlockEN,
  generateChapterStructureBlockEN,
  generateCompleteRulesBlockEN,
};

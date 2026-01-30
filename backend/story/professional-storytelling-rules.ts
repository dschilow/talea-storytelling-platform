/**
 * PROFESSIONAL STORYTELLING RULES v2.0
 *
 * Based on research from:
 * - OpenAI GPT-5 Prompting Guide (https://cookbook.openai.com/examples/gpt-5/gpt-5_prompting_guide)
 * - Children's book best practices (Astrid Lindgren, Julia Donaldson, Otfried PreuÃŸler)
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
  /^\s*Die Phrase\b.*$/gmi,
  /^\s*The phrase\b.*$/gmi,
  /\([^)]*\bPhrase\b[^)]*\)/gi,

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
  /^Ð”Ð¸Ð°Ð»Ð¾Ð³Ð¸?:\s*/gm,
  /^Ð¡ÐµÐ½ÑÐ¾Ñ€Ð½Ñ‹Ðµ Ð´ÐµÑ‚Ð°Ð»Ð¸:\s*/gm,
  /^ÐŸÑ€ÐµÐ¿ÑÑ‚ÑÑ‚Ð²Ð¸Ðµ:\s*/gm,
  /^ÐžÐ¿Ð°ÑÐ½Ð¾ÑÑ‚ÑŒ:\s*/gm,
  /^Ð§ÑƒÐ²ÑÑ‚Ð²Ð°:\s*/gm,
  /^ÐœÐ¾Ñ€Ð°Ð»ÑŒ:\s*/gm,

  // Numbered/bulleted dialogue lists (German)
  /\(\d+\)\s*["â€ž"][^"]*[""].*,\s*(?:sagte|flÃ¼sterte|rief)/gm,
  /Dialoge?:\s*\(\d+\)/gm,

  // Numbered/bulleted dialogue lists (English)
  /\(\d+\)\s*[""][^"]*[""].*,\s*(?:said|whispered|shouted)/gm,
  /Dialogues?:\s*\(\d+\)/gm,

  // Comma-separated sensory lists (German)
  /(?:riecht|schmeckt|fÃ¼hlt|klingt|sieht)\s+nach\s+[\w\s,]+,\s+[\w\s,]+,\s+[\w\s,]+/gm,

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
    maxMetaphorsPerChapter: 0,
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
    maxMetaphorsPerChapter: 1,
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
    maxMetaphorsPerChapter: 1,
    dialogueMinimum: 3,
  },
};

export interface ChapterWordTarget {
  min: number;
  target: number;
  max: number;
  variance: number;
}

const CHAPTER_WORD_TARGETS: Record<string, ChapterWordTarget> = {
  '3-5': { min: 140, target: 180, max: 220, variance: 60 },
  '6-8': { min: 200, target: 250, max: 300, variance: 80 },
  '9-12': { min: 260, target: 320, max: 380, variance: 80 },
  '13+': { min: 320, target: 400, max: 480, variance: 100 },
};

export function getChapterWordTarget(ageGroup: string): ChapterWordTarget {
  return CHAPTER_WORD_TARGETS[ageGroup] || CHAPTER_WORD_TARGETS['6-8'];
}

export function getDialogueMinimum(ageGroup: string): number {
  const rules = AGE_GROUP_RULES[ageGroup] || AGE_GROUP_RULES['6-8'];
  return Math.max(2, rules.dialogueMinimum);
}

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
    /^[\w]+ Ð¸ /i,             // "ÐÐ´Ñ€Ð¸Ð°Ð½ Ð¸..."
    /^Ð˜ÑÑ‚Ð¾Ñ€Ð¸Ñ Ð¾/i,            // "Ð˜ÑÑ‚Ð¾Ñ€Ð¸Ñ Ð¾..."
    /^ÐŸÑ€Ð¸ÐºÐ»ÑŽÑ‡ÐµÐ½Ð¸Ñ/i,          // "ÐŸÑ€Ð¸ÐºÐ»ÑŽÑ‡ÐµÐ½Ð¸Ñ..."
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
    'flÃ¼sterte', 'rief', 'fragte', 'murmelte', 'schrie', 'kicherte',
    'brummte', 'quietschte', 'seufzte', 'knurrte', 'hauchte', 'piepste',
    'stammelte', 'jubelte', 'stÃ¶hnte', 'kreischte', 'zischte', 'wimmerte',
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
    /(?:er|sie|es) (?:war|fÃ¼hlte sich) (?:traurig|glÃ¼cklich|wÃ¼tend|Ã¤ngstlich|mutig)/gi,
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
    fear: ['zittern', 'erstarren', 'zurÃ¼ckweichen', 'schlucken', 'blass werden'],
    joy: ['strahlen', 'hÃ¼pfen', 'klatschen', 'lachen', 'tanzen'],
    sadness: ['seufzen', 'Schultern hÃ¤ngen', 'weinen', 'zusammensinken'],
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
  suddennessWordsDE: ['plÃ¶tzlich', 'auf einmal', 'da', 'dann', 'im nÃ¤chsten Moment'],
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
// NEW v3.0: FORESHADOWING & CONFLICT RULES (Priority 1)
// ============================================================================

export const FORESHADOWING_RULES = {
  // Every threat mentioned in Ch1-2 MUST return in Ch3-4
  threatReturnRequired: true,

  // Transformation hints required before actual transformation
  transformationHints: {
    minimumChaptersBefore: 2,
    hintTypes: [
      'strange_behavior',      // Character acts oddly
      'unusual_shadows',       // Visual foreshadowing
      'other_suspicion',       // Other characters notice something
      'symbolic_imagery',      // Metaphorical hints
      'dialogue_hints',        // Cryptic statements
    ],
  },

  // Conflict escalation pattern
  conflictEscalation: {
    chapter1: 'introduce_threat',      // Wolf appears, watches
    chapter2: 'first_encounter',       // Initial conflict, escape
    chapter3: 'escalation_real_risk',  // Captivity, loss, defeat seems possible
    chapter4: 'counterattack',         // Heroes fight back, consequences
    chapter5: 'resolution',            // Final confrontation, victory
  },

  // Chekhov's Gun principle
  chekhovsGun: {
    enabled: true,
    rule: 'Every element introduced in Ch1-2 must pay off by Ch5',
    examples: [
      'Magic item shown â†’ used to solve problem',
      'Character trait mentioned â†’ saves the day',
      'Location described â†’ becomes crucial',
    ],
  },
};

// ============================================================================
// NEW v3.0: ENHANCED DIALOGUE RULES (Priority 1 - 5 dialogues minimum)
// ============================================================================

export const ENHANCED_DIALOGUE_RULES = {
  minimumPerChapter: 2,

  // Dialogue distribution per chapter
  distribution: {
    chapter1: { min: 2, focus: 'character_introduction' },
    chapter2: { min: 2, focus: 'conflict_building' },
    chapter3: { min: 3, focus: 'emotional_peak' },
    chapter4: { min: 3, focus: 'confrontation' },
    chapter5: { min: 2, focus: 'resolution_warmth' },
  },

  // Action beats required
  actionBeatRatio: 0.7, // 70% of dialogues need action before/after

  // Character voice consistency
  voicePatterns: {
    brave: ['short sentences', 'direct commands', 'confident tone'],
    scared: ['stuttering', 'questions', 'incomplete sentences'],
    wise: ['calm pace', 'metaphors allowed', 'thoughtful pauses'],
    trickster: ['wordplay', 'misdirection', 'humor'],
  },

  // Forbidden patterns
  forbidden: [
    'said flatly',
    'replied simply',
    'answered back',
  ],
};

// ============================================================================
// NEW v3.0: CHAPTER BALANCE RULES (Priority 2)
// ============================================================================

const DEFAULT_CHAPTER_WORD_TARGET = getChapterWordTarget('6-8');

export const CHAPTER_BALANCE_RULES = {
  // Strict word count per chapter
  wordCount: {
    minimum: DEFAULT_CHAPTER_WORD_TARGET.min,
    maximum: DEFAULT_CHAPTER_WORD_TARGET.max,
    variance: DEFAULT_CHAPTER_WORD_TARGET.variance, // Max difference between shortest and longest
  },

  // Pacing balance
  pacingBalance: {
    action: { min: 0.35, max: 0.65 },
    dialogue: { min: 0.25, max: 0.40 },
    description: { min: 0.10, max: 0.30 },
  },

  // Sentence rhythm pattern
  rhythmPattern: {
    afterShortSentences: 3, // After 3 short sentences...
    requireMedium: true,    // ...require 1 medium sentence
    pattern: 'short-short-short-MEDIUM-short-short',
  },
};

// ============================================================================
// NEW v3.0: SENTENCE REPETITION DETECTION (Priority 2)
// ============================================================================

export const REPETITION_DETECTION = {
  // Patterns that indicate poor style
  badRepetitionPatterns: [
    // Same structure repeated
    /(\w+)\s+klang\s+\w+\.\s+\1\s+klang/gi,  // "Sie klang X. Sie klang Y."
    /^(Er|Sie|Es)\s+.*?\.\s+\1\s+/gm,        // "Er X. Er Y."
    /(war|hatte|ging)\s+.*?\.\s+.*?\1\s+/gm, // Same verb in consecutive sentences

    // English versions
    /(\w+)\s+was\s+\w+\.\s+\1\s+was/gi,      // "She was X. She was Y."
    /^(He|She|It)\s+.*?\.\s+\1\s+/gm,        // "He X. He Y."
  ],

  // Good repetition (stylistic, like Julia Donaldson)
  goodRepetitionPatterns: [
    // Triple emphasis
    /(\w+) war \w+\. \1 war \w+\. \1 war \w+\./gi,
    // Catchphrase repetition
    /"([^"]+)".*"(\1)"/g,
  ],

  // Maximum same-start sentences in a row
  maxConsecutiveSameStart: 2,
};

// ============================================================================
// NEW v3.0: POV CONSISTENCY RULES (Priority 3)
// ============================================================================

export const POV_RULES = {
  // Each chapter has a primary POV character
  chapterPOV: {
    chapter1: 'protagonist',   // Alexander
    chapter2: 'sidekick',      // Adrian
    chapter3: 'protagonist',   // Back to Alexander
    chapter4: 'sidekick',      // Adrian's moment
    chapter5: 'shared',        // Both contribute equally
  },

  // POV indicators
  povIndicators: {
    // Whose thoughts/feelings we access
    internalAccess: true,
    // Who the camera follows
    physicalFocus: true,
    // Whose dialogue opens the chapter
    dialoguePriority: true,
  },

  // Switching rules
  switchRules: {
    minimumScenesBetweenSwitches: 2,
    transitionRequired: true,
    transitionExamples: [
      'Meanwhile, Adrian...',
      'Alexander didn\'t see that...',
      'On the other side of the forest...',
    ],
  },
};

// ============================================================================
// NEW v3.0: IMAGE PROMPT CONSISTENCY (Priority 3)
// ============================================================================

export const IMAGE_PROMPT_RULES = {
  // Language consistency - all English
  languageRules: {
    mustBeEnglish: true,
    translatePatterns: {
      'the Alte Eiche': 'the Ancient Oak',
      'Greta the Goat': 'Greta the white goat',
      'Rumpel der Zwerg': 'Rumpel the Dwarf',
      'die Alte Eiche': 'the Ancient Oak',
    },
  },

  // Style consistency across all images
  styleConsistency: {
    baseStyle: 'Watercolor illustration style, Axel Scheffler inspired',
    alternatives: [
      'Soft pastel children\'s book illustration',
      'Whimsical storybook art, warm colors',
      'Gentle fairy tale illustration style',
    ],
    // Same style must be used across all chapters
    requireConsistent: true,
  },

  // Shot type variety
  shotTypeVariety: {
    required: false,
    types: ['WIDE SHOT', 'CLOSE-UP', 'HERO SHOT', 'DRAMATIC ANGLE', 'MEDIUM SHOT'],
    maxConsecutiveSameType: 2,
  },

  // Word count
  wordCount: {
    minimum: 40,
    maximum: 90,
  },
};

// ============================================================================
// NEW v3.0: LEITMOTIF SYSTEM (Priority 4)
// ============================================================================

export const LEITMOTIF_RULES = {
  // Number of recurring motifs per story
  count: { min: 2, max: 3 },

  // Motif categories
  categories: {
    sound: {
      examples: ['nightingale\'s song', 'porcelain tinkling', 'wind chimes'],
      appearancePerStory: 5, // Minimum mentions across all chapters
    },
    color: {
      examples: ['gold vs. gray', 'red thread', 'silver moonlight'],
      appearancePerStory: 5,
    },
    phrase: {
      examples: ['echte Stimme', 'real voice', 'true song'],
      appearancePerStory: 3,
    },
    object: {
      examples: ['the porcelain heart', 'the silver feather', 'the old key'],
      appearancePerStory: 4,
    },
  },

  // Motif arc
  motifArc: {
    chapter1: 'introduce_subtly',
    chapter2: 'reinforce',
    chapter3: 'challenge_or_threaten',
    chapter4: 'transform_or_use',
    chapter5: 'resolution_payoff',
  },
};

// ============================================================================
// NEW v3.0: EMOTIONAL ARC TRACKING (Priority 4)
// ============================================================================

export const EMOTIONAL_ARC_RULES = {
  // Each avatar has a defined emotional journey
  arcPerAvatar: {
    protagonist: {
      chapter1: 'WONDER',        // Discovering the world
      chapter2: 'DOUBT',         // Facing the challenge
      chapter3: 'DESPAIR',       // Lowest point
      chapter4: 'DETERMINATION', // Fighting back
      chapter5: 'GROWTH',        // Lesson learned
    },
    sidekick: {
      chapter1: 'CURIOSITY',     // Following along
      chapter2: 'CONCERN',       // Worried about friend
      chapter3: 'FEAR',          // Danger feels real
      chapter4: 'COURAGE',       // Steps up to help
      chapter5: 'PRIDE',         // Proud of achievement
    },
  },

  // Emotional transitions must be shown, not told
  transitionTechniques: {
    wonder_to_doubt: 'Physical hesitation, questioning dialogue',
    doubt_to_despair: 'Failure moment, tears, giving up gesture',
    despair_to_determination: 'Internal realization, clenched fists, standing up',
    determination_to_growth: 'Successful action, smile, helping others',
  },

  // Forbidden emotional shortcuts
  forbiddenShortcuts: [
    'suddenly felt brave',
    'decided to be happy',
    'stopped being scared',
    'chose to trust',
  ],
};

// ============================================================================
// NEW v3.0: PROFESSIONAL STYLE REFERENCES (Priority 4)
// ============================================================================

export const STYLE_REFERENCES = {
  // Astrid Lindgren style elements
  lindgren: {
    nature: 'alive, breathing, almost a character',
    children: 'brave but vulnerable, make mistakes, have real emotions',
    danger: 'real but not traumatizing',
    humor: 'dry, understated, often in dialogue',
    examples: ['Ronja RÃ¤ubertochter', 'Pippi Langstrumpf', 'Die BrÃ¼der LÃ¶wenherz'],
  },

  // Julia Donaldson style elements
  donaldson: {
    rhythm: 'strong rhythmic patterns, memorable phrases',
    repetition: 'stylistic repetition for emphasis',
    villains: 'scary but defeatable through cleverness',
    resolution: 'satisfying, often with a twist',
    examples: ['Der GrÃ¼ffelo', 'Die Schnecke und der Buckelwal', 'Stockmann'],
  },

  // Otfried PreuÃŸler style elements
  preussler: {
    atmosphere: 'dark but cozy, mysterious but safe',
    magic: 'subtle, integrated into everyday life',
    characters: 'quirky, memorable, often with catchphrases',
    lessons: 'deep but not preachy, woven into plot',
    examples: ['Die kleine Hexe', 'Der RÃ¤uber Hotzenplotz', 'Krabat'],
  },

  // Which style to emphasize based on story type
  styleByGenre: {
    adventure: 'lindgren',
    fairy_tale: 'preussler',
    humor: 'donaldson',
    fantasy: 'preussler',
    friendship: 'lindgren',
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

  // Avoid cliches (English)
  forbiddenCliches: [
    'smells like bread and cinnamon',
    'tastes sweet as honey',
    'soft as velvet',
    'hard as stone',
    'cold as ice',
    'hot as fire',
  ],

  // Avoid cliches (German) - for validation
  forbiddenClichesDE: [
    'riecht nach Brot und Zimt',
    'schmeckt suess wie Honig',
    'weich wie Samt',
    'hart wie Stein',
    'kalt wie Eis',
    'heiss wie Feuer',
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
ðŸš« VERBOTENE OUTPUT-MUSTER (KRITISCH - FÃœHRT ZU ABLEHNUNG):
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

NIEMALS Meta-Labels im Story-Text ausgeben:
âŒ "Dialoge: (1) Adrian sagte..., (2) Alexander antwortete..."
âŒ "Sensorische Details: Goldene Sonne, Heugeruch, raues Fell..."
âŒ "Hindernis-Teaser: Ein Wolf beobachtet..."
âŒ "Gefahr: Die Hexe nÃ¤hert sich..."
âŒ "Sinne: warm, weich, sÃ¼ÃŸ..."
âŒ "Moral: Man soll ehrlich sein..."

Diese Informationen mÃ¼ssen IN DIE GESCHICHTE EINGEWOBEN werden:

âœ… RICHTIG - Eingewoben:
   Die Sonne warf goldene Streifen auf den Boden. Adrian roch Heu.
   "Da war etwas", flÃ¼sterte Alexander. Im Schatten der BÃ¤ume
   bewegten sich zwei gelbe Augen.

âŒ FALSCH - Als Liste:
   Sensorische Details: goldene Sonne, Heugeruch
   Dialoge: (1) "Da war etwas", sagte Alexander
   Hindernis: Wolf im Schatten

MERKE: Kein echtes Kinderbuch hat Ãœberschriften wie "Dialoge:" oder "Sinne:".
Schreibe wie Astrid Lindgren oder Julia Donaldson - reiner FlieÃŸtext!
`;
}

/**
 * Generate age-appropriate language rules for prompt
 */
export function generateAgeLanguageBlock(ageGroup: string): string {
  const rules = AGE_GROUP_RULES[ageGroup] || AGE_GROUP_RULES['6-8'];

  return `
ðŸ“– ALTERSGERECHTE SPRACHE (${rules.ageGroup} Jahre):
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

SATZ-STRUKTUR (KRITISCH fÃ¼r Lesbarkeit):
â€¢ ${Math.round(rules.shortSentenceRatio * 100)}% KURZE SÃ¤tze (3-7 WÃ¶rter): "Der Wolf kam nÃ¤her."
â€¢ ${Math.round(rules.mediumSentenceRatio * 100)}% MITTLERE SÃ¤tze (8-15 WÃ¶rter): "Adrian versteckte sich hinter dem groÃŸen Baum."
â€¢ ${Math.round(rules.longSentenceRatio * 100)}% LANGE SÃ¤tze (16-${rules.maxWordsPerSentence} WÃ¶rter): Nur fÃ¼r wichtige Momente!

VERBOTEN fÃ¼r ${rules.ageGroup} Jahre:
${rules.abstractionAllowed ? '' : 'â€¢ Keine abstrakten Metaphern wie "Mut ist ein kÃ¼hler Stein"'}
â€¢ Keine WÃ¶rter Ã¼ber ${rules.maxWordsPerSentence} pro Satz
â€¢ Maximal ${rules.maxMetaphorsPerChapter} Metaphern pro Kapitel
â€¢ KEINE poetischen Floskeln (z.B. "Sonne glitt wie Honig", "Worte wie Nebel")
â€¢ KEINE unnÃ¶tigen Geruchsbeschreibungen ("roch nach...", "duftete nach...")
${rules.forbiddenConcepts.map(c => `â€¢ Kein Thema: ${c}`).join('\n')}

PFLICHT:
â€¢ Konkrete, bodenstÃ¤ndige Sprache ohne SchnÃ¶rkel
â€¢ Mindestens ${rules.dialogueMinimum} Dialoge pro Kapitel
â€¢ Konkrete Aktionen statt innerer Monolog
â€¢ WÃ¶rter die ${rules.ageGroup}-JÃ¤hrige kennen
`;
}

/**
 * Generate title improvement rules for prompt
 */
export function generateTitleBlock(): string {
  return `
ðŸ“• TITEL-REGELN (KRITISCH fÃ¼r QualitÃ¤t):
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

MAXIMUM: ${TITLE_RULES.maxWords} WÃ¶rter

âŒ VERBOTENE Titel-Muster:
   â€¢ "[Name] und das [Objekt]"
   â€¢ "[Name] und die [Person]"
   â€¢ "[Name]s Abenteuer"
   â€¢ "Die Geschichte von [Name]"

âœ… GUTE Titel (wie echte Bestseller):
   ${TITLE_RULES.goodExamples.slice(0, 4).map(t => `â€¢ "${t}"`).join('\n   ')}

âŒ SCHLECHTE Titel (zu generisch):
   ${TITLE_RULES.badExamples.slice(0, 2).map(t => `â€¢ "${t}"`).join('\n   ')}

TECHNIK: WÃ¤hle ein geheimnisvolles Objekt, einen magischen Ort,
oder eine mysteriÃ¶se Eigenschaft aus der Geschichte als Titel.
`;
}

/**
 * Generate dialogue quality rules for prompt
 */
export function generateDialogueBlock(): string {
  return `
ðŸ’¬ DIALOG-QUALITÃ„T (wie Julia Donaldson / Astrid Lindgren):
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

REGEL 1: Jeder Dialog braucht AKTION davor oder danach
   âœ… Adrian rannte zum Fenster. "Da ist er!", rief er.
   âŒ "Da ist er!", sagte Adrian.

REGEL 2: Variiere Dialog-Tags (maximal 30% "sagte/antwortete")
   NUTZE: flÃ¼sterte, rief, murmelte, kicherte, hauchte, piepste,
          stammelte, jubelte, kreischte, zischte, brummte

REGEL 3: NIEMALS Dialog-Listen
   âŒ Dialoge: (1) "Hallo" (2) "Hi" (3) "Wie geht's?"
   âœ… "Hallo!", rief Adrian. Alexander grinste. "Na endlich!"

REGEL 4: Dialoge zeigen Charakter
   â€¢ Mutiger Charakter: kurze, direkte SÃ¤tze
   â€¢ Ã„ngstlicher Charakter: stockende, fragende SÃ¤tze
   â€¢ Weiser Charakter: ruhige, bedachte SÃ¤tze
`;
}

/**
 * Generate show-don't-tell rules for prompt
 */
export function generateShowDontTellBlock(): string {
  return `
ðŸŽ­ SHOW, DON'T TELL (KRITISCH fÃ¼r QualitÃ¤t):
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

VERBOTEN - "Telling" (abstrakt, langweilig):
   âŒ "Adrian hatte Angst"
   âŒ "Sie fÃ¼hlte sich traurig"
   âŒ "Er war mutig"
   âŒ "Alexander wusste, dass es gefÃ¤hrlich war"

PFLICHT - "Showing" (konkret, bildlich):
   âœ… "Adrians HÃ¤nde zitterten" (statt "hatte Angst")
   âœ… "TrÃ¤nen liefen Ã¼ber ihre Wangen" (statt "war traurig")
   âœ… "Er ballte die FÃ¤uste und trat vor" (statt "war mutig")
   âœ… "Alexander schluckte schwer" (statt "wusste, dass...")

KÃ–RPERSPRACHE FÃœR EMOTIONEN:
   â€¢ ANGST: zittern, erstarren, zurÃ¼ckweichen, schlucken, blass werden
   â€¢ FREUDE: strahlen, hÃ¼pfen, klatschen, lachen, tanzen
   â€¢ TRAUER: seufzen, Schultern hÃ¤ngen, weinen, zusammensinken
   â€¢ WUT: stampfen, schnauben, funkeln, beben, ZÃ¤hne zusammenbeiÃŸen
   â€¢ MUT: aufrichten, tief atmen, vortreten, Blick heben
`;
}

/**
 * Generate chapter structure rules for prompt
 */
export function generateChapterStructureBlock(): string {
  return `
ðŸ“š KAPITEL-STRUKTUR (Profi-Technik):
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

ERSTER SATZ jedes Kapitels - AKTION oder BILD:
   âœ… "Adrian rannte los." (Aktion)
   âœ… "Ein Knacken durchbrach die Stille." (Bild)
   âœ… "Schnell!", rief Alexander. (Dialog mit Aktion)
   âŒ "Der Wald war groÃŸ und dunkel." (Beschreibung)
   âŒ "Es war einmal..." (Klischee)

LETZTER SATZ jedes Kapitels (1-4) - SPANNUNG:
   âœ… "Dann knackte etwas hinter ihm." (Cliffhanger)
   âœ… "Was wÃ¼rde er nur tun?" (Frage)
   âœ… "Die Augen im Dunkel kamen nÃ¤her." (Gefahr)
   âŒ "Und so gingen sie nach Hause." (Flach)

PFLICHT pro Kapitel:
   â€¢ Mindestens 1x "plÃ¶tzlich" oder "auf einmal" oder "im nÃ¤chsten Moment"
   â€¢ Mindestens 1x unerwartete Wendung
   â€¢ Maximal 1 sensorisches Detail (nur wenn absolut notwendig für die Szene!)
`;
}

/**
 * Generate the complete professional storytelling rules block for prompts (German)
 */
export function generateCompleteRulesBlock(ageGroup: string): string {
  return `
â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—
â•‘              PROFESSIONELLE KINDERBUCH-QUALITÃ„TSREGELN v2.0                  â•‘
â•‘     (Basierend auf Astrid Lindgren, Julia Donaldson, Otfried PreuÃŸler)       â•‘
â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

${generateAntiPatternBlock()}

${generateTitleBlock()}

${generateAgeLanguageBlock(ageGroup)}

${generateDialogueBlock()}

${generateShowDontTellBlock()}

${generateChapterStructureBlock()}

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
QUALITÃ„TS-CHECKLISTE VOR AUSGABE:
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
â˜ Keine Meta-Labels im Text (Dialoge:, Sinne:, etc.)?
â˜ Titel maximal 4 WÃ¶rter, kein "[Name] und..."?
â˜ SÃ¤tze kurz genug fÃ¼r ${ageGroup} Jahre?
â˜ Dialoge mit Aktion verbunden, nicht gelistet?
â˜ Emotionen durch KÃ¶rpersprache gezeigt, nicht benannt?
â˜ Erster Satz ist Aktion oder Bild?
â˜ Letzter Satz (Kap 1-4) erzeugt Spannung?
â˜ Mindestens 3 Sinne pro Kapitel eingewoben?
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
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
ðŸš« FORBIDDEN OUTPUT PATTERNS (CRITICAL - WILL CAUSE REJECTION):
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

NEVER output meta-labels in the story text:
âŒ "Dialogues: (1) Adrian said..., (2) Alexander replied..."
âŒ "Sensory details: Golden sun, hay smell, rough fur..."
âŒ "Obstacle teaser: A wolf watches..."
âŒ "Danger: The witch approaches..."
âŒ "Senses: warm, soft, sweet..."
âŒ "Moral: One should be honest..."

These elements MUST BE WOVEN INTO THE NARRATIVE:

âœ… CORRECT - Woven in:
   The sun cast golden stripes on the floor. Adrian smelled hay.
   "Something's there," Alexander whispered. In the shadows,
   two yellow eyes moved.

âŒ WRONG - As a list:
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
ðŸ“• TITLE RULES (CRITICAL FOR QUALITY):
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

MAXIMUM: 4 words

âŒ FORBIDDEN title patterns:
   â€¢ "[Name] and the [Object]"
   â€¢ "[Name] and the [Person]"
   â€¢ "[Name]'s Adventure"
   â€¢ "The Story of [Name]"

âœ… GOOD titles (like real bestsellers):
   â€¢ "The Whispering Forest"
   â€¢ "Stardust"
   â€¢ "The Moon Bridge"
   â€¢ "Rumpel's Riddle"

âŒ BAD titles (too generic):
   â€¢ "Adrian and the Wonder Lamp of the Old Oak"
   â€¢ "Alexander and the Fire of Memory"

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
ðŸ“– AGE-APPROPRIATE LANGUAGE (${rules.ageGroup} years):
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

SENTENCE STRUCTURE (CRITICAL for readability):
â€¢ ${Math.round(rules.shortSentenceRatio * 100)}% SHORT sentences (3-7 words): "The wolf came closer."
â€¢ ${Math.round(rules.mediumSentenceRatio * 100)}% MEDIUM sentences (8-15 words): "Adrian hid behind the big tree."
â€¢ ${Math.round(rules.longSentenceRatio * 100)}% LONG sentences (16-${rules.maxWordsPerSentence} words): Only for important moments!

FORBIDDEN for ${rules.ageGroup} years:
${rules.abstractionAllowed ? '' : 'â€¢ No abstract metaphors like "Courage is a cool stone"'}
â€¢ No sentences over ${rules.maxWordsPerSentence} words
â€¢ Maximum ${rules.maxMetaphorsPerChapter} metaphors per chapter
â€¢ NO poetic flourishes (e.g., "sun like honey", "words like fog")
â€¢ NO unnecessary sensory/smell descriptions (e.g., "smelled of...", "fragrance of...")
${rules.forbiddenConcepts.map(c => `â€¢ No topic: ${c}`).join('\n')}

REQUIRED:
â€¢ Sincere, grounded language without unnecessary flourishes
â€¢ At least ${rules.dialogueMinimum} dialogues per chapter
â€¢ Concrete actions instead of inner monologue
â€¢ Words that ${rules.ageGroup}-year-olds understand
`;
}

/**
 * Generate dialogue rules in ENGLISH
 */
export function generateDialogueBlockEN(): string {
  return `
ðŸ’¬ DIALOGUE QUALITY (like Julia Donaldson / Astrid Lindgren):
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

RULE 1: Every dialogue needs ACTION before or after
   âœ… Adrian ran to the window. "There he is!" he shouted.
   âŒ "There he is!" said Adrian.

RULE 2: Vary dialogue tags (max 30% "said/replied")
   USE: whispered, shouted, mumbled, giggled, breathed, squeaked,
        stammered, cheered, shrieked, hissed, growled

RULE 3: NEVER dialogue lists
   âŒ Dialogues: (1) "Hello" (2) "Hi" (3) "How are you?"
   âœ… "Hello!" Adrian called. Alexander grinned. "Finally!"

RULE 4: Dialogues reveal character
   â€¢ Brave character: short, direct sentences
   â€¢ Scared character: stuttering, questioning sentences
   â€¢ Wise character: calm, thoughtful sentences
`;
}

/**
 * Generate show-don't-tell rules in ENGLISH
 */
export function generateShowDontTellBlockEN(): string {
  return `
ðŸŽ­ SHOW, DON'T TELL (CRITICAL FOR QUALITY):
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

FORBIDDEN - "Telling" (abstract, boring):
   âŒ "Adrian was scared"
   âŒ "She felt sad"
   âŒ "He was brave"
   âŒ "Alexander knew it was dangerous"

REQUIRED - "Showing" (concrete, visual):
   âœ… "Adrian's hands trembled" (instead of "was scared")
   âœ… "Tears ran down her cheeks" (instead of "was sad")
   âœ… "He clenched his fists and stepped forward" (instead of "was brave")
   âœ… "Alexander swallowed hard" (instead of "knew that...")

BODY LANGUAGE FOR EMOTIONS:
   â€¢ FEAR: tremble, freeze, back away, swallow, turn pale
   â€¢ JOY: beam, hop, clap, laugh, dance
   â€¢ SADNESS: sigh, shoulders droop, cry, slump down
   â€¢ ANGER: stomp, snort, eyes flash, shake, clench teeth
   â€¢ COURAGE: straighten up, breathe deep, step forward, raise chin
`;
}

/**
 * Generate chapter structure rules in ENGLISH
 */
export function generateChapterStructureBlockEN(): string {
  return `
ðŸ“š CHAPTER STRUCTURE (Professional technique):
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

FIRST SENTENCE of each chapter - ACTION or IMAGE:
   âœ… "Adrian took off running." (Action)
   âœ… "A crack broke through the silence." (Image)
   âœ… "Quick!" Alexander called. (Dialogue with action)
   âŒ "The forest was big and dark." (Description)
   âŒ "Once upon a time..." (ClichÃ©)

LAST SENTENCE of each chapter (1-4) - TENSION:
   âœ… "Then something cracked behind him." (Cliffhanger)
   âœ… "What would he do?" (Question)
   âœ… "The eyes in the darkness came closer." (Danger)
   âŒ "And so they went home." (Flat)

REQUIRED per chapter:
   â€¢ At least 1x "suddenly" or "all at once" or "in the next moment"
   â€¢ At least 1x unexpected turn
   â€¢ Maximum 1 sensory detail (only if absolutely necessary for the scene!)
`;
}

/**
 * NEW v3.0: Generate foreshadowing and conflict rules
 */
export function generateForeshadowingBlockEN(): string {
  return `
ðŸŽ¯ FORESHADOWING & CONFLICT RULES (CRITICAL FOR PLOT QUALITY):
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

CHEKHOV'S GUN PRINCIPLE:
   Every element introduced in Chapters 1-2 MUST pay off by Chapter 5!
   â€¢ Magic item shown â†’ used to solve the problem
   â€¢ Character trait mentioned â†’ saves the day
   â€¢ Location described â†’ becomes crucial
   â€¢ Threat introduced â†’ must return and be defeated

CONFLICT ESCALATION PATTERN:
   Chapter 1: INTRODUCE THREAT (wolf watches, shadow lurks, stranger appears)
   Chapter 2: FIRST ENCOUNTER (initial conflict, narrow escape)
   Chapter 3: ESCALATION (real risk - captivity, loss, defeat seems possible)
   Chapter 4: COUNTERATTACK (heroes fight back, clear consequences)
   Chapter 5: RESOLUTION (final confrontation, obstacle overcome - not skipped!)

TRANSFORMATION FORESHADOWING:
   If a character transforms (goodâ†’evil, humanâ†’animal, etc.):
   âŒ "Suddenly she transformed" - NO SETUP = BAD
   âœ… Hint in Ch1: "Her eyes flickered strangely"
   âœ… Hint in Ch2: "Why did she avoid the sunlight?"
   âœ… Ch3: Other character says "Something's wrong with her"
   âœ… Ch4: Transformation happens - READER EXPECTED IT

NO LOOSE THREADS:
   â€¢ Wolf appears in Ch1 â†’ Must return in Ch3-4 (not just disappear!)
   â€¢ Magic object mentioned â†’ Must be used
   â€¢ Character makes a promise â†’ Must keep or break it with consequences
`;
}

/**
 * NEW v3.0: Generate enhanced dialogue rules (age-aware)
 */
export function generateEnhancedDialogueBlockEN(ageGroup: string): string {
  const minDialogues = getDialogueMinimum(ageGroup);
  return `
ENHANCED DIALOGUE RULES:
- Minimum ${minDialogues} dialogues per chapter (age group ${ageGroup})
- Most dialogues include action beats (gesture or movement before/after)
- Vary dialogue tags; avoid overusing "said"
- Never output dialogue lists; weave dialogue into the prose
`.trim();
}

/**
 * NEW v3.0: Generate emotional arc rules
 */
export function generateEmotionalArcBlockEN(): string {
  return `
â¤ï¸ EMOTIONAL ARC TRACKING (CRITICAL FOR CHARACTER DEVELOPMENT):
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

PROTAGONIST EMOTIONAL JOURNEY:
   Chapter 1: WONDER â†’ Discovering the world, eyes wide, curious
   Chapter 2: DOUBT â†’ "Can I really do this?" Hesitation, questioning
   Chapter 3: DESPAIR â†’ Lowest point, failure, tears, giving up
   Chapter 4: DETERMINATION â†’ "I have to try!" Clenched fists, standing up
   Chapter 5: GROWTH â†’ Success, pride, helping others, lesson learned

SIDEKICK EMOTIONAL JOURNEY:
   Chapter 1: CURIOSITY â†’ Following along, interested
   Chapter 2: CONCERN â†’ Worried about friend, protective
   Chapter 3: FEAR â†’ Danger feels real, trembling
   Chapter 4: COURAGE â†’ Steps up to help when needed most
   Chapter 5: PRIDE â†’ Proud of what they achieved together

SHOW EMOTIONAL TRANSITIONS (Never tell!):
   âŒ "Alexander suddenly felt brave" (TELLING = BAD)
   âœ… "Alexander's hands stopped shaking. He stood up straight." (SHOWING = GOOD)

   âŒ "She decided to trust him" (SHORTCUT = BAD)
   âœ… "She uncrossed her arms. A small smile appeared." (TRANSITION = GOOD)

FORBIDDEN EMOTIONAL SHORTCUTS:
   âŒ "suddenly felt brave"
   âŒ "decided to be happy"
   âŒ "stopped being scared"
   âŒ "chose to trust"
`;
}

/**
 * NEW v3.0: Generate leitmotif rules
 */
export function generateLeitmotifBlockEN(): string {
  return `
ðŸŽµ RECURRING MOTIFS (LEITMOTIFS) - PROFESSIONAL TECHNIQUE:
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

CHOOSE 2-3 RECURRING MOTIFS for the story:

SOUND MOTIF (appears 5x across all chapters):
   Examples: "the nightingale's song", "porcelain tinkling", "wind chimes"
   Ch1: Introduce subtly â†’ Ch3: Threatened/lost â†’ Ch5: Returns triumphantly

COLOR MOTIF (appears 5x):
   Examples: "gold vs. gray", "the red thread", "silver moonlight"
   Use to reinforce theme: Gold = true, Gray = artificial

RECURRING LINE (appears 3x):
   Examples: "echte Stimme" (true voice), "the real song"
   Character says it, then it becomes the moral lesson

OBJECT MOTIF (appears 4x):
   Examples: "the porcelain heart", "the silver feather", "the old key"
   Ch1: Shown â†’ Ch2: Used â†’ Ch4: Crucial â†’ Ch5: Symbolic resolution

MOTIF ARC PATTERN:
   Chapter 1: Introduce subtly (mentioned in passing)
   Chapter 2: Reinforce (appears again, more prominent)
   Chapter 3: Challenge or threaten (motif is in danger)
   Chapter 4: Transform or use (motif becomes important)
   Chapter 5: Resolution payoff (motif completes its arc)
`;
}

/**
 * NEW v3.0: Generate POV consistency rules
 */
export function generatePOVBlockEN(): string {
  return `
ðŸ‘ï¸ POV (POINT OF VIEW) CONSISTENCY:
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

CHAPTER POV ASSIGNMENT:
   Chapter 1: PROTAGONIST's perspective (Alexander)
   Chapter 2: SIDEKICK's perspective (Adrian)
   Chapter 3: PROTAGONIST's perspective (back to Alexander)
   Chapter 4: SIDEKICK's perspective (Adrian's moment to shine)
   Chapter 5: SHARED perspective (both contribute equally)

POV INDICATORS (stay consistent within chapter):
   â€¢ Whose THOUGHTS we access: Only POV character's inner feelings
   â€¢ Whose BODY we follow: Camera stays with POV character
   â€¢ Whose DIALOGUE opens: POV character speaks first or is focus

POV SWITCHING RULES:
   âŒ Don't switch POV mid-paragraph
   âŒ Don't access multiple characters' thoughts in same scene
   âœ… Use transitions when switching: "Meanwhile, Adrian..."
   âœ… Use scene breaks for POV changes

EXAMPLE:
   Chapter 2 (Adrian's POV):
   âœ… "Adrian's heart raced. What would Alexander do?"
   âŒ "Adrian's heart raced. Alexander felt confident." (Switching!)
`;
}

/**
 * NEW v3.0: Generate chapter balance rules
 */
export function generateChapterBalanceBlockEN(ageGroup: string): string {
  const wordTarget = getChapterWordTarget(ageGroup);
  return `
CHAPTER BALANCE RULES:
- Word count per chapter: min ${wordTarget.min}, target ${wordTarget.target}, max ${wordTarget.max}
- Max variance between chapters: ${wordTarget.variance} words
- Pacing balance: action 35-65%, dialogue 20-40%, description 10-30%
- Sentence rhythm: mix short (3-7 words) and medium (8-15 words)
`.trim();
}

/**
 * NEW v3.0: Generate style reference block
 */
export function generateStyleReferenceBlockEN(genre: string): string {
  const styleByGenre: Record<string, string> = {
    adventure: 'lindgren',
    fairy_tale: 'preussler',
    fairy_tales: 'preussler',
    humor: 'donaldson',
    fantasy: 'preussler',
    friendship: 'lindgren',
  };

  const style = styleByGenre[genre] || 'preussler';

  const styleDescriptions: Record<string, string> = {
    lindgren: `
WRITE LIKE ASTRID LINDGREN (Ronja RÃ¤ubertochter, Pippi Langstrumpf):
   â€¢ NATURE: Alive, breathing, almost a character itself
   â€¢ CHILDREN: Brave but vulnerable, make real mistakes, have real emotions
   â€¢ DANGER: Real but not traumatizing - always a way out
   â€¢ HUMOR: Dry, understated, often hidden in dialogue
   â€¢ EMOTION: Deep feelings shown through action, not named`,

    donaldson: `
WRITE LIKE JULIA DONALDSON (Der GrÃ¼ffelo, Stockmann):
   â€¢ RHYTHM: Strong rhythmic patterns, memorable phrases
   â€¢ REPETITION: Stylistic repetition for emphasis ("He was BIG. He was STRONG.")
   â€¢ VILLAINS: Scary but defeatable through cleverness
   â€¢ RESOLUTION: Satisfying, often with a clever twist
   â€¢ LANGUAGE: Playful, with sounds and wordplay`,

    preussler: `
WRITE LIKE OTFRIED PREUÃŸLER (Die kleine Hexe, RÃ¤uber Hotzenplotz):
   â€¢ ATMOSPHERE: Dark but cozy, mysterious but safe
   â€¢ MAGIC: Subtle, integrated into everyday life (not flashy)
   â€¢ CHARACTERS: Quirky, memorable, often with catchphrases
   â€¢ LESSONS: Deep but not preachy, woven naturally into plot
   â€¢ TONE: Warm even in danger, humor in unexpected places`,
  };

  return `
ðŸ“š PROFESSIONAL STYLE REFERENCE:
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
${styleDescriptions[style]}
`;
}

/**
 * Generate the complete ENGLISH professional storytelling rules block
 * This is the recommended version for GPT-5 prompts
 * VERSION 3.1 - Concise, conflict-free core rules
 */
export function generateCompleteRulesBlockEN(ageGroup: string, targetLanguage: string = 'German', genre: string = 'fairy_tales'): string {
  const wordTarget = getChapterWordTarget(ageGroup);
  const minDialogues = getDialogueMinimum(ageGroup);
  const styleHintByGenre: Record<string, string> = {
    adventure: 'brisk pacing, clear external stakes, vivid action',
    fairy_tale: 'classic fairy-tale warmth, gentle wonder, clear morality',
    fairy_tales: 'classic fairy-tale warmth, gentle wonder, clear morality',
    humor: 'playful rhythm, light humor, warm resolution',
    fantasy: 'soft magic, cozy atmosphere, clear visual setpieces',
    friendship: 'warm character focus, empathy, gentle humor',
  };
  const styleHint = styleHintByGenre[genre] || 'classic storybook warmth with clear action and heart';

  return `
PROFESSIONAL CHILDREN'S BOOK QUALITY RULES:
- Write story content in ${targetLanguage}. Instructions are in English.
- Age group ${ageGroup}: simple concrete language, clear emotional beats.
- Word count per chapter: min ${wordTarget.min}, target ${wordTarget.target}, max ${wordTarget.max}. Keep variance under ${wordTarget.variance} words.
- Dialogue: at least ${minDialogues} per chapter with action beats. Avoid dialogue lists.
- Show, do not tell: reveal emotions through actions and body language.
- Chapter structure: open with action or vivid image; end chapters 1-4 with tension.
- No meta labels in the prose (e.g., "Dialogues:", "Senses:").
- Style: ${styleHint}.
`.trim();
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Constants v2.0
  FORBIDDEN_OUTPUT_PATTERNS,
  containsMetaPatterns,
  AGE_GROUP_RULES,
  getChapterWordTarget,
  getDialogueMinimum,
  TITLE_RULES,
  DIALOGUE_RULES,
  SHOW_DONT_TELL,
  CHAPTER_STRUCTURE,
  REPETITION_TECHNIQUE,
  SENSORY_RULES,

  // NEW v3.0 Constants
  FORESHADOWING_RULES,
  ENHANCED_DIALOGUE_RULES,
  CHAPTER_BALANCE_RULES,
  REPETITION_DETECTION,
  POV_RULES,
  IMAGE_PROMPT_RULES,
  LEITMOTIF_RULES,
  EMOTIONAL_ARC_RULES,
  STYLE_REFERENCES,

  // German generators (legacy)
  generateAntiPatternBlock,
  generateAgeLanguageBlock,
  generateTitleBlock,
  generateDialogueBlock,
  generateShowDontTellBlock,
  generateChapterStructureBlock,
  generateCompleteRulesBlock,

  // English generators v2.0 (RECOMMENDED for GPT-5)
  generateAntiPatternBlockEN,
  generateAgeLanguageBlockEN,
  generateTitleBlockEN,
  generateDialogueBlockEN,
  generateShowDontTellBlockEN,
  generateChapterStructureBlockEN,

  // NEW v3.0 English generators
  generateForeshadowingBlockEN,
  generateEnhancedDialogueBlockEN,
  generateEmotionalArcBlockEN,
  generateLeitmotifBlockEN,
  generatePOVBlockEN,
  generateChapterBalanceBlockEN,
  generateStyleReferenceBlockEN,

  // Complete Rules Block v3.0 (includes all optimizations)
  generateCompleteRulesBlockEN,
};





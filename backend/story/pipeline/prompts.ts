import type { CastSet, SceneDirective, StoryDNA, TaleDNA, AvatarMemoryCompressed } from "./types";

// ─── Character Profile Builder ────────────────────────────────────────────────
// Baut ein kompaktes, einzigartiges Charakter-Profil aus den DB-Properties

interface CharacterSheet {
  displayName: string;
  roleType?: string;
  slotKey?: string;
  personalityTags?: string[];
  speechStyleHints?: string[];
  visualSignature?: string[];
  enhancedPersonality?: {
    dominant?: string;
    catchphrase?: string;
    quirk?: string;
    emotionalTriggers?: string[];
    secondaryTraits?: string[];
  };
  // DB-Properties
  archetype?: string;
  role?: string;
  species?: string;
  catchphraseContext?: string;
}

/**
 * Baut eine einzigartige Charakter-Beschreibung mit:
 * - Beruf/Spezies-spezifischen Fähigkeiten
 * - Persönlichkeit und Quirks
 * - Sprechstil mit Beispiel
 * - Catchphrase mit Kontext
 */
function buildCharacterProfile(sheet: CharacterSheet, isGerman: boolean): string {
  const ep = sheet.enhancedPersonality;
  const name = sheet.displayName;

  // Persönlichkeit aus DB oder Fallback
  const personality = sheet.personalityTags?.slice(0, 3).join(", ")
    || ep?.dominant
    || "neugierig";

  // Sekundäre Traits
  const secondaryTraits = ep?.secondaryTraits?.slice(0, 3).join(", ")
    || sheet.personalityTags?.slice(3, 6).join(", ")
    || "";

  // Sprechstil
  const speechStyle = sheet.speechStyleHints?.slice(0, 2).join(", ") || "normal";

  // Quirk (Marotte)
  const quirk = ep?.quirk || "";

  // Catchphrase mit Kontext
  const catchphrase = ep?.catchphrase || "";
  const catchphraseContext = sheet.catchphraseContext || ep?.emotionalTriggers?.[0] || "";

  // Archetype -> Fähigkeiten/Beruf
  const archetype = sheet.archetype || "";
  const species = sheet.species || "";

  // Baue kompakte Zeilen
  let lines: string[] = [];

  // Zeile 1: Name + Kernpersönlichkeit
  let line1 = `**${name}**`;
  if (sheet.roleType === "AVATAR") {
    line1 += ` (Kind)`;
  } else if (species && !species.includes("human_child")) {
    // Spezies/Beruf für Nicht-Kinder
    const speciesLabel = getSpeciesLabel(species, isGerman);
    if (speciesLabel) line1 += ` (${speciesLabel})`;
  }
  line1 += `: ${personality}`;
  if (secondaryTraits) line1 += `; ${secondaryTraits}`;
  lines.push(line1);

  // Zeile 2: Sprechstil mit Beispiel
  const speechExample = generateSpeechExample(name, speechStyle, catchphrase, isGerman);
  lines.push(`  - Spricht: ${speechStyle}. ${speechExample}`);

  // Zeile 3: Quirk + Catchphrase (wenn vorhanden)
  if (quirk || catchphrase) {
    let line3 = "  -";
    if (quirk) line3 += ` Marotte: ${quirk}.`;
    if (catchphrase && catchphraseContext) {
      line3 += ` Spruch (${catchphraseContext}): „${catchphrase}"`;
    } else if (catchphrase) {
      line3 += ` Spruch: „${catchphrase}"`;
    }
    lines.push(line3);
  }

  // Zeile 4: Berufsspezifische Fähigkeit (basierend auf Archetype)
  const ability = getArchetypeAbility(archetype, species, isGerman);
  if (ability) {
    lines.push(`  - Kann: ${ability}`);
  }

  return lines.join("\n");
}

/**
 * Gibt eine lesbare Spezies-Bezeichnung zurück
 */
function getSpeciesLabel(species: string, isGerman: boolean): string {
  const labels: Record<string, string> = {
    "human_baker": isGerman ? "Bäcker" : "Baker",
    "human_postman": isGerman ? "Postbote" : "Postman",
    "human_firefighter": isGerman ? "Feuerwehrfrau" : "Firefighter",
    "human_police": isGerman ? "Polizist" : "Police Officer",
    "human_witch": isGerman ? "Hexe" : "Witch",
    "human_wizard": isGerman ? "Zauberer" : "Wizard",
    "human_knight": isGerman ? "Ritter" : "Knight",
    "human_sailor": isGerman ? "Kapitän" : "Captain",
    "human_gardener": isGerman ? "Gärtnerin" : "Gardener",
    "human_teacher": isGerman ? "Lehrerin" : "Teacher",
    "human_queen": isGerman ? "Königin" : "Queen",
    "human_king": isGerman ? "König" : "King",
    "human_princess": isGerman ? "Prinzessin" : "Princess",
    "human_astronaut": isGerman ? "Astronautin" : "Astronaut",
    "human_elder": isGerman ? "Oma" : "Grandma",
    "human_bandit": isGerman ? "Räuber" : "Robber",
    "human_bandit_leader": isGerman ? "Räuberhauptmann" : "Robber Captain",
    "human_dark_wizard": isGerman ? "Schwarzmagier" : "Dark Mage",
    "dog": isGerman ? "Hund" : "Dog",
    "cat": isGerman ? "Katze" : "Cat",
    "squirrel": isGerman ? "Eichhörnchen" : "Squirrel",
    "unicorn": isGerman ? "Einhorn" : "Unicorn",
    "fairy": isGerman ? "Fee" : "Fairy",
    "dragon_small": isGerman ? "kleiner Drache" : "Small Dragon",
    "goblin": isGerman ? "Kobold" : "Goblin",
    "troll": isGerman ? "Troll" : "Troll",
    "dwarf": isGerman ? "Zwerg" : "Dwarf",
    "robot": isGerman ? "Roboter" : "Robot",
    "frog": isGerman ? "Frosch" : "Frog",
    "fox_detective": isGerman ? "Fuchs-Detektiv" : "Fox Detective",
  };
  return labels[species] || "";
}

/**
 * Gibt berufsspezifische Fähigkeiten basierend auf Archetype zurück
 */
function getArchetypeAbility(archetype: string, species: string, isGerman: boolean): string {
  // Spezies-basierte Fähigkeiten haben Vorrang
  const speciesAbilities: Record<string, string> = {
    "human_baker": isGerman
      ? "backen, Teig kneten, mit Essen trösten"
      : "bake, knead dough, comfort with food",
    "human_firefighter": isGerman
      ? "löschen, retten, Leitern erklimmen"
      : "extinguish fires, rescue, climb ladders",
    "human_police": isGerman
      ? "Ordnung halten, Regeln durchsetzen, Hinweise finden"
      : "keep order, enforce rules, find clues",
    "human_witch": isGerman
      ? "Zaubertränke brauen, Zaubersprüche wirken, mit dem Besen fliegen"
      : "brew potions, cast spells, fly on broom",
    "human_wizard": isGerman
      ? "mächtige Magie wirken, die Zukunft sehen, weise Ratschläge geben"
      : "cast powerful magic, see the future, give wise advice",
    "human_gardener": isGerman
      ? "Pflanzen zum Wachsen bringen, Kräuter kennen, die Natur verstehen"
      : "make plants grow, know herbs, understand nature",
    "human_knight": isGerman
      ? "kämpfen (theoretisch), beschützen, stolpern aber aufstehen"
      : "fight (theoretically), protect, trip but get up",
    "human_sailor": isGerman
      ? "navigieren, Seile knoten, Seegeschichten erzählen"
      : "navigate, tie knots, tell sea stories",
    "human_teacher": isGerman
      ? "erklären, korrigieren, Wissen teilen"
      : "explain, correct, share knowledge",
    "human_doctor": isGerman
      ? "heilen, Wunden versorgen, beruhigen"
      : "heal, treat wounds, calm down",
    "dog": isGerman
      ? "Spuren erschnüffeln, treu folgen, bellen bei Gefahr"
      : "sniff out trails, follow loyally, bark at danger",
    "cat": isGerman
      ? "leise schleichen, hoch springen, elegant ignorieren"
      : "sneak quietly, jump high, elegantly ignore",
    "unicorn": isGerman
      ? "heilen, telepathisch kommunizieren, Regenbogen hinterlassen"
      : "heal, communicate telepathically, leave rainbows",
    "fairy": isGerman
      ? "Glitzerstaub verteilen, fliegen, kleine Zauber wirken"
      : "spread glitter dust, fly, cast small spells",
    "dragon_small": isGerman
      ? "Feuer spucken (ein bisschen), fliegen (wackelig), süß aussehen"
      : "breathe fire (a little), fly (wobbly), look cute",
    "goblin": isGerman
      ? "stehlen, tricksen, kichern, schnell verschwinden"
      : "steal, trick, giggle, disappear quickly",
    "troll": isGerman
      ? "Brücken blockieren, stark sein, mit Essen bestochen werden"
      : "block bridges, be strong, be bribed with food",
    "dwarf": isGerman
      ? "graben, Gold erkennen, handwerken"
      : "dig, recognize gold, craft",
    "robot": isGerman
      ? "berechnen, analysieren, logisch denken, piepen"
      : "calculate, analyze, think logically, beep",
    "squirrel": isGerman
      ? "klettern, Nüsse sammeln, nervös herumspringen"
      : "climb, collect nuts, jump around nervously",
  };

  if (species && speciesAbilities[species]) {
    return speciesAbilities[species];
  }

  // Archetype-basierte Fähigkeiten als Fallback
  const archetypeAbilities: Record<string, string> = {
    "merchant": isGerman ? "handeln, Waren anbieten, überzeugen" : "trade, offer goods, persuade",
    "investigator": isGerman ? "Hinweise finden, kombinieren, beobachten" : "find clues, combine, observe",
    "caregiver": isGerman ? "trösten, füttern, umsorgen" : "comfort, feed, care for",
    "guardian": isGerman ? "beschützen, warnen, Regeln durchsetzen" : "protect, warn, enforce rules",
    "mentor": isGerman ? "lehren, beraten, Weisheit teilen" : "teach, advise, share wisdom",
    "hero_helper": isGerman ? "retten, helfen, mutig eingreifen" : "rescue, help, bravely intervene",
    "magical_helper": isGerman ? "mit Magie helfen, verzaubern" : "help with magic, enchant",
    "magical_trickster": isGerman ? "tricksen mit Magie, verwirren" : "trick with magic, confuse",
    "magical_creature": isGerman ? "magische Kräfte nutzen, heilen" : "use magical powers, heal",
    "animal_companion": isGerman ? "treu begleiten, Gefahren wittern" : "accompany loyally, sense danger",
    "animal_trickster": isGerman ? "tricksen, schnell sein, ablenken" : "trick, be fast, distract",
    "creature": isGerman ? "besondere Kreatur-Fähigkeiten" : "special creature abilities",
    "trickster": isGerman ? "stehlen, tricksen, entkommen" : "steal, trick, escape",
    "villain": isGerman ? "Pläne schmieden, drohen, scheitern" : "make plans, threaten, fail",
    "explorer": isGerman ? "entdecken, erforschen, mutig vorangehen" : "discover, explore, lead bravely",
    "adventurer": isGerman ? "Abenteuer erleben, Geschichten erzählen" : "have adventures, tell stories",
    "royal": isGerman ? "befehlen, repräsentieren, Würde zeigen" : "command, represent, show dignity",
  };

  return archetypeAbilities[archetype] || "";
}

/**
 * Generiert ein kurzes Sprechbeispiel basierend auf dem Stil
 */
function generateSpeechExample(name: string, speechStyle: string, catchphrase: string, isGerman: boolean): string {
  // Wenn Catchphrase vorhanden, als Beispiel nutzen
  if (catchphrase && catchphrase.length < 50) {
    return `Beispiel: „${catchphrase}"`;
  }

  // Generiere Beispiel basierend auf Sprechstil
  const styleExamples: Record<string, string> = {
    "fast": isGerman ? `Beispiel: „Schnell-schnell! Keine Zeit!"` : `Example: "Quick-quick! No time!"`,
    "breathless": isGerman ? `Beispiel: „Schnell-schnell! Keine Zeit!"` : `Example: "Quick-quick! No time!"`,
    "woof": isGerman ? `Beispiel: „Wuff! Ich riech was! Wuff-wuff!"` : `Example: "Woof! I smell something! Woof-woof!"`,
    "barking": isGerman ? `Beispiel: „Wuff! Ich riech was! Wuff-wuff!"` : `Example: "Woof! I smell something! Woof-woof!"`,
    "giggling": isGerman ? `Beispiel: „Hihihi! Erwischt! Kicher-kicher!"` : `Example: "Hehehe! Caught you! Giggle-giggle!"`,
    "rhyming": isGerman ? `Beispiel: „Eins-zwei-drei, Zauber frei!"` : `Example: "One-two-three, magic free!"`,
    "telepathic": isGerman ? `Beispiel: „*Habt keine Furcht. Euer Mut leuchtet.*"` : `Example: "*Fear not. Your courage shines.*"`,
    "gentle": isGerman ? `Beispiel: „*Folgt eurem Herzen...*"` : `Example: "*Follow your heart...*"`,
    "mechanical": isGerman ? `Beispiel: „Piep-Piep. Analyse komplett."` : `Example: "Beep-Boop. Analysis complete."`,
    "croaking": isGerman ? `Beispiel: „Quaaak! Ich bin ein Prinz! Wirklich!"` : `Example: "Croak! I'm a prince! Really!"`,
    "grumbling": isGerman ? `Beispiel: „Grmpf. Was willst du?"` : `Example: "Grmpf. What do you want?"`,
    "whispering": isGerman ? `Beispiel: „Psst... kommt näher..."` : `Example: "Psst... come closer..."`,
    "regal": isGerman ? `Beispiel: „Wir befehlen, dass..."` : `Example: "We command that..."`,
    "squeaky": isGerman ? `Beispiel: „Pieps! Eine Nuss! Da! Da!"` : `Example: "Squeak! A nut! There! There!"`,
  };

  // Suche nach passendem Beispiel
  for (const [style, example] of Object.entries(styleExamples)) {
    if (speechStyle.toLowerCase().includes(style)) {
      return example;
    }
  }

  return "";
}

function buildChildVoiceContract(childNames: string[], _isGerman: boolean): string {
  if (childNames.length === 0) return "";

  const templates = [
    "Impulsive and questioning: 3-8 words, frequent why/how questions, quick reactions.",
    "Calm and observant: concrete details, clear reasoning, few exclamations.",
    "Playful and witty: short wordplay, lightens tension without gimmick loops.",
  ];

  const lines = childNames
    .slice(0, 3)
    .map((name, idx) => `  - ${name}: ${templates[idx] || templates[templates.length - 1]}`)
    .join("\n");

  const globalRule = "  - Global: Do not give all children the same speaker formulas (avoid repeated 'said ... briefly/quietly' patterns).";

  return `${lines}\n${globalRule}`;
}

// ─── Golden Example & Anti-Patterns ──────────────────────────────────────────

function buildGoldenExampleBlock(isGerman: boolean): string {
  // Golden example is always in German (shows target output quality for German stories)
  // Instructions are in English (more efficient for LLM processing)
  const germanExample = `"""
Als Mama den Korb auf den Kuechentisch knallte, rutschte der Deckel schief. Plopp.

Adrian war sofort da. „Darf ich—"

„Nein", sagte Mama. So schnell, als waere der Deckel ein Krokodilmaul.

Alexander beugte sich vor. „Ich riech Apfelkuchen."

„Und Tee", sagte Adrian. Er schnupperte extra laut. „Und... Oma."

Mama nickte. „Oma hat Schnupfen. Den grossen." Sie machte eine Handbewegung wie eine Welle. „So einen, bei dem die Gardinen denken: Oh oh."

Adrian grinste. „Oma ist stark."

„Oma ist LAUT", korrigierte Mama. „Und heute braucht sie euch." Sie zaehlte an den Fingern ab. „Kuchen. Tee. Huehnersuppe. Hauptweg. Keine Experimente."
"""`;

  const englishExample = `"""
Mom slammed the basket onto the kitchen table. The lid slipped sideways. Pop.

Adrian was there instantly. "Can I—"

"No," said Mom. That fast, as if the lid were a crocodile's mouth.

Alexander leaned forward. "I smell apple cake."

"And tea," said Adrian. He sniffed extra loud. "And… Grandma."

Mom nodded. "Grandma has a cold. The big kind." She made a wave motion with her hand. "The kind where the curtains think: Uh oh."

Adrian grinned. "Grandma is tough."

"Grandma is LOUD," Mom corrected. "And today she needs you." She counted on her fingers. "Cake. Tea. Chicken soup. Main path. No experiments."
"""`;

  return `# PROSE QUALITY REFERENCE — write EXACTLY like this
This is how a professional children's story sounds. Match this style precisely.
${isGerman ? germanExample : englishExample}

KEY QUALITIES you MUST replicate:
- 40-50% dialogue — dialogue IS the story
- Action verbs: "slammed", "slipped", "leaned", "sniffed" — NOT atmosphere verbs
- ONE comparison per scene max ("as if the lid were a crocodile's mouth") — concrete and funny
- Humor through SITUATION, not through poetic descriptions
- Short sentences, varied rhythm
- Children sound like REAL children — short, direct, concrete`;
}

function buildAntiPatternBlock(isGerman: boolean): string {
  // Instructions always in English, examples in target language
  const badExamples = isGerman
    ? `❌ "Der Wald fluesterte" / "Der Wind wollte sagen" → Nature has NO intentions or feelings
❌ "Blaetter raschelten in kleinen Schlucken" → No synesthesia (mixing unrelated senses)
❌ "als waere sie ein Geheimnis, das atmet" → No personifying objects with human traits
❌ "Das Licht blinkte kalt" / "Metall schmeckte nach Regen" → No forced sensory mashups
❌ "Stille fiel" / "Er spuerte" / "Innen zog sich etwas" → No tell-formulas for emotions`
    : `❌ "The forest whispered" / "The wind wanted to say" → Nature has NO intentions or feelings
❌ "Leaves rustled in small sips" → No synesthesia (mixing unrelated senses)
❌ "as if it were a secret that breathes" → No personifying objects with human traits
❌ "The light blinked coldly" / "Metal tasted like rain" → No forced sensory mashups
❌ "Silence fell" / "She felt" / "Something inside pulled" → No tell-formulas for emotions`;

  const goodExamples = isGerman
    ? `✅ "Mama knallte den Korb auf den Tisch. Plopp." → Strong verb, clear sound, done.
✅ "'Darf ich—' 'Nein', sagte Mama." → Quick dialogue reveals character
✅ "Er schnupperte extra laut." → Concrete physical action shows personality`
    : `✅ "Mom slammed the basket on the table. Pop." → Strong verb, clear sound, done.
✅ "'Can I—' 'No,' said Mom." → Quick dialogue reveals character
✅ "He sniffed extra loud." → Concrete physical action shows personality`;

  return `# FORBIDDEN PATTERNS — NEVER write sentences like these:
${badExamples}
❌ Paragraphs without dialogue or action → EVERY paragraph needs action or speech
❌ Long atmospheric descriptions without anyone doing anything → ACTION first, always

INSTEAD write like this:
${goodExamples}
✅ Dialogue 40%. Action 40%. Description max 20%.`;
}

// ─── Optimized Full Story Prompt (V4) ─────────────────────────────────────────
// Kompakter, effektiver, mit dynamischen Charakter-Properties aus DB + Golden Example

export function buildFullStoryPrompt(input: {
  directives: SceneDirective[];
  cast: CastSet;
  dna: TaleDNA | StoryDNA;
  language: string;
  ageRange: { min: number; max: number };
  tone?: string;
  humorLevel?: number;
  totalWordTarget: number;
  totalWordMin: number;
  totalWordMax: number;
  wordsPerChapter: { min: number; max: number };
  stylePackText?: string;
  strict?: boolean;
  fusionSections?: Map<number, string>;
  avatarMemories?: Map<string, AvatarMemoryCompressed[]>;
  userPrompt?: string;
}): string {
  const { directives, cast, dna, language, ageRange, tone, humorLevel, totalWordMin, totalWordMax, wordsPerChapter, stylePackText, fusionSections, avatarMemories, userPrompt } = input;
  const isGerman = language === "de";
  const targetLanguage = isGerman ? "Deutsch" : language;
  const targetTone = tone ?? dna.toneBounds?.targetTone ?? (isGerman ? "warm" : "warm");
  const artifactName = cast.artifact?.name?.trim();
  const artifactRule = cast.artifact?.storyUseRule || (isGerman ? "wichtiges magisches Objekt" : "important magical object");

  const allSlots = new Set(directives.flatMap(d => d.charactersOnStage));
  const allowedNames: string[] = [];
  const characterProfiles: string[] = [];

  for (const slot of allSlots) {
    if (slot.includes("ARTIFACT")) continue;
    const sheet = findCharacterBySlot(cast, slot);
    if (!sheet) continue;
    if (!allowedNames.includes(sheet.displayName)) {
      allowedNames.push(sheet.displayName);
    }
    characterProfiles.push(buildCharacterProfile(sheet as CharacterSheet, isGerman));
  }

  const focusChildNames = cast.avatars.map(a => a.displayName).filter(Boolean);
  const childVoiceContract = buildChildVoiceContract(focusChildNames, isGerman);
  const focusMaxActive = ageRange.max <= 8 ? 3 : 4;
  const focusIdealRange = ageRange.max <= 8 ? "2-3" : "3-4";
  const focusGlobalMax = ageRange.max <= 8 ? 4 : 6;

  const avatarRule = focusChildNames.length >= 2
    ? `- Avatar requirement: ${focusChildNames.join(" and ")} are equal protagonists and must be active in EVERY beat (each beat: at least one action + one dialogue line per child).`
    : focusChildNames.length === 1
      ? `- Protagonist requirement: ${focusChildNames[0]} must be active in EVERY beat (action or dialogue).`
      : "";

  const stylePackBlock = sanitizeStylePackBlock(stylePackText, isGerman);
  const customPromptBlock = formatCustomPromptBlock(userPrompt, isGerman);

  let memorySection = "";
  if (avatarMemories && avatarMemories.size > 0) {
    const memoryTitles: string[] = [];
    for (const avatar of cast.avatars) {
      const memories = avatarMemories.get(avatar.characterId);
      if (!memories || memories.length === 0) continue;
      memoryTitles.push(`${avatar.displayName}: ${memories.map(m => m.storyTitle).join(", ")}`);
    }
    if (memoryTitles.length > 0) {
      memorySection = `\n# Earlier Adventures\n${memoryTitles.join("\n")}\n- Add EXACTLY one short reference: "This reminds me of ..." (do not retell).\n`;
    }
  }

  const beatLines = directives.map((directive, idx) => {
    const castNames = directive.charactersOnStage
      .filter(slot => !slot.includes("ARTIFACT"))
      .map(slot => findCharacterBySlot(cast, slot)?.displayName)
      .filter((name): name is string => Boolean(name));
    const uniqueCast = Array.from(new Set(castNames));
    const fusionHint = fusionSections?.get(directive.chapter)?.split("\n").slice(0, 1).join(" ").trim();
    const artifactTag = artifactName && directive.artifactUsage && !directive.artifactUsage.toLowerCase().includes("nicht")
      ? ` [${artifactName}]`
      : "";

    return `${idx + 1}) Ort: ${trimDirectiveText(directive.setting, 56)}${artifactTag}. Kern: ${trimDirectiveText(directive.goal, 140)}. Konflikt: ${trimDirectiveText(directive.conflict, 130)}. Figuren: ${uniqueCast.join(", ") || "keine"}. Impuls: ${trimDirectiveText(directive.outcome, 90)}${fusionHint ? ` Hinweis: ${trimDirectiveText(fusionHint, 70)}` : ""}`;
  }).join("\n\n");

  const safetyRule = "No explicit violence, no weapons, no blood, no horror, no bullying, no politics/religion, no drugs/alcohol/gambling.";

  const titleHint = "Max 6 words, curiosity-driven, avoid 'object and person' pattern.";

  const humorTarget = Math.max(0, Math.min(3, Number.isFinite(humorLevel as number) ? Number(humorLevel) : 2));
  const humorRule = humorTarget >= 3
    ? "High humor target: at least 3 clear child-friendly laugh moments (dialogue wit, situational comedy, harmless mishap)."
    : humorTarget >= 2
      ? "Medium humor target: at least 2 clear child-friendly laugh moments."
      : humorTarget >= 1
        ? "Light humor target: at least 1 child-friendly humorous beat."
        : "Humor optional: no forced jokes.";

  const goldenExample = buildGoldenExampleBlock(isGerman);
  const antiPatterns = buildAntiPatternBlock(isGerman);

  const outputLang = isGerman ? "German" : targetLanguage;
  const umlautRule = isGerman ? " Use proper German umlauts (ä, ö, ü, ß), never ASCII substitutes like ae/oe/ue. No English words in the story text." : "";

  return `YOU ARE: Screenwriter for children's films AND children's book author (Preussler + Lindgren + Funke). You think in SCENES: dialogue, action, reaction.
GOAL: Children (${ageRange.min}-${ageRange.max}) want to keep reading on their own. Every paragraph must contain action or dialogue.

${goldenExample}

${antiPatterns}

HARD RULES (must be fulfilled):
1) Language: Write the story ONLY in ${outputLang}.${umlautRule}
2) Output: Valid JSON only. No text before or after.
3) Length: ${totalWordMin}-${totalWordMax} words total.
4) Structure: Exactly ${directives.length} chapters in the "chapters" JSON array (chapter: 1..${directives.length}). No headings or numbers in the text. Each chapter approximately ${wordsPerChapter.min}-${wordsPerChapter.max} words.
5) Cast lock: Only these characters: ${allowedNames.join(", ")}. No new characters.
6) Rule priority: Hard Rules ALWAYS override additional user examples. Example names (e.g. Mia, Emma) are never new characters.
7) Character focus: Per beat max ${focusMaxActive} active characters (ideal ${focusIdealRange}), global max ${focusGlobalMax} recognizable characters.
8) Child-safe: ${safetyRule}
9) Artifact: ${artifactName || "artifact"} (${artifactRule}). Arc: Discover -> Misdirection/Problem -> clever use (does NOT solve alone).
10) Show, don't tell: Emotions ONLY through body action and dialogue. NO atmosphere descriptions without action. NO personifying nature.
11) No deus ex machina. Solution comes from courage + teamwork + smart decision.
12) DIALOGUE REQUIREMENT: At least 40% of text must be dialogue. No paragraph longer than 3 sentences without dialogue or direct action.

STYLE (MOST IMPORTANT — follow strictly):
- Target tone: ${targetTone}.
- DIALOGUE FIRST: The story is told THROUGH dialogue. Description is only stage direction between dialogues.
- Mostly short sentences (6-12 words), occasionally a longer one for swing. No sentence monsters.
- Per beat at least FOUR short dialogue exchanges between characters.
- Each character has their own voice (word choice, sentence length, quirk).
- Separate children's voices sharply:
${childVoiceContract || "  - No children's voices available"}
- NO poetic language. Grounded, concrete, everyday.
- Maximum 1 comparison per chapter (must be funny or surprising, not poetic).
- NO personifying nature or objects (no "the wind wanted", no "the forest whispered").
- NO synesthesia (no "light tasted", no "silence smelled like").
- Action verbs over atmosphere verbs: "slammed", "grabbed", "snapped" instead of "shimmered", "whispered", "drifted".
- ${humorRule}
- Humor rule: Use situational comedy and short misunderstandings; never explain jokes.
- Running gag rule: same onomatopoeia/catchphrase sparingly (max 2x per chapter, max 6x total).
- By beat 2 at the latest: clear consequence of failure with concrete loss.
- Beat ${directives.length}: show concrete gain + small price/compromise.
- Vary beat endings; beat ${directives.length} ends warm and closed.
- From chapter 2 onward, the first sentence must carry a visible transition (movement/time/arrival).
- No meta-labels, preview sentences, summary sentences, or teaching sentences in prose.

${avatarRule ? `${avatarRule}\n` : ""}${stylePackBlock ? `STYLE PACK (additional):\n${stylePackBlock}\n\n` : ""}${customPromptBlock ? `${customPromptBlock}\n` : ""}CHARACTER VOICES:
${characterProfiles.join("\n\n")}
${memorySection}${artifactName ? `\n# Artifact Arc\n- Name: ${artifactName}\n- Use: ${artifactRule}\n- Required arc: Discover -> Misdirection -> clever use by the children.\n` : ""}
# BEAT DIRECTIVES
${beatLines}

# INTERNAL WRITING PROCESS (do not output)
- First create a short internal beat sketch.
- Write the story chapter by chapter in the "chapters" array.
- CHECK BEFORE OUTPUT: Is dialogue at least 40%? Are there paragraphs without action or dialogue? Any poetic personification of nature? If yes, revise internally.
- Then output ONLY the final JSON.

# OUTPUT FORMAT
{
  "title": "${titleHint}",
  "description": "${isGerman ? "Ein Teaser-Satz als Frage oder kleines Raetsel" : "A teaser sentence as question or small riddle"}",
  "chapters": [
    { "chapter": 1, "text": "..." }
  ]
}`;
}

export function buildFullStoryRewritePrompt(input: {
  originalDraft: { title: string; description: string; chapters: Array<{ chapter: number; text: string }> };
  directives: SceneDirective[];
  cast: CastSet;
  dna: TaleDNA | StoryDNA;
  language: string;
  ageRange: { min: number; max: number };
  tone?: string;
  humorLevel?: number;
  totalWordMin: number;
  totalWordMax: number;
  wordsPerChapter: { min: number; max: number };
  qualityIssues: string;
  stylePackText?: string;
  userPrompt?: string;
}): string {
  const { originalDraft, directives, cast, dna, language, ageRange, tone, humorLevel, totalWordMin, totalWordMax, wordsPerChapter, qualityIssues, stylePackText, userPrompt } = input;
  const isGerman = language === "de";
  const targetLanguage = isGerman ? "Deutsch" : language;
  const targetTone = tone ?? dna.toneBounds?.targetTone ?? (isGerman ? "warm" : "warm");
  const artifactName = cast.artifact?.name?.trim();

  const allSlots = new Set(directives.flatMap(d => d.charactersOnStage));
  const allowedNames = Array.from(allSlots)
    .map(slot => findCharacterBySlot(cast, slot)?.displayName)
    .filter((name): name is string => Boolean(name))
    .join(", ");

  const focusChildNames = cast.avatars.map(a => a.displayName).filter(Boolean);
  const childVoiceContract = buildChildVoiceContract(focusChildNames, isGerman);
  const avatarRule = focusChildNames.length >= 2
    ? `- ${focusChildNames.join(" and ")} must be active in EVERY beat (each beat: at least one action + one dialogue line per child).`
    : focusChildNames.length === 1
      ? `- ${focusChildNames[0]} must be active in EVERY beat.`
      : "";

  const stylePackBlock = sanitizeStylePackBlock(stylePackText, isGerman);
  const customPromptBlock = formatCustomPromptBlock(userPrompt, isGerman);
  const humorTarget = Math.max(0, Math.min(3, Number.isFinite(humorLevel as number) ? Number(humorLevel) : 2));
  const humorRewriteLine = humorTarget >= 3
    ? "- Keep humor high: at least 3 clear child-friendly laugh moments (dialogue wit or situational comedy, never humiliating)."
    : humorTarget >= 2
      ? "- Keep humor present: at least 2 clear child-friendly laugh moments."
      : humorTarget >= 1
        ? "- Include at least 1 short child-friendly humor moment."
        : "- Humor optional, avoid forced jokes.";

  const originalText = originalDraft.chapters
    .map(ch => `--- Beat ${ch.chapter} ---\n${ch.text}`)
    .join("\n\n");

  const outputLang = isGerman ? "German" : targetLanguage;
  const umlautRule = isGerman ? " Use proper German umlauts (ä, ö, ü, ß), never ASCII substitutes. No English words in story text." : "";
  const antiPatterns = buildAntiPatternBlock(isGerman);

  return `TASK: Rewrite the story so it sounds like a real children's book. Keep plot and character core, improve language, rhythm, and voice.

${antiPatterns}

SPECIFIC PROBLEMS (to fix):
${qualityIssues || "- No specific issues provided; optimize prose, rhythm, and character voices anyway."}

HARD RULES:
1) Language: Write ONLY in ${outputLang}.${umlautRule}
2) Target audience: ${ageRange.min}-${ageRange.max} years, clear and child-appropriate.
3) Cast lock: Only these names allowed: ${allowedNames || "(none)"}. No new characters.
4) Rule priority: Hard Rules override additional requirements. Example names from user texts are not character candidates.
5) Structure: ${directives.length} chapters in order, no chapter titles in prose.
6) Length: ${totalWordMin}-${totalWordMax} words total; per chapter approximately ${wordsPerChapter.min}-${wordsPerChapter.max}.
7) Child-safe: no explicit violence, weapons, blood, horror, bullying, politics/religion, drugs/alcohol/gambling.
8) Show, don't tell: Emotions through body ACTION and DIALOGUE only. No atmosphere without action. No personifying nature.
9) No deus ex machina.
10) Clear, warm ending without cliffhanger.
${artifactName ? `11) Artifact "${artifactName}" stays relevant but doesn't solve alone.` : ""}
${avatarRule || ""}

STYLE GOALS (strictly important):
- Target tone: ${targetTone}.
- DIALOGUE FIRST: At least 40% dialogue. Story told THROUGH what characters say and do.
- Mostly short sentences (6-12 words), occasionally longer for swing.
- Multiple quick dialogue exchanges per beat — children's voices must come alive.
- Separate children's voices sharply:
${childVoiceContract || "  - No children's voices available"}
- Concrete, everyday language: max ONE comparison per chapter, no adult metaphor imagery.
- Break up tell-formulas ("felt", "silence fell", "inside something pulled").
- Avoid speaker formula series ("said ... briefly/quietly", "his/her voice was ...").
- Per beat max one short inner-thought sentence; then back to visible action/dialogue.
- Name concrete stakes early: what is visibly lost if they fail.
${humorRewriteLine}
- Humor through situational comedy and short misunderstandings; never explain jokes.
- Running gag rule: same onomatopoeia/catchphrase sparingly (max 2x per chapter, max 6x total).
- At least one clear tension moment.
- Finale: concrete gain plus small price/compromise.
- From chapter 2: visible transition sentence (movement/time/arrival) before new location.
- No meta-sentences, preview phrases, summary sentences, or teaching sentences in prose.
- FORBIDDEN: personifying nature, mixing senses, poetic metaphors, paragraphs without action/dialogue.

${stylePackBlock ? `STYLE PACK (additional):\n${stylePackBlock}\n\n` : ""}${customPromptBlock ? `${customPromptBlock}\n` : ""}INTERNAL EDITING (do not output):
- Check hard rules, voices, rhythm, show-don't-tell, word count.
- If anything breaks: revise internally.
- Then output only the final JSON.

ORIGINAL TEXT:
${originalText}

OUTPUT FORMAT (JSON only):
{
  "title": "Story title",
  "description": "Teaser sentence",
  "chapters": [
    { "chapter": 1, "text": "..." }
  ]
}`;
}

// --- Chapter Expansion Prompt (V2 - kompakter) --------------------------------

export function buildChapterExpansionPrompt(input: {
  chapter: SceneDirective;
  cast: CastSet;
  dna: TaleDNA | StoryDNA;
  language: string;
  ageRange: { min: number; max: number };
  tone?: string;
  lengthTargets: { wordMin: number; wordMax: number; sentenceMin: number; sentenceMax: number };
  stylePackText?: string;
  originalText: string;
  previousContext?: string;
  nextContext?: string;
  requiredCharacters?: string[];
}): string {
  const { chapter, cast, dna, language, ageRange, tone, lengthTargets, originalText, previousContext, nextContext, requiredCharacters } = input;
  const isGerman = language === "de";
  const artifactName = cast.artifact?.name?.trim();

  const characterNames = chapter.charactersOnStage
    .map(slot => findCharacterBySlot(cast, slot)?.displayName)
    .filter(Boolean) as string[];
  const allowedNames = Array.from(new Set(characterNames)).join(", ");
  const focusChildNames = cast.avatars.map(a => a.displayName).filter(Boolean);
  const emotionalFocus = focusChildNames.length > 0
    ? focusChildNames.slice(0, 2).join(", ")
    : characterNames.slice(0, 2).join(", ");
  const focusMaxActive = ageRange.max <= 8 ? 3 : 4;
  const focusIdealRange = ageRange.max <= 8 ? "2-3" : "3-4";

  const missingLine = requiredCharacters?.length
    ? `\n**FEHLENDE FIGUREN (MUSS FOKUSSIERT EINGEBAUT WERDEN):** ${requiredCharacters.join(", ")}\nJede fehlende Figur benennen + kurze konkrete Aktion. Gesamtlimit bleibt max ${focusMaxActive} aktive Figuren.`
    : "";

  const contextLines = [
    previousContext ? `Vorheriges Kapitel endete: "${previousContext}"` : "",
    nextContext ? `Nächstes Kapitel beginnt: "${nextContext}"` : ""
  ].filter(Boolean).join("\n");

  return `# Aufgabe
Erweitere das Kapitel ohne die Handlung zu ändern. Zeigen, nicht erzählen.
WICHTIG: Lebendige Prosa! Konkrete Details (riechen, schmecken, fühlen), Dialog-Humor, Satz-Variation.

# Szene
- Setting: ${chapter.setting}, Stimmung: ${chapter.mood ?? "COZY"}
- Ziel: ${chapter.goal}
- Figuren: ${allowedNames}
${artifactName && chapter.artifactUsage ? `- Artefakt: ${artifactName} (${chapter.artifactUsage})` : ""}
- Ton: ${tone ?? dna.toneBounds?.targetTone ?? "warm"}, Alter: ${ageRange.min}–${ageRange.max}
${missingLine}

# Länge
**${lengthTargets.wordMin}–${lengthTargets.wordMax} Wörter, ${lengthTargets.sentenceMin}–${lengthTargets.sentenceMax} Sätze**

# Regeln
1. Nur diese Namen: ${allowedNames}
2. Keine neuen Figuren
3. Pro Kapitel max ${focusMaxActive} aktive Figuren, ideal ${focusIdealRange}.
4. Keine Meta-Labels im Text.
5. Kapitel-Rhythmus: kurz/schnell -> ruhig/emotional -> kurz/schnell.
6. Mindestens 1 innerer Kinder-Moment von ${emotionalFocus} (Koerpersignal + Gedanke).
7. Erweitern durch konkrete Aktion + 2-3 Dialog-Zeilen.
8. Sprachdichte steuern: max 1 Vergleich pro Absatz, keine Metaphernketten.
9. Kapitel muss spuerbar Spannung tragen: Hindernis wird groesser ODER ein kleiner Rueckschlag passiert.
10. Dialoge muessen unterscheidbar klingen; Rollenlabels mit Namen nur einmal bei Einfuehrung, danach Name/Pronomen.
11. LESBARKEIT BEWAHREN: Saetze MEIST 4-10 Woerter, max 15 % duerfen bis 14 Woerter haben. KEINEN Satz ueber 16 Woerter. Kurze Saetze = besser als lange.
12. VORHANDENE PROSA NICHT VERSCHLECHTERN: Wenn der Originaltext bereits kurze, rhythmische Saetze hat, behalte diesen Stil bei. Fuege fehlende Figuren durch NEUE kurze Saetze ein, nicht durch Aufblaehen vorhandener Saetze.
13. KEINE Meta-Labels oder Schablonen-Saetze im Fliesstext (z. B. "Der Ausblick:", "Hook:", "Ort:", "Stimmung:", "Kapitel 1").
14. Keine Vorschau-Saetze wie "Bald wuerden sie...", "Ein Ausblick blieb..." oder "Noch wussten sie nicht...".
15. Keine Erklaersaetze ueber Objektregeln ("X zeigt...", "X bedeutet..."). Wirkung nur durch Szene + Reaktion + kurze Rede.
16. Keine Zusammenfassungs-Saetze wie "Die Konsequenz war klar", "Der Preis?" oder "Der Gewinn?".
17. Vermeide Serien-Formeln fuer Sprecher ("sagte ... kurz/knapp/leise", "seine Stimme war ...").
18. Running Gag dosieren: gleiche Lautmalerei/Catchphrase max 2x in diesem Kapitel.
19. Bei deutscher Ausgabe: verwende echte Umlaute (ä, ö, ü, ß), keine Umschriften wie ae/oe/ue.

${contextLines ? `# Kontext\n${contextLines}\n` : ""}
# Original
${originalText}

# Ausgabe
JSON: { "text": "Kapiteltext" }`;
}

// ─── Legacy functions (für Kompatibilität) ────────────────────────────────────

export function buildStoryChapterPrompt(input: {
  chapter: SceneDirective;
  cast: CastSet;
  dna: TaleDNA | StoryDNA;
  language: string;
  ageRange: { min: number; max: number };
  tone?: string;
  lengthHint?: string;
  pacing?: string;
  lengthTargets?: { wordMin: number; wordMax: number; sentenceMin: number; sentenceMax: number };
  stylePackText?: string;
  strict?: boolean;
}): string {
  const { chapter, cast, dna, language, ageRange, tone, strict, lengthHint, pacing, lengthTargets: overrideTargets, stylePackText } = input;
  const isGerman = language === "de";
  const lengthTargets = overrideTargets ?? resolveLengthTargets({ lengthHint, ageRange, pacing });
  const artifactName = cast.artifact?.name?.trim();
  const personalityLabel = "Personality";
  const speechLabel = "Speech style";
  const characterSummaries = chapter.charactersOnStage
    .map(slot => {
      const sheet = findCharacterBySlot(cast, slot);
      if (!sheet) return null;
      const signature = sheet.visualSignature?.length ? sheet.visualSignature.join(", ") : "distinct look";
      const personality = sheet.personalityTags?.length ? `${personalityLabel}: ${sheet.personalityTags.slice(0, 4).join(", ")}` : "";
      const speech = sheet.speechStyleHints?.length ? `${speechLabel}: ${sheet.speechStyleHints.slice(0, 2).join(", ")}` : "";
      const extras = [personality, speech].filter(Boolean).join("; ");
      return `${sheet.displayName} (${sheet.roleType}) - ${signature}${extras ? `; ${extras}` : ""}`;
    })
    .filter(Boolean)
    .join("\n");

  const allowedNames = Array.from(new Set(
    chapter.charactersOnStage
      .map(slot => findCharacterBySlot(cast, slot)?.displayName)
      .filter(Boolean) as string[]
  )).join(", ");

  const artifactLine = chapter.artifactUsage
    ? `Artifact usage: ${chapter.artifactUsage}${artifactName ? ` (Name: ${artifactName} must be named)` : ""}`
    : "";

  return `You are a professional children's story author.

Write Chapter ${chapter.chapter} for a ${ageRange.min}-${ageRange.max} year old audience in ${isGerman ? "German" : language}.
Tone: ${tone ?? dna.toneBounds?.targetTone ?? "warm"}.

SCENE DIRECTIVE:
- Setting: ${chapter.setting}
- Mood: ${chapter.mood ?? "COZY"}
- Goal: ${chapter.goal}
- Conflict: ${chapter.conflict}
- Outcome: ${chapter.outcome}
- Characters on stage (must include all):
${characterSummaries}
${artifactLine}
${stylePackText ? `\n${stylePackText}\n` : ""}

Allowed names (use exactly): ${allowedNames || "none"}

STRICT RULES:
1) Use only the listed character names exactly as given. No extra named characters.
2) Do not introduce any additional named characters or animals; if absolutely needed, keep them unnamed.
3) Each character must have a concrete action or short line; no name lists.
4) Mention the artifact if required (by name).
5) Write ${lengthTargets.wordMin}-${lengthTargets.wordMax} words, ${lengthTargets.sentenceMin}-${lengthTargets.sentenceMax} sentences, age-appropriate.
6) No placeholder chapters. If the scene feels short, expand with a concrete action sequence + 2-3 short dialogue lines.
7) Children's-book style: vivid imagery, rhythmic flow, varied sentence starts, occasional dialogue.
8) Do not state belonging explicitly; show it through actions. Avoid phrases like "always been part of this tale".
9) Avoid stock phrases like "makes an important decision", "has a special idea", "shows a new ability", "feels the tension", "decisive clue", "important hint", "question that unties the knot".
10) Avatars and supporting characters must be actively involved, not just present.
11) End naturally with momentum or a warm closure (except final chapter); never use label phrases like "Der Ausblick:" or "Outlook:".
12) Avoid repetitive speaker formulas ("said ... briefly/quietly", "his/her voice was ...").
13) Keep running gags sparse: same onomatopoeia/catchphrase at most 2 times in this chapter.
14) No summary-meta lines like "The consequence was clear", "Der Preis?", or "Der Gewinn?".
${strict ? "15) Do not include any instruction text or meta commentary in the output." : ""}

Return JSON:
{ "text": "Chapter text" }`;
}

export function resolveLengthTargets(input: {
  lengthHint?: string;
  ageRange: { min: number; max: number };
  pacing?: string;
}): { wordMin: number; wordMax: number; sentenceMin: number; sentenceMax: number } {
  const length = input.lengthHint || "medium";
  const base = {
    short: { min: 220, max: 300 },
    medium: { min: 300, max: 420 },
    long: { min: 400, max: 560 },
  } as Record<string, { min: number; max: number }>;
  const target = base[length] ?? base.medium;

  let factor = 1;
  if (input.ageRange.max <= 5) factor *= 0.75;
  else if (input.ageRange.max <= 8) factor *= 0.9;
  else if (input.ageRange.max >= 13) factor *= 1.1;

  if (input.pacing === "fast") factor *= 0.9;
  if (input.pacing === "slow") factor *= 1.1;

  const wordMin = Math.max(140, Math.round(target.min * factor));
  const wordMax = Math.max(wordMin + 60, Math.round(target.max * factor));
  const sentenceMin = Math.max(6, Math.round(wordMin / 18));
  const sentenceMax = Math.max(sentenceMin + 2, Math.round(wordMax / 14));

  return { wordMin, wordMax, sentenceMin, sentenceMax };
}

export function buildStoryChapterRevisionPrompt(input: {
  chapter: SceneDirective;
  cast: CastSet;
  dna: TaleDNA | StoryDNA;
  language: string;
  ageRange: { min: number; max: number };
  tone?: string;
  lengthHint?: string;
  pacing?: string;
  lengthTargets?: { wordMin: number; wordMax: number; sentenceMin: number; sentenceMax: number };
  stylePackText?: string;
  issues: string[];
  originalText: string;
  previousContext?: string;
  nextContext?: string;
}): string {
  const {
    chapter,
    cast,
    dna,
    language,
    ageRange,
    tone,
    lengthHint,
    pacing,
    lengthTargets: overrideTargets,
    stylePackText,
    issues,
    originalText,
    previousContext,
    nextContext,
  } = input;
  const isGerman = language === "de";
  const lengthTargets = overrideTargets ?? resolveLengthTargets({ lengthHint, ageRange, pacing });
  const artifactName = cast.artifact?.name?.trim();
  const characterNames = chapter.charactersOnStage
    .map(slot => findCharacterBySlot(cast, slot)?.displayName)
    .filter(Boolean) as string[];
  const allowedNames = Array.from(new Set(characterNames)).join(", ");

  const issueList = issues.length > 0 ? issues.map(issue => `- ${issue}`).join("\n") : "- Keine";
  const continuityContext = [
    previousContext ? `- Previous chapter ended with: "${previousContext}"` : "",
    nextContext ? `- Next chapter starts with: "${nextContext}"` : "",
  ].filter(Boolean).join("\n");

  return `Revise the chapter below to satisfy the rules without losing the plot. Write the output in ${isGerman ? "German" : language}.

ISSUES:
${issueList}

SCENE DIRECTIVE:
- Setting: ${chapter.setting}
- Mood: ${chapter.mood ?? "COZY"}
- Goal: ${chapter.goal}
- Conflict: ${chapter.conflict}
- Outcome: ${chapter.outcome}
- Characters (must appear): ${allowedNames || "none"}
- Artifact: ${chapter.artifactUsage}${artifactName ? ` (Name: ${artifactName} must be named)` : ""}
- Tone: ${tone ?? dna.toneBounds?.targetTone ?? "warm"}
${continuityContext ? `\nCONTINUITY CONTEXT:\n${continuityContext}` : ""}
${stylePackText ? `\n${stylePackText}\n` : ""}

RULES:
1) Use only these names: ${allowedNames || "none"}.
2) No new proper names.
2b) If output language is German: use proper umlauts (ä, ö, ü, ß), not ASCII substitutions like ae/oe/ue.
3) No meta-instructions.
3b) Do NOT output headings or labels like "Scene:", "Mood:", "Goal:", "Obstacle:", "Action:", "Mini-problem:", "Mini-resolution:", "Hook:", "Outlook:", "Epilogue:", "Ort:", "Stimmung:", "Ziel:", "Hindernis:", "Visible action:", "Action continued:", "Sichtbare Aktion:", "Aktion fortgesetzt:", "Der Ausblick:". Also never start sentences with "Her goal was", "An obstacle was", "Ihr Ziel war", "Ein Hindernis war".
4) Every character must act or speak.
5) Do not state belonging explicitly; avoid phrases like "always been part of this tale".
6) Avoid stock phrases like "makes an important decision", "has a special idea", "shows a new ability", "feels the tension", "decisive clue", "important hint", "question that unties the knot".
7) ${lengthTargets.wordMin}-${lengthTargets.wordMax} words, ${lengthTargets.sentenceMin}-${lengthTargets.sentenceMax} sentences.
8) No placeholder chapters. If the scene feels short, expand with a concrete action sequence + 2-3 short dialogue lines.
9) Children's-book style: vivid, rhythmic, varied sentence starts.
10) Keep dialogue lively and present (roughly 25-45% of sentences where fitting, no monologue blocks).
11) Never use meta labels inside prose (e.g. "Der Ausblick:", "Outlook:", "Hook:", "Scene:", "Kapitel 1").
12) No preview phrasing like "Soon they would...", "An outlook remained...", "Noch wussten sie nicht...".
13) Do not explain object rules as textbook statements ("X shows...", "X means..."). Show through concrete action + reaction + short dialogue.
14) Preserve continuity with adjacent chapters. Do not introduce a new room/prop cluster without an explicit transition sentence.
15) Remove summary-meta lines like "Die Konsequenz war klar", "Der Preis?", "The consequence was clear", "The price?".
16) Avoid repetitive speaker formulas ("said ... briefly/quietly", "his/her voice was ...").
17) Keep running gags sparse: same onomatopoeia/catchphrase at most 2 times in this chapter.

ORIGINAL TEXT:
${originalText}

Return JSON:
{ "text": "Chapter text" }`;
}

export function buildTemplatePhraseRewritePrompt(input: {
  chapter: SceneDirective;
  cast: CastSet;
  dna: TaleDNA | StoryDNA;
  language: string;
  ageRange: { min: number; max: number };
  tone?: string;
  lengthTargets: { wordMin: number; wordMax: number; sentenceMin: number; sentenceMax: number };
  stylePackText?: string;
  originalText: string;
  phraseLabels: string[];
  requiredCharacters?: string[];
}): string {
  const { chapter, cast, dna, language, ageRange, tone, lengthTargets, stylePackText, originalText, phraseLabels, requiredCharacters } = input;
  const isGerman = language === "de";
  const artifactName = cast.artifact?.name?.trim();
  const characterNames = chapter.charactersOnStage
    .map(slot => findCharacterBySlot(cast, slot)?.displayName)
    .filter(Boolean) as string[];
  const allowedNames = Array.from(new Set(characterNames)).join(", ");
  const missingLine = requiredCharacters?.length
    ? `MISSING CHARACTERS (MUST INSERT): ${requiredCharacters.join(", ")}.\nEach missing character must be named, perform a concrete action, and speak at least one short line of dialogue.`
    : "";

  return `Edit the chapter below to remove template phrases while keeping the plot. Write the output in ${isGerman ? "German" : language}.

TEMPLATE PHRASES TO REMOVE:
${phraseLabels.length ? phraseLabels.map(l => `- ${l}`).join("\n") : "- none"}

SCENE DIRECTIVE:
- Setting: ${chapter.setting}
- Mood: ${chapter.mood ?? "COZY"}
- Goal: ${chapter.goal}
- Conflict: ${chapter.conflict}
- Outcome: ${chapter.outcome}
- Characters (must appear): ${allowedNames || "none"}
- Artifact: ${chapter.artifactUsage}${artifactName ? ` (Name: ${artifactName} must be named)` : ""}
- Tone: ${tone ?? dna.toneBounds?.targetTone ?? "warm"}
- Audience: ${ageRange.min}-${ageRange.max} years
${stylePackText ? `\n${stylePackText}\n` : ""}

RULES:
1) Use only these names: ${allowedNames || "none"}.
2) No new proper names or new characters.
2b) If output language is German: use proper umlauts (ä, ö, ü, ß), not ASCII substitutions like ae/oe/ue.
3) Replace template phrases with concrete action + short dialogue lines.
3b) Do NOT output headings or labels like "Ort:", "Stimmung:", "Ziel:", "Hindernis:", "Handlung:", "Action:", "Mini-Problem:", "Mini-Aufloesung:", "Mini-Resolution:", "Hook:", "Ausblick:", "Der Ausblick:", "Epilog:", "Scene:", "Mood:", "Goal:", "Obstacle:", "Outlook:", "Sichtbare Aktion:", "Aktion fortgesetzt:", "Visible action:", "Action continued:". Also never start sentences with "Ihr Ziel war", "Ein Hindernis war", "Her goal was", "An obstacle was".
4) Keep the chapter length within ${lengthTargets.wordMin}-${lengthTargets.wordMax} words.
5) Do not change the plot beats, only the wording.
6) Remove summary-meta phrases ("Die Konsequenz war klar", "Der Preis?", "The consequence was clear", "The price?") and repetitive speaker formulas.
${missingLine ? `7) ${missingLine}\n` : ""}

ORIGINAL TEXT:
${originalText}

Return JSON:
{ "text": "Chapter text" }`;
}

export function buildStoryTitlePrompt(input: { storyText: string; language: string }): string {
  const isGerman = input.language === "de";
  return `${isGerman ? "Du bist ein preisgekrönter Kinderbuch-Verleger" : "You are an award-winning children's book publisher"}.

${isGerman
  ? `# Aufgabe
Erfinde einen MAGISCHEN Buchtitel (max 6 Wörter) und einen packenden Teaser-Satz für diese Kindergeschichte.

# Regeln für gute Kinderbuch-Titel
- NIEMALS das Schema "[Gegenstand] und [Person]" oder "[Person] und das [Artefakt]" verwenden!
- Gute Titel wecken NEUGIER und GEFÜHLE, nicht nur Fakten.
- Vorbilder: "Der Grüffelo", "Wo die wilden Kerle wohnen", "Jim Knopf und Lukas der Lokomotivführer", "Die unendliche Geschichte", "Pippi Langstrumpf"
- Nutze: Wortspiele, überraschende Kombinationen, Geheimnisvolles, Klangmalerei, Alliterationen
- Der Titel muss ein Kind zum Lachen oder Staunen bringen
- KEIN langweiliges "[Objekt]+[Eigenschaft]"-Schema

# Beispiele für GUTE vs SCHLECHTE Titel
❌ SCHLECHT: "Das Windeamulett", "Der magische Kompass", "Das Zauberbuch"
✅ GUT: "Sturmflüsterer", "Drei Wünsche und ein halber", "Der Tag, an dem der Wind sang", "Nachts, wenn die Glocken flüstern"

# Teaser
Der Teaser-Satz soll eine FRAGE im Kopf des Kindes wecken.
❌ SCHLECHT: "Drei Kinder finden ein Amulett und retten die Stadt."
✅ GUT: "Wer flüstert nachts hinter den Marktständen – und warum hat der Wind aufgehört zu singen?"`

  : `# Task
Create a MAGICAL book title (max 6 words) and a gripping teaser sentence for this children's story.

# Rules for great titles
- NEVER use "[Object] and [Person]" or "[Person] and the [Artifact]" patterns!
- Good titles spark CURIOSITY and EMOTION
- Use: wordplay, surprising combinations, mystery, sound, alliteration
- The title must make a child laugh or gasp

# Teaser
The teaser should plant a QUESTION in the child's mind.`}

Return JSON:
{ "title": "...", "description": "..." }

Story:
${input.storyText.slice(0, 3000)}`;
}

export function buildImageSpecPrompt(input: {
  chapter: SceneDirective;
  cast: CastSet;
}): string {
  const characterNames = input.chapter.charactersOnStage
    .map(slot => findCharacterBySlot(input.cast, slot)?.displayName)
    .filter(Boolean)
    .join(", ");

  return `You are a visual director. Create a structured ImageSpec for Chapter ${input.chapter.chapter}.
Characters on stage (exact): ${characterNames}
Setting: ${input.chapter.setting}
Mood: ${input.chapter.mood ?? "COZY"}
Artifact usage: ${input.chapter.artifactUsage}

Return JSON matching the ImageSpec schema with fields:
chapter, style, composition, blocking, actions, propsVisible, lighting, refs, negatives, onStageExact, finalPromptText.`;
}

export function buildVisionValidationPrompt(input: {
  checklist: string[];
}): string {
  return `You are a precise image QA system. Validate the image against this checklist and respond in JSON with fields: pass (boolean), issues (string[]), retryAdvice (string[]).
Checklist:
${input.checklist.map(item => `- ${item}`).join("\n")}`;
}

function findCharacterBySlot(cast: CastSet, slotKey: string) {
  return cast.avatars.find(a => a.slotKey === slotKey) || cast.poolCharacters.find(c => c.slotKey === slotKey);
}

function sanitizePromptBlock(block: string | undefined, maxLen = 2400): string {
  if (!block || !block.trim()) return "";
  const lines = block
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const key = line
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(line);
  }

  const joined = deduped.join("\n");
  return joined.slice(0, maxLen).trim();
}

function sanitizeStylePackBlock(block: string | undefined, isGerman: boolean): string {
  const base = sanitizePromptBlock(block, 1400);
  if (!base) return "";
  const banned = isGerman
    ? /(ausblick|vorschau|kapitelende|kapitel endet|epilog|hook)/i
    : /(outlook|preview|chapter ending|chapter ends|epilogue|hook)/i;
  const lines = base
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !banned.test(line));
  return lines.join("\n").trim();
}

function trimDirectiveText(value: string | undefined, maxChars: number): string {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  return normalized.slice(0, Math.max(0, maxChars - 3)).trimEnd() + "...";
}

function formatCustomPromptBlock(userPrompt: string | undefined, isGerman: boolean): string {
  if (!userPrompt || !userPrompt.trim()) return "";
  const normalized = sanitizePromptBlock(
    userPrompt
      .trim()
      .replace(/```/g, "'''"),
    3200,
  );
  if (!normalized) return "";
  if (isGerman) {
    return `# ZUSAETZLICHE NUTZER-VORGABEN (hoch priorisiert)\n${normalized}\n- Setze diese Vorgaben kreativ um, ohne die harten Regeln oben zu brechen.\n- WICHTIG: Beispielnamen in den Vorgaben (z. B. in Beispielsaetzen) sind keine neuen Figuren.\n- Bei Konflikten gelten immer zuerst Cast-Lock, Kapitel-/Wortvorgaben und Sicherheitsregeln.\n`;
  }
  return `# ADDITIONAL USER REQUIREMENTS (high priority)\n${normalized}\n- Apply these requirements creatively without breaking the hard rules above.\n- IMPORTANT: Proper names used only in examples are not new characters.\n- In conflicts, cast lock, chapter/length constraints, and safety rules always win.\n`;
}


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

function buildCompactCharacterProfile(sheet: CharacterSheet, isGerman: boolean): string {
  const role = sheet.roleType === "AVATAR"
    ? (isGerman ? "Kind" : "Child")
    : getSpeciesLabel(sheet.species || "", isGerman) || sheet.roleType || "";
  const dominant = sheet.enhancedPersonality?.dominant
    || sheet.personalityTags?.[0]
    || (isGerman ? "neugierig" : "curious");
  const speech = sheet.speechStyleHints?.[0]
    || (isGerman ? "klar und direkt" : "clear and direct");
  const rolePart = role ? ` (${role})` : "";
  return `- ${sheet.displayName}${rolePart}: ${dominant}; Stimme: ${speech}.`;
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
 * Returns profession-specific abilities based on Archetype
 */
function getArchetypeAbility(archetype: string, species: string, isGerman: boolean): string {
  // Species-based abilities take precedence
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

function buildChildVoiceContract(childNames: string[], isGerman: boolean): string {
  if (childNames.length === 0) return "";

  const templatesDE = [
    { label: "Frech und schnell", desc: "3-8 Woerter, unterbricht andere, stellt freche Fragen", example: '"Kann sie piepen?" / "Das ist streng-magisch."' },
    { label: "Ruhig und schlau", desc: "konkrete Details, klare Saetze, handelt statt zu reden", example: '"Wir muessen weiter." (packt den Arm, geht schnell)' },
    { label: "Neugierig und witzig", desc: "erfindet Woerter, stellt unerwartete Verbindungen her", example: '"Das riecht nach Abenteuer. Und nach Kaese."' },
  ];
  const templatesEN = [
    { label: "Cheeky and fast", desc: "3-8 words, interrupts others, asks bold questions", example: '"Can it beep?" / "That is strict-magic."' },
    { label: "Calm and clever", desc: "concrete details, clear sentences, acts instead of talking", example: '"We need to go." (grabs arm, walks fast)' },
    { label: "Curious and witty", desc: "invents words, makes unexpected connections", example: '"Smells like adventure. And cheese."' },
  ];

  const templates = isGerman ? templatesDE : templatesEN;
  const lines = childNames
    .slice(0, 3)
    .map((name, idx) => {
      const t = templates[idx] || templates[templates.length - 1];
      return `  - ${name}: ${t.label} � ${t.desc}. Beispiel: ${t.example}`;
    })
    .join("\n");

  const globalRule = isGerman
    ? "  - WICHTIG: Kinder muessen KOMPLETT unterschiedlich klingen. Ein Kind erkennt am Satz WER spricht."
    : "  - IMPORTANT: Children must sound COMPLETELY different. A child recognizes WHO speaks by the sentence alone.";

  return `${lines}\n${globalRule}`;
}

// ─── Golden Example & Anti-Patterns ──────────────────────────────────────────

function buildGoldenExampleBlock(isGerman: boolean): string {
  const germanExamples = `"""
SZENE A (Unterbrechung + Rhythmus):
Mama knallte den Korb auf den Tisch. Plopp.
"Darf ich--?" "Nein", sagte Mama. So schnell, als waere der Deckel ein Krokodilmaul.
Alexander beugte sich vor. "Ich riech Apfelkuchen." "Und Tee", sagte Adrian.
Er schnupperte extra laut. "Und� Oma."

SZENE B (Humor durch Situation):
"Kann sie auch piepen?" "Nein." "Kann sie Stopp sagen?" "Nein."
"Kann sie wenigstens einmal--" Mama schob die Muenze in Alexanders Tasche.
Adrian seufzte. "Das ist streng-magisch."

SZENE C (Figur-Eintritt mit Detail):
Am Rand der Lichtung stand ein Wolf. Gross. Grau. Mit einer knallroten Nase.
Und einem Taschentuch. Einem echten Taschentuch.

SZENE D (Konfrontation + Action):
Oma kam raus wie ein Gewitter mit Schal. Kochloeffel in der Hand. Nase rot.
Augen gefaehrlich. "RAUS", sagte sie.
"""`;

  const englishExamples = `"""
SCENE A (Interruption + Rhythm):
Mom slammed the basket on the table. Pop.
"Can I--?" "No," said Mom. Quick as a crocodile jaw.
Alexander leaned in. "I smell apple cake." "And tea," said Adrian.
He sniffed extra loud. "And... Grandma."

SCENE B (Humor through situation):
"Can it beep?" "No." "Can it say Stop?" "No."
"Can it at least once--" Mom pushed the coin into Alexander's pocket.
Adrian sighed. "That's strict-magic."

SCENE C (Character entrance with detail):
At the edge of the clearing stood a wolf. Big. Gray. With a bright red nose.
And a tissue. A real tissue.

SCENE D (Confrontation + Action):
Grandma came out like a thunderstorm in a scarf. Wooden spoon in hand.
Nose red. Eyes dangerous. "OUT," she said.
"""`;

  return `# PROSE QUALITY REFERENCE (this is the TARGET quality)
${isGerman ? germanExamples : englishExamples}

KEY QUALITIES:
- Dialogue carries scenes: interruptions, quick exchanges, unfinished sentences
- Humor through SITUATION and surprise, never explained
- Rhythm: short-short-LONG, fragments ("Gross. Grau."), then longer sentence
- Each character sounds COMPLETELY different (word choice, length, attitude)
- Concrete details you can SEE (red nose, wooden spoon, tissue)
- NO atmosphere-only sentences, NO teaching sentences, NO meta-narration`;
}

function buildAntiPatternBlock(isGerman: boolean): string {
  const badExamples = isGerman
    ? `PERSONIFIZIERUNG (VERBOTEN):
- "Der Wald fluesterte" / "Wasser kicherte im Brunnen" / "Windspiele klangen nervoes"
ATMOSPHAERE-FUELLUNG (VERBOTEN):
- "Es roch nach feuchtem Holz und nassem Laub" / "Der Wind trug den Duft von..."
- Jeder Satz MUSS Handlung oder Dialog enthalten. Keine reinen Stimmungssaetze.
META-NARRATION (VERBOTEN):
- "Die Geschichte schliesst mit einem warmen Gefuehl" / "Die Szene endete"
LEHRSAETZE IM DIALOG (VERBOTEN):
- "Wir haben gelernt, zusammen zu handeln" / "Das Amulett gibt Halt, nicht Macht"
REPORT-STIL (VERBOTEN):
- "Sie gingen. Sie machten. Sie legten. Sie nickten." (= Roboter-Prosa)
WORT-WIEDERHOLUNGEN & FUELLWOERTER (STRENG VERBOTEN):
- "ploetzlich", "auf einmal", "dann", "nun", "jetzt", "schliesslich" � komplett vermeiden!
VERGLEICHS-OVERLOAD & METAPHERN (VERBOTEN):
- Max 1 winziger, konkreter Vergleich pro Kapitel. Keine Metaphern-Ketten oder abstrakten Bilder.`
    : `PERSONIFICATION (FORBIDDEN):
- "The forest whispered" / "Water giggled in the well" / "Wind chimes sounded nervous"
ATMOSPHERE FILLER (FORBIDDEN):
- "It smelled of damp wood" / "The wind carried the scent of..."
- Every sentence MUST contain action or dialogue. No pure mood sentences.
META-NARRATION (FORBIDDEN):
- "The story closes with a warm feeling" / "The scene ended"
TEACHING SENTENCES IN DIALOGUE (FORBIDDEN):
- "We learned to work together" / "The amulet gives support, not power"
REPORT STYLE (FORBIDDEN):
- "They went. They did. They placed. They nodded." (= robot prose)
FILLER WORDS & REPETITION (STRICTLY FORBIDDEN):
- "suddenly", "all at once", "then", "now", "finally" � avoid completely!
METAPHOR OVERLOAD (FORBIDDEN):
- Max 1 short comparison per chapter. No chains of metaphors or abstract imagery.`;

  return `# FORBIDDEN PATTERNS
${badExamples}`;
}

// --- Optimized Full Story Prompt (V5 for Gemini Flash) -----------------------------------------
// Specialized for high-context models. Enforces a "Strategy/Planning" step inside the JSON
// to ensure pacing, length, and emotional arcs are calculated BEFORE prose generation.

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
  promptMode?: "full" | "compact";
}): string {
  const { directives, cast, dna, language, ageRange, tone, humorLevel, totalWordMin, totalWordMax, wordsPerChapter, stylePackText, fusionSections, avatarMemories, userPrompt } = input;
  const promptMode = input.promptMode ?? "full";
  const isCompactPrompt = promptMode === "compact";
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
    characterProfiles.push(
      isCompactPrompt
        ? buildCompactCharacterProfile(sheet as CharacterSheet, isGerman)
        : buildCharacterProfile(sheet as CharacterSheet, isGerman),
    );
  }

  const focusChildNames = cast.avatars.map(a => a.displayName).filter(Boolean);
  const childVoiceContract = buildChildVoiceContract(focusChildNames, isGerman);
  const focusMaxActive = ageRange.max <= 8 ? 3 : 4;
  const focusIdealRange = ageRange.max <= 8 ? "2-3" : "3-4";

  const avatarRule = focusChildNames.length >= 2
    ? `- Avatar requirement: ${focusChildNames.join(" and ")} are equal protagonists and must be active in EVERY beat (each beat: at least one action + one dialogue line per child).`
    : focusChildNames.length === 1
      ? `- Protagonist requirement: ${focusChildNames[0]} must be active in EVERY beat (action or dialogue).`
      : "";

  const stylePackBlock = trimPromptLines(sanitizeStylePackBlock(stylePackText, isGerman), isCompactPrompt ? 5 : 10);
  const customPromptBlock = trimPromptLines(formatCustomPromptBlock(userPrompt, isGerman), isCompactPrompt ? 6 : 12);

  let memorySection = "";
  if (avatarMemories && avatarMemories.size > 0) {
    const memoryTitles: string[] = [];
    for (const avatar of cast.avatars) {
      const memories = avatarMemories.get(avatar.characterId);
      if (!memories || memories.length === 0) continue;
      const topTitle = String(memories[0]?.storyTitle || "").trim();
      if (!topTitle) continue;
      memoryTitles.push(`${avatar.displayName}: ${trimDirectiveText(topTitle, isCompactPrompt ? 24 : 36)}`);
      if (memoryTitles.length >= 2) break;
    }
    if (memoryTitles.length > 0) {
      const memoryInstruction = isCompactPrompt
        ? `- One avatar references one earlier adventure exactly once (one short sentence).`
        : `- One avatar should reference an earlier adventure EXACTLY ONCE (e.g. "That reminds me of..."). Do not retell, just one sentence.`;
      memorySection = `\n::: EARLIER ADVENTURES :::\n${memoryTitles.join("\n")}\n${memoryInstruction}\n`;
    }
  }

  const beatLines = directives.map((directive, idx) => {
    const castNames = directive.charactersOnStage
      .filter(slot => !slot.includes("ARTIFACT"))
      .map(slot => findCharacterBySlot(cast, slot)?.displayName)
      .filter((name): name is string => Boolean(name));
    const uniqueCast = Array.from(new Set(castNames));
    const fusionHint = isCompactPrompt
      ? ""
      : fusionSections?.get(directive.chapter)?.split("\n").slice(0, 1).join(" ").trim();
    const artifactTag = artifactName && directive.artifactUsage && !directive.artifactUsage.toLowerCase().includes("nicht")
      ? ` [${artifactName}]`
      : "";
    // Increased context limits for beats to ensure model gets full detail
    const settingMax = 60;
    const goalMax = 120;
    const conflictMax = 120;
    const outcomeMax = 80;

    return `CHAPTER ${idx + 1}:\n   Setting: ${trimDirectiveText(sanitizeDirectiveNarrativeText(directive.setting), settingMax)}${artifactTag}\n   Goal: ${trimDirectiveText(sanitizeDirectiveNarrativeText(directive.goal), goalMax)}\n   Conflict: ${trimDirectiveText(sanitizeDirectiveNarrativeText(directive.conflict), conflictMax)}\n   Characters: ${uniqueCast.join(", ") || "none"}\n   End Trigger: ${trimDirectiveText(sanitizeDirectiveNarrativeText(directive.outcome), outcomeMax)}${fusionHint ? `\n   Hint: ${trimDirectiveText(sanitizeDirectiveNarrativeText(fusionHint), 60)}` : ""}`;
  }).join("\n\n");

  const safetyRule = "No explicit violence, no weapons, no blood, no horror, no bullying, no politics/religion, no drugs/alcohol/gambling.";

  const titleHint = "Max 6 words, curiosity-driven, avoid 'object and person' pattern (e.g. avoid 'Tom and the Stone').";

  const humorTarget = Math.max(0, Math.min(3, Number.isFinite(humorLevel as number) ? Number(humorLevel) : 2));
  const humorRule = humorTarget >= 3
    ? "Humor: HIGH. Needs 3+ laugh moments (slapstick, misunderstanding, witty comeback)."
    : humorTarget >= 2
      ? "Humor: MEDIUM. Needs 2+ laugh moments suitable for children."
      : humorTarget >= 1
        ? "Humor: LIGHT. One smile moment."
        : "Humor: Optional.";

  const outputLang = isGerman ? "German" : targetLanguage;
  const umlautRule = isGerman ? " Use proper German umlauts (�, �, �, �), never ASCII substitutes. No English words." : "";

  const goldenExample = buildGoldenExampleBlock(isGerman);
  const antiPatterns = buildAntiPatternBlock(isGerman);

  // Gemini 3 Flash "Maximum Quality" Strategy
  // We use a "Role + Method" prompting style where we define the author's precise methodology.
  // We integrate the "Scene-Sequel" pacing and "Somatic Marker" emotion rules directly.
  return `::: SYSTEM INSTRUCTION :::
You are the world's greatest children's book author (a fusion of Astrid Lindgren's warmth, Roald Dahl's wit, and Cornelia Funke's imagery).
You are writing a "10.0/10.0" quality bestseller.

::: THE "10.0/10.0" QUALITY BENCHMARK :::
A score of 0.0 means: AI-generated filler, passive characters, "tell instead of show", repetitive sentence structures, and abstract emotions ("he was sad").
A score of 10.0 means: A published, award-winning children's book. It has a unique voice, perfect pacing, characters that drive the plot through action, vivid sensory details (smell, sound, touch), and dialogue that crackles with personality.
YOUR SOLE OBJECTIVE IS TO WRITE AT A 10.0 LEVEL.

::: THE "10/10" WRITING METHODOLOGY :::

1.  **THE "SHOW-DON'T-TELL" LAW (CRITICAL)**
    *   **FORBIDDEN:** Abstract emotion labels ("Tom was sad", "Lisa felt brave", "He was nervous").
    *   **REQUIRED:** Somatic Markers (body sensations) and visible actions. Show emotions ONLY through body language or objects.
    *   *Bad:* "The forest was scary."
    *   *Good:* "The trees intertwined like knobby fingers. The silence pressed against Tom's ears until they popped."
    *   *Bad:* "Lisa was happy."
    *   *Good:* "Lisa's toes wiggled in her boots. A bubble of giggles rose in her throat."
    *   *Bad:* "Mia was angry."
    *   *Good:* "Mia's knee trembled. She bit her lip. The band-aid stuck crookedly."
    *   **Imagery Limit:** Maximum ONE comparison ("like a...", "as if...") per paragraph. Do not over-decorate.

2.  **THE RHYTHM & PACING RULE (THE "EAR TEST")**
    *   You write PROSE, not a script. The text must sing.
    *   **The "Rule of Three":** Use triads for descriptions (e.g., "The box was old, rusty, and smelled like forgotten attic dust").
    *   **Sentence Variance:** NEVER allow three sentences of the same length in a row. Keep sentences short and punchy for 6-8 year olds. NO long, winding sentences (Schachtelsätze).
    *   **Short Beats:** Use 2-5 word sentences to spike tension. (e.g., "Then it stopped.", "Silence fell.")
    *   **No "And then" Chains:** Avoid starting sentences with "And" or "Then". Use strong verbs.
    *   **Max 1 "Plan" Sentence:** Per scene, allow ONLY ONE sentence like "We must..." or "The plan is...". The rest MUST be action, sensory details, and dialogue.
    *   **BANNED WORD:** NEVER use the word "plötzlich" (suddenly). Find a better way to show sudden action.

3.  **DIALOGUE ANCHORING & DISTINCT VOICES (NO "PING-PONG")**
    *   **Dialogue Ratio:** At least 25% of the total text MUST be dialogue. Characters must talk to each other frequently.
    *   **Active Presence:** Every character present in a chapter MUST actively do something or speak. No passive observers.
    *   **Rule:** Every dialogue block MUST include a "Stage Business" action.
    *   **Distinct Voices (Audio-Test):** Characters MUST sound different. Give each character 2 typical words they use exclusively.
        *   *Example:* Adrian: short, brave ("Ich mach das!", "zack", "easy"). Alexander: short, smart but childish ("Warte—erst gucken!", "Moment", "logisch"). Mia: emotional, direct ("Aua! Hör auf!", "echt jetzt", "mega").
    *   *Bad:*
        "Do you see it?" ask Tom.
        "Yes," said Lisa.
        "It's big," said Tom.
    *   *Good:*
        Tom squinted at the horizon, shading his eyes. "Do you see it?"
        Lisa mocked a salute. "Yes. It's bigger than a house."
    *   **No "Talking Heads":** Characters never just talk. They act, move, and interact with the world while speaking.

4.  **SCENE STRUCTURE (THE "MICRO-ARC")**
    *   Goal -> Conflict -> Disaster -> Reaction -> New Goal.
    *   **Early Stakes:** In Chapter 1 or 2, explicitly show what happens if the characters fail (the stakes).
    *   **The Lowpoint:** In Chapter 4, show a strong, physical emotional reaction to a major setback.
    *   **The Payoff:** The ending (Chapter 5) must be concrete. Show exactly what was won/secured. Include a small, tangible price or compromise (e.g., a torn shirt, a lost button, being late for dinner).
    *   **Artifact Arc:** Introduce the magical artifact early (Chapter 1 or 2) and use it actively in at least TWO different scenes.
    *   **Setpiece-Upgrade:** Include 1 mini-puzzle (max 3 sentences) that kids can guess. End the story with a callback (e.g., a recurring sound or object) as a final laugh.
    *   **Magic Mechanics:** Explain how magic or artifacts work simply and clearly (e.g., "The eye glowed blue, cooling the overheated hive").
    *   **Active NPCs:** Companions (like a goblin or fairy) MUST actively help solve problems, not just stand around.

5.  **CHILD-CENTRIC WORLDVIEW (DEEP POV)**
    *   The narrator camera is INSIDE the child's eyes.
    *   Adults are giants. Tables are roofs.
    *   Small problems (a lost toy) feel like world-ending disasters. large problems are confusing.
    *   Magic is treated as matter-of-fact science.
    *   **Vocabulary Filter (Ages 6-8):** AVOID office/tech words ("Konditionen", "präzise", "justieren", "schriftlich", "Ordnungs...", "thermisch", "Protokoll"). REPLACE with child-friendly words ("Abmachung", "genau", "zurechtrücken", "aufgeschrieben", "Regel", "warm/kalt", "Notiz").

6.  **FAILURE MODES (AVOID AT ALL COSTS)**
    *   **The "Summary Trap":** Do not summarize events ("They had a great adventure"). PLAY THE ADVENTURE OUT.
    *   **The "Lesson Hammer":** Do not preach. The moral must be invisible.
    *   **The "Adjective Soup":** Do not stack adjectives ("The big, red, shiny, beautiful ball"). Pick ONE perfect word ("The ruby-red ball").
    *   **The "Prompt Leak":** NEVER copy the Goal, Conflict, or Setting text directly into the story. NEVER use meta-phrases like "The scene leads to the next beat" or "A new beat started". Dramatize the instructions into natural prose.

::: CRITICAL CONSTRAINTS :::
1. LANGUAGE: ${outputLang} ONLY. ${umlautRule}
2. FORMAT: Single valid JSON object.
3. LENGTH: Total ${totalWordMin}-${totalWordMax} words. Each chapter MUST be ${wordsPerChapter.min}-${wordsPerChapter.max} words.
   -> FAILURE MODE: Stories under ${totalWordMin} words will be REJECTED. Expand interactions!
4. CAST: Only ${allowedNames.join(", ")}. No new names.
5. SAFETY: ${safetyRule}
6. HUMOR: ${humorRule}

${avatarRule ? `::: AVATAR RULES :::\n${avatarRule}\n` : ""}
${stylePackBlock ? `::: STYLE PACK :::\n${stylePackBlock}\n` : ""}
${customPromptBlock ? `::: USER REQUEST :::\n${customPromptBlock}\n` : ""}

::: CHARACTER VOICES :::
${characterProfiles.join("\n")}
${childVoiceContract ? `\n${childVoiceContract}` : ""}
${memorySection}
${artifactName ? `::: ARTIFACT :::\n- Name: ${artifactName}\n- Rule: ${artifactRule}\n- Arc: Discovery -> Misinterpretation -> Mastery (Child solves it, not the artifact).\n` : ""}

::: PROMPTED STORY BEATS :::
(DRAMATIZE THESE BEATS. DO NOT COPY THE TEXT LITERALLY. NO META-LANGUAGE.)
${beatLines}

${goldenExample}

${antiPatterns}

::: OUTPUT FORMAT :::
You must output a single JSON object with a "_planning" field. Use this field to "think" before writing.

{
  "_planning": {
    "theme_focus": "One word theme (e.g. 'Courage')",
    "somatic_vocabulary": ["List 5 physical sensations you will use instead of emotion words"],
    "pacing_check": "How will you ensure sentence length variety?",
    "anti_leak_check": "Confirm you will NOT use meta-phrases like 'next beat' or copy the prompt text.",
    "voice_separation_check": "How will you ensure each character sounds distinct? (e.g. short sentences vs formal words)",
    "chapter_plans": [
      { "chapter": 1, "goal": "Specific goal", "conflict": "Specific obstacle", "ending": "Cliffhanger/Shift" }
    ]
  },
  "title": "${titleHint}",
  "description": "Teaser sentence...",
  "chapters": [
    { "chapter": 1, "text": "Full prose text..." }
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
    ? "- Humor: HIGH. Add 3+ clear laugh moments (slapstick, wit, misunderstanding)."
    : humorTarget >= 2
      ? "- Humor: MEDIUM. Add 2+ clear laugh moments."
      : humorTarget >= 1
        ? "- Humor: LIGHT. At least 1 smile moment."
        : "- Humor: Optional.";

  const originalText = originalDraft.chapters
    .map(ch => `--- Beat ${ch.chapter} ---\n${ch.text}`)
    .join("\n\n");

  const outputLang = isGerman ? "German" : targetLanguage;
  const umlautRule = isGerman ? " Use proper German umlauts (�, �, �, �), never ASCII. No English words." : "";

  return `TASK: Rewrite this story to "10.0/10.0" quality standards. The previous draft was rejected for being too flat/generic.

::: CRITIC FEEDBACK (MUST FIX) :::
${qualityIssues || "- General prose improvement needed. Too short, flat characters."}

::: THE "10.0/10.0" QUALITY BENCHMARK :::
A score of 0.0 means: AI-generated filler, passive characters, "tell instead of show", repetitive sentence structures, and abstract emotions ("he was sad").
A score of 10.0 means: A published, award-winning children's book. It has a unique voice, perfect pacing, characters that drive the plot through action, vivid sensory details (smell, sound, touch), and dialogue that crackles with personality.
YOUR SOLE OBJECTIVE IS TO WRITE AT A 10.0 LEVEL.

::: THE "10/10" WRITING STANDARD :::
1.  **SHOW, DON'T TELL (SOMATIC MARKERS)**
    *   **FORBIDDEN:** Abstract emotion words ("sad", "happy", "excited").
    *   **REQUIRED:** Physical sensations. "Shoulders ignored gravity" (happy). "Stomach turned to ice" (scared).
    *   *Fix:* Take every emotion word in the draft and replace it with a physical action.
    *   **Imagery Limit:** Maximum ONE comparison ("like a...", "as if...") per paragraph.

2.  **RHYTHM & PACING (EAR TEST)**
    *   **Rule of Three:** Use triads for descriptions.
    *   **Sentence Variance:** Combine short (2-5 words) and medium (8-15 words) sentences. Keep sentences short for 6-8 year olds.
    *   **NO:** Three sentences of the same length in a row.
    *   **NO:** Chains of "He did this. Then he did that." Use strong verbs.
    *   **BANNED WORD:** NEVER use the word "plötzlich" (suddenly).

3.  **DIALOGUE ANCHORING & ACTIVE PRESENCE**
    *   **Dialogue Ratio:** At least 25% of the total text MUST be dialogue.
    *   **Active Presence:** Every character present in a chapter MUST actively do something or speak.
    *   Every dialogue line needs a physical anchor.
    *   *Bad:* "Hello," said Tom.
    *   *Good:* Tom kicked the dirt. "Hello."

4.  **SCENE STRUCTURE & STAKES**
    *   **Early Stakes:** In Chapter 1 or 2, explicitly show what happens if the characters fail.
    *   **The Lowpoint:** In Chapter 4, show a strong, physical emotional reaction to a major setback.
    *   **The Payoff:** The ending (Chapter 5) must be concrete. Show exactly what was won/secured. Include a small, tangible price or compromise.
    *   **Artifact Arc:** Ensure the magical artifact is introduced early and used actively in at least TWO different scenes.

5.  **PROMPT LEAK PREVENTION**
    *   NEVER copy the Goal, Conflict, or Setting text directly into the story.
    *   NEVER use meta-phrases like "The scene leads to the next beat" or "A new beat started".

::: HARD RULES :::
1) Language: ONLY ${outputLang}.${umlautRule}
2) Length: ${totalWordMin}-${totalWordMax} words total. Chapter target ${wordsPerChapter.min}-${wordsPerChapter.max}.
   -> IF TOO SHORT: You MUST add new interactions, dialogue lines, and sensory details. Do NOT just fluff the text. Dramatize!
  3) Cast Lock: ${allowedNames || "(none)"}. No new names. NEVER invent new characters, names, or entities.
${humorRewriteLine}

${stylePackBlock ? `::: STYLE PACK :::\n${stylePackBlock}\n` : ""}
${customPromptBlock ? `::: USER REQUEST :::\n${customPromptBlock}\n` : ""}

::: ORIGINAL DRAFT (FOR REFERENCE ONLY - REWRITE COMPLETELY) :::
${originalText}

::: OUTPUT FORMAT :::
Output a single JSON object. Start with a "_planning" field where you explicitly state how you will fix the issues.

{
  "_planning": {
    "fix_strategy": "Example: I will extend Chapter 2 by adding a scene where...",
    "somatic_check": "List 3 emotion words I am deleting and replacing with actions...",
    "pacing_check": "How I ensure the low-point in Ch 3 hits hard...",
    "anti_leak_check": "Confirm you will NOT use meta-phrases like 'next beat' or copy the prompt text.",
    "voice_separation_check": "How will you ensure each character sounds distinct? (e.g. short sentences vs formal words)"
  },
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
    ? `\n**MISSING CHARACTERS (MUST BE INCLUDED WITH FOCUS):** ${requiredCharacters.join(", ")}\nName each missing character doing a short concrete action. Total limit remains max ${focusMaxActive} active characters.`
    : "";

  const contextLines = [
    previousContext ? `Previous chapter ended: "${previousContext}"` : "",
    nextContext ? `Next chapter begins: "${nextContext}"` : ""
  ].filter(Boolean).join("\n");

  return `# TASK
Expand the chapter without changing the plot. Show, don't tell!
IMPORTANT: Vivid prose! Concrete details (smell, taste, feel), dialogue-humor, sentence variation.
No feeling-diagnosis sentences like "he was very nervous/sad"; instead show behavior + speech.

::: THE "10.0/10.0" QUALITY BENCHMARK :::
A score of 0.0 means: AI-generated filler, passive characters, "tell instead of show", repetitive sentence structures, and abstract emotions ("he was sad").
A score of 10.0 means: A published, award-winning children's book. It has a unique voice, perfect pacing, characters that drive the plot through action, vivid sensory details (smell, sound, touch), and dialogue that crackles with personality.
YOUR SOLE OBJECTIVE IS TO WRITE AT A 10.0 LEVEL.

# SCENE
- Setting: ${sanitizeDirectiveNarrativeText(chapter.setting)}, Mood: ${chapter.mood ?? "COZY"}
- Goal: ${sanitizeDirectiveNarrativeText(chapter.goal)}
- Characters: ${allowedNames}
${artifactName && chapter.artifactUsage ? `- Artifact: ${artifactName} (${sanitizeDirectiveNarrativeText(chapter.artifactUsage)})` : ""}
- Tone: ${tone ?? dna.toneBounds?.targetTone ?? "warm"}, Age: ${ageRange.min}-${ageRange.max}
${missingLine}

# LENGTH TARGET
**${lengthTargets.wordMin}-${lengthTargets.wordMax} words, ${lengthTargets.sentenceMin}-${lengthTargets.sentenceMax} sentences**

# RULES
1. ONLY these names: ${allowedNames}. NEVER invent new characters, names, or entities.
2. No new characters.
3. Max ${focusMaxActive} active characters per chapter, ideal ${focusIdealRange}.
4. No meta-labels in the text. NEVER copy the Goal, Conflict, or Setting text directly into the story.
5. Chapter rhythm: short/fast -> calm/emotional -> short/fast.
6. At least 1 inner child-moment of ${emotionalFocus} (body signal + thought).
7. Expand via concrete action + 2-3 dialogue lines.
8. Max 1 comparison per paragraph, no metaphor chains.
9. No preview, meta or summary sentences.
10. No explanatory sentences about object rules.
11. Dialogues must sound distinguishable; no speaker-tag formula loops.
12. Running gag sparsely: same sound-word/catchphrase max 2x.
13. If output is German: use true umlauts (�, �, �, �), no ae/oe/ue. NO English words in output.

${contextLines ? `# CONTEXT\n${contextLines}\n` : ""}
# ORIGINAL
${originalText}

# OUTPUT
JSON: 
{
  "_planning": {
    "anti_leak_check": "List any words from the Goal/Conflict that you are tempted to use, and write your concrete alternative here instead.",
    "voice_separation_check": "How will you ensure each character sounds distinct? (e.g. short sentences vs formal words)"
  },
  "text": "Chapter text" 
}`;
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

::: THE "10.0/10.0" QUALITY BENCHMARK :::
A score of 0.0 means: AI-generated filler, passive characters, "tell instead of show", repetitive sentence structures, and abstract emotions ("he was sad").
A score of 10.0 means: A published, award-winning children's book. It has a unique voice, perfect pacing, characters that drive the plot through action, vivid sensory details (smell, sound, touch), and dialogue that crackles with personality.
YOUR SOLE OBJECTIVE IS TO WRITE AT A 10.0 LEVEL.

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
7) Children's-book prose style: concrete and vivid, varied sentence starts, occasional dialogue without screenplay ping-pong.
8) Do not state belonging explicitly; show it through actions. Avoid phrases like "always been part of this tale".
9) Avoid stock phrases like "makes an important decision", "has a special idea", "shows a new ability", "feels the tension", "decisive clue", "important hint", "question that unties the knot".
10) Avatars and supporting characters must be actively involved, not just present.
11) End naturally with momentum or a warm closure (except final chapter); never use label phrases like "Der Ausblick:" or "Outlook:".
12) Avoid repetitive speaker formulas ("said ... briefly/quietly", "his/her voice was ...").
13) Keep running gags sparse: same onomatopoeia/catchphrase at most 2 times in this chapter.
14) No summary-meta lines like "The consequence was clear", "Der Preis?", or "Der Gewinn?". NEVER copy the Goal, Conflict, or Setting text directly into the story.
15) No diagnostic emotion labels ("he was very sad/nervous/scared"); show through actions and dialogue.
${strict ? "16) Do not include any instruction text or meta commentary in the output." : ""}

PROMPT LEAK PREVENTION:
You are strictly forbidden from copying the exact phrasing of the Goal, Conflict, or Setting into the story text.
You must translate these abstract concepts into concrete, in-world actions and dialogue.

Return JSON:
{
  "_planning": {
    "anti_leak_check": "List any words from the Goal/Conflict that you are tempted to use, and write your concrete alternative here instead."
  },
  "text": "Chapter text"
}`;
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

::: THE "10.0/10.0" QUALITY BENCHMARK :::
A score of 0.0 means: AI-generated filler, passive characters, "tell instead of show", repetitive sentence structures, and abstract emotions ("he was sad").
A score of 10.0 means: A published, award-winning children's book. It has a unique voice, perfect pacing, characters that drive the plot through action, vivid sensory details (smell, sound, touch), and dialogue that crackles with personality.
YOUR SOLE OBJECTIVE IS TO WRITE AT A 10.0 LEVEL.

ISSUES:
${issueList}

SCENE DIRECTIVE:
- Setting: ${sanitizeDirectiveNarrativeText(chapter.setting)}
- Mood: ${chapter.mood ?? "COZY"}
- Goal: ${sanitizeDirectiveNarrativeText(chapter.goal)}
- Conflict: ${sanitizeDirectiveNarrativeText(chapter.conflict)}
- Outcome: ${sanitizeDirectiveNarrativeText(chapter.outcome)}
- Characters (must appear): ${allowedNames || "none"}
- Artifact: ${sanitizeDirectiveNarrativeText(chapter.artifactUsage)}${artifactName ? ` (Name: ${artifactName} must be named)` : ""}
- Tone: ${tone ?? dna.toneBounds?.targetTone ?? "warm"}
${continuityContext ? `\nCONTINUITY CONTEXT:\n${continuityContext}` : ""}
${stylePackText ? `\n${stylePackText}\n` : ""}

RULES:
1) Use only these names: ${allowedNames || "none"}. NEVER invent new characters, names, or entities.
2) No new proper names.
2b) If output language is German: use proper German spelling; do not use ASCII substitutions like ae/oe/ue.
3) No meta instructions, labels, previews, or summary lines in prose. NEVER copy the Goal, Conflict, or Setting text directly into the story.
4) Every character must act or speak.
5) Remove stock phrases and repetitive speaker formulas.
6) ${lengthTargets.wordMin}-${lengthTargets.wordMax} words, ${lengthTargets.sentenceMin}-${lengthTargets.sentenceMax} sentences.
7) Keep dialogue lively (target roughly 25-45% where fitting, no monologue blocks).
8) Keep continuity with adjacent chapters using explicit transitions where needed.
9) Do not explain object rules as textbook statements; show via action + reaction + short dialogue.
10) Keep running gags sparse: same onomatopoeia/catchphrase at most 2 times in this chapter.
11) Use normal prose paragraphs (mostly 2-4 sentences); no one-sentence report chains.
12) No meta/report lines like "Die Szene endete" / "The scene ended".

PROMPT LEAK PREVENTION:
You are strictly forbidden from copying the exact phrasing of the Goal, Conflict, or Setting into the story text.
You must translate these abstract concepts into concrete, in-world actions and dialogue.

ORIGINAL TEXT:
${originalText}

Return JSON:
{
  "_planning": {
    "anti_leak_check": "List any words from the Goal/Conflict that you are tempted to use, and write your concrete alternative here instead.",
    "voice_separation_check": "How will you ensure each character sounds distinct? (e.g. short sentences vs formal words)"
  },
  "text": "Chapter text"
}`;
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

::: THE "10.0/10.0" QUALITY BENCHMARK :::
A score of 0.0 means: AI-generated filler, passive characters, "tell instead of show", repetitive sentence structures, and abstract emotions ("he was sad").
A score of 10.0 means: A published, award-winning children's book. It has a unique voice, perfect pacing, characters that drive the plot through action, vivid sensory details (smell, sound, touch), and dialogue that crackles with personality.
YOUR SOLE OBJECTIVE IS TO WRITE AT A 10.0 LEVEL.

TEMPLATE PHRASES TO REMOVE:
${phraseLabels.length ? phraseLabels.map(l => `- ${l}`).join("\n") : "- none"}

SCENE DIRECTIVE:
- Setting: ${sanitizeDirectiveNarrativeText(chapter.setting)}
- Mood: ${chapter.mood ?? "COZY"}
- Goal: ${sanitizeDirectiveNarrativeText(chapter.goal)}
- Conflict: ${sanitizeDirectiveNarrativeText(chapter.conflict)}
- Outcome: ${sanitizeDirectiveNarrativeText(chapter.outcome)}
- Characters (must appear): ${allowedNames || "none"}
- Artifact: ${sanitizeDirectiveNarrativeText(chapter.artifactUsage)}${artifactName ? ` (Name: ${artifactName} must be named)` : ""}
- Tone: ${tone ?? dna.toneBounds?.targetTone ?? "warm"}
- Audience: ${ageRange.min}-${ageRange.max} years
${stylePackText ? `\n${stylePackText}\n` : ""}

RULES:
1) Use only these names: ${allowedNames || "none"}. NEVER invent new characters, names, or entities.
2) No new proper names or new characters.
2b) If output language is German: use proper German spelling; do not use ASCII substitutions like ae/oe/ue.
3) Replace template phrases with concrete action + short dialogue lines.
3b) Do NOT output headings or labels like "Ort:", "Stimmung:", "Ziel:", "Hindernis:", "Handlung:", "Action:", "Mini-Problem:", "Mini-Aufloesung:", "Mini-Resolution:", "Hook:", "Ausblick:", "Der Ausblick:", "Epilog:", "Scene:", "Mood:", "Goal:", "Obstacle:", "Outlook:", "Sichtbare Aktion:", "Aktion fortgesetzt:", "Visible action:", "Action continued:". Also never start sentences with "Ihr Ziel war", "Ein Hindernis war", "Her goal was", "An obstacle was". NEVER copy the Goal, Conflict, or Setting text directly into the story.
4) Keep the chapter length within ${lengthTargets.wordMin}-${lengthTargets.wordMax} words.
5) Do not change the plot beats, only the wording.
6) Remove summary-meta phrases ("Die Konsequenz war klar", "Der Preis?", "The consequence was clear", "The price?") and repetitive speaker formulas.
${missingLine ? `7) ${missingLine}\n` : ""}

PROMPT LEAK PREVENTION:
You are strictly forbidden from copying the exact phrasing of the Goal, Conflict, or Setting into the story text.
You must translate these abstract concepts into concrete, in-world actions and dialogue.

ORIGINAL TEXT:
${originalText}

Return JSON:
{
  "_planning": {
    "anti_leak_check": "List any words from the Goal/Conflict that you are tempted to use, and write your concrete alternative here instead.",
    "voice_separation_check": "How will you ensure each character sounds distinct? (e.g. short sentences vs formal words)"
  },
  "text": "Chapter text"
}`;
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

function trimPromptLines(block: string | undefined, maxLines: number): string {
  if (!block || !block.trim()) return "";
  return block
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, Math.max(1, maxLines))
    .join("\n")
    .trim();
}

function sanitizeStylePackBlock(block: string | undefined, isGerman: boolean): string {
  const base = sanitizePromptBlock(block, 1400);
  if (!base) return "";
  const banned = isGerman
    ? /(ausblick|vorschau|kapitelende|kapitel endet|epilog|hook)/i
    : /(outlook|preview|chapter ending|chapter ends|epilogue|hook)/i;
  const controlLine = buildControlLinePattern(isGerman);
  const lines = base
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !banned.test(line))
    .filter(line => !controlLine.test(line))
    .slice(0, 10);
  return lines.join("\n").trim();
}

function sanitizeDirectiveNarrativeText(value: string | undefined): string {
  if (!value) return "";
  let text = String(value).replace(/\s+/g, " ").trim();
  if (!text) return "";

  const cleanupPatterns = [
    /\b(?:wir|we)\s+(?:ersetzen|replace)\s+(?:es|it)\b/gi,
    /\b(?:nichts|kein(?:e|en)?)\s+mit\s+konflikt\b/gi,
    /\b(?:die\s+szene\s+endete|the\s+scene\s+ended)\b/gi,
    /\b(?:die\s+handlung\s+r(?:ue|�)ckte\s+vor|the\s+action\s+moved\s+forward)\b/gi,
    /\b(?:strict\s+rules\??|output\s+format|return\s+json)\b/gi,
    /\b(?:der\s+ausblick|the\s+outlook)\b/gi,
  ];

  for (const pattern of cleanupPatterns) {
    text = text.replace(pattern, " ");
  }

  return text.replace(/\s+/g, " ").trim();
}

function trimDirectiveText(value: string | undefined, maxChars: number): string {
  const normalized = sanitizeDirectiveNarrativeText(String(value || ""));
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
  const controlLine = buildControlLinePattern(isGerman);
  const cleanedLines = normalized
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !controlLine.test(line))
    .slice(0, 10);
  if (cleanedLines.length === 0) return "";
  const cleaned = cleanedLines.join("\n");
  if (isGerman) {
    return `# ZUSAETZLICHE NUTZER-VORGABEN (hoch priorisiert)\n${cleaned}\n- Setze diese Vorgaben kreativ um, ohne die harten Regeln oben zu brechen.\n- WICHTIG: Beispielnamen in den Vorgaben (z. B. in Beispielsaetzen) sind keine neuen Figuren.\n- Bei Konflikten gelten immer zuerst Cast-Lock, Kapitel-/Wortvorgaben und Sicherheitsregeln.\n`;
  }
  return `# ADDITIONAL USER REQUIREMENTS (high priority)\n${cleaned}\n- Apply these requirements creatively without breaking the hard rules above.\n- IMPORTANT: Proper names used only in examples are not new characters.\n- In conflicts, cast lock, chapter/length constraints, and safety rules always win.\n`;
}

function buildControlLinePattern(isGerman: boolean): RegExp {
  const common = [
    "hard rules?",
    "strict rules?",
    "output format",
    "return json",
    "json",
    "cast lock",
    "allowed names?",
    "story[- ]?beat",
    "beat directives?",
    "character voices?",
    "avatar",
    "artifact",
    "parental safety",
    "blocked terms?",
    "internal writing process",
    "internal editing",
    "quality check",
  ];
  const german = [
    "harte regeln",
    "ausgabe[- ]?format",
    "nur diese namen",
    "figuren \\(nur",
    "story-beat-vorgaben",
    "kapitel\\s*\\d",
    "wortanzahl",
    "laenge",
    "rolle und ziel",
    "du bist",
    "verbotene woerter",
  ];
  const english = [
    "chapter\\s*\\d",
    "word count",
    "length",
    "you are",
    "forbidden words",
  ];
  const parts = isGerman ? [...common, ...german] : [...common, ...english];
  return new RegExp(`(?:${parts.join("|")})`, "i");
}




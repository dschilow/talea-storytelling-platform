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

// ─── Optimized Full Story Prompt (V3) ─────────────────────────────────────────
// Kompakter, effektiver, mit dynamischen Charakter-Properties aus DB

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
  const focusMaxActive = ageRange.max <= 8 ? 3 : 4;
  const focusIdealRange = ageRange.max <= 8 ? "2-3" : "3-4";
  const focusGlobalMax = ageRange.max <= 8 ? 4 : 6;

  const avatarRule = focusChildNames.length >= 2
    ? `- Avatar-Pflicht: ${focusChildNames.join(" und ")} sind gleichwertige Hauptfiguren und in JEDEM Beat aktiv (je Beat mindestens eine Handlung + eine Dialogzeile pro Kind).`
    : focusChildNames.length === 1
      ? `- Hauptkind-Pflicht: ${focusChildNames[0]} ist in JEDEM Beat aktiv (Handlung oder Dialog).`
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
      memorySection = isGerman
        ? `\n# Fruehere Abenteuer\n${memoryTitles.join("\n")}\n- Baue GENAU EINE kurze Referenz ein: \"Das erinnert mich an ...\" (nicht nacherzaehlen).\n`
        : `\n# Earlier Adventures\n${memoryTitles.join("\n")}\n- Add EXACTLY one short reference: \"This reminds me of ...\" (do not retell).\n`;
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

  const safetyRule = isGerman
    ? "Keine explizite Gewalt, keine Waffen, kein Blut, kein Horror, kein Mobbing, keine Politik/Religion, keine Drogen/Alkohol/Gluecksspiel."
    : "No explicit violence, no weapons, no blood, no horror, no bullying, no politics/religion, no drugs/alcohol/gambling.";

  const titleHint = isGerman
    ? "Max 6 Woerter, neugierig machend, kein Schema \"Objekt und Person\"."
    : "Max 6 words, curiosity-driven, avoid \"object and person\" pattern.";

  const humorTarget = Math.max(0, Math.min(3, Number.isFinite(humorLevel as number) ? Number(humorLevel) : 2));
  const humorRule = isGerman
    ? humorTarget >= 3
      ? "Humor-Ziel hoch: mindestens 3 klare kindgerechte Lachmomente (Dialogwitz, Situationskomik, kleiner Missgriff ohne Bloßstellung)."
      : humorTarget >= 2
        ? "Humor-Ziel mittel: mindestens 2 klare kindgerechte Lachmomente."
        : humorTarget >= 1
          ? "Humor-Ziel leicht: mindestens 1 kindgerechter humorvoller Moment."
          : "Humor optional: keine erzwungenen Witze."
    : humorTarget >= 3
      ? "High humor target: at least 3 clear child-friendly laugh moments (dialogue wit, situational comedy, harmless mishap)."
      : humorTarget >= 2
        ? "Medium humor target: at least 2 clear child-friendly laugh moments."
        : humorTarget >= 1
          ? "Light humor target: at least 1 child-friendly humorous beat."
          : "Humor optional: no forced jokes.";

  return `DU BIST: Kinderbuchautor auf Profi-Niveau (Preussler + Lindgren + Funke). Warm, frech, spannend.
ZIEL: Kinder (${ageRange.min}-${ageRange.max}) wollen selbst weiterlesen.

HARD RULES (muessen erfuellt sein):
1) Sprache: Nur ${targetLanguage}.${isGerman ? " Keine englischen Woerter." : ""}
2) Ausgabe: Nur gueltiges JSON. Kein Text davor/danach.
3) Laenge: ${totalWordMin}-${totalWordMax} Woerter gesamt.
4) Struktur: ${directives.length} Beats in Reihenfolge. Zwischen Beats genau eine Leerzeile. Keine Ueberschriften/Nummern im Storytext. Pro Beat etwa ${wordsPerChapter.min}-${wordsPerChapter.max} Woerter.
5) Cast-Lock: Nur diese Figuren: ${allowedNames.join(", ")}. Keine neuen Figuren.
6) Figurenfokus: Pro Beat max ${focusMaxActive} aktive Figuren (ideal ${focusIdealRange}), global max ${focusGlobalMax} aktiv erkennbare Figuren.
7) Kindgerecht: ${safetyRule}
8) Artefakt: ${artifactName || (isGerman ? "Artefakt" : "artifact")} (${artifactRule}). Bogen: Entdecken -> Fehlleitung/Problem -> clever nutzen (loest NICHT allein).
9) Show, don't tell: Gefuehle durch Koerper/Handlung/Details zeigen, nicht erklaeren.
10) Kein Deus ex Machina. Loesung entsteht durch Mut + Teamwork + kluge Entscheidung.

STIL (sehr wichtig, aber flexibel):
- Zielton: ${targetTone}.
- Meist kurze Saetze, ab und zu ein laengerer fuer Schwung. Keine Satzmonster.
- Dialoganteil ca. 30-40% (mindestens 25%), keine langen Monologe.
- Pro Beat mindestens zwei kurze Dialogwechsel zwischen Figuren.
- Jede Figur hat eigene Stimme (Wortwahl, Satzlaenge, Tick).
- Pro Beat mindestens 1 konkretes Sinnesdetail (Geruch/Klang/Licht/Haptik).
- Sprache bodenstaendig und kindnah: hoechstens 1 Vergleich pro Absatz, keine erwachsenen Metaphernketten.
- Vermeide wiederkehrende Tell-Formeln (z. B. "Stille fiel", "er/sie spuerte", "innen zog sich").
- Pro Beat maximal ein kurzer Innensicht-Satz; danach wieder sichtbare Aktion oder Dialog.
- Spaetestens in Beat 2: klare Konsequenz bei Scheitern mit konkretem Verlust.
- ${humorRule}
- Humor-Regel: Situationskomik und kurze Missverstaendnisse nutzen; Witze nie erklaeren.
- Zusaetzlich mindestens 1 Atem-anhalten-Moment.
- Beat ${directives.length}: konkreter Gewinn + kleiner Preis/Kompromiss sichtbar machen.
- Beat-Enden variieren; Beat ${directives.length} endet warm und geschlossen.
- Verwende niemals Meta-Labels im Fliesstext (z. B. "Der Ausblick:", "Hook:", "Szene:", "Kapitel 1").
- Keine Vorschau-Saetze wie "Bald wuerden sie...", "Ein Ausblick blieb..." oder "Noch wussten sie nicht...".
- Keine Lehrsatz-Saetze ueber Regeln/Funktionen (z. B. "Das Artefakt zeigt..."). Zeige Wirkung nur durch Szene + Reaktion.

${avatarRule ? `${avatarRule}\n` : ""}${stylePackBlock ? `STYLE PACK (zusaetzlich):\n${stylePackBlock}\n\n` : ""}${customPromptBlock ? `${customPromptBlock}\n` : ""}FIGURENSTIMMEN:
${characterProfiles.join("\n\n")}
${memorySection}${artifactName ? `\n# Artefakt-Arc\n- Name: ${artifactName}\n- Nutzen: ${artifactRule}\n- Pflichtbogen: Entdecken -> Fehlleitung -> cleverer Einsatz durch die Kinder.\n` : ""}
# BEAT-VORGABEN
${beatLines}

# INTERNER SCHREIBPROZESS (nicht ausgeben)
- Erstelle intern zuerst eine kurze Beat-Skizze.
- Schreibe dann die Geschichte als fliessenden Text.
- Fuehre internes Lektorat durch: Hard Rules, Stimmen, Rhythmus, Show-don't-tell, Schlusswaerme.
- Gib danach NUR das finale JSON aus.

# AUSGABE-FORMAT
{
  "title": "${titleHint}",
  "description": "Ein Teaser-Satz als Frage oder kleines Raetsel",
  "storyText": "Fliessender Text mit genau einer Leerzeile zwischen Beats."
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
  const avatarRule = focusChildNames.length >= 2
    ? `- ${focusChildNames.join(" und ")} muessen in JEDEM Beat aktiv sein (je Beat mindestens eine Handlung + eine Dialogzeile pro Kind).`
    : focusChildNames.length === 1
      ? `- ${focusChildNames[0]} muss in JEDEM Beat aktiv sein.`
      : "";

  const stylePackBlock = sanitizeStylePackBlock(stylePackText, isGerman);
  const customPromptBlock = formatCustomPromptBlock(userPrompt, isGerman);
  const humorTarget = Math.max(0, Math.min(3, Number.isFinite(humorLevel as number) ? Number(humorLevel) : 2));
  const humorRewriteLine = isGerman
    ? humorTarget >= 3
      ? "- Humor hoch halten: mindestens 3 klare kindgerechte Lachmomente (Dialogwitz oder Situationskomik, nie auf Kosten von Figuren)."
      : humorTarget >= 2
        ? "- Humor sichern: mindestens 2 klare kindgerechte Lachmomente."
        : humorTarget >= 1
          ? "- Mindestens 1 kurzer kindgerechter Humor-Moment."
          : "- Humor optional, keine erzwungenen Witze."
    : humorTarget >= 3
      ? "- Keep humor high: at least 3 clear child-friendly laugh moments (dialogue wit or situational comedy, never humiliating)."
      : humorTarget >= 2
        ? "- Keep humor present: at least 2 clear child-friendly laugh moments."
        : humorTarget >= 1
          ? "- Include at least 1 short child-friendly humor moment."
          : "- Humor optional, avoid forced jokes.";

  const originalText = originalDraft.chapters
    .map(ch => `--- Beat ${ch.chapter} ---\n${ch.text}`)
    .join("\n\n");

  return `AUFGABE: Ueberarbeite die Geschichte so, dass sie wie ein echtes Kinderbuch klingt. Behalte Plot und Figurenkern, verbessere Sprache, Rhythmus und Voice.

KONKRETE PROBLEME (zu beheben):
${qualityIssues || "- Keine speziellen Issues uebergeben; optimiere trotzdem Prosa, Rhythmus und Figurenstimmen."}

HARD RULES:
1) Sprache: Nur ${targetLanguage}.${isGerman ? " Keine englischen Woerter." : ""}
2) Zielgruppe: ${ageRange.min}-${ageRange.max} Jahre, klar und kindgerecht.
3) Cast-Lock: Nur diese Namen sind erlaubt: ${allowedNames || "(keine)"}. Keine neuen Figuren.
4) Struktur: ${directives.length} Beats in Reihenfolge, keine Kapitel-Titel im Fliesstext.
5) Laenge: ${totalWordMin}-${totalWordMax} Woerter gesamt; pro Beat etwa ${wordsPerChapter.min}-${wordsPerChapter.max}.
6) Kindgerecht: keine explizite Gewalt, keine Waffen, kein Blut, kein Horror, kein Mobbing, keine Politik/Religion, keine Drogen/Alkohol/Gluecksspiel.
7) Show, don't tell: Gefuehle ueber Koerpersignale, Handlung und konkrete Details.
8) Kein Deus ex Machina.
9) Ende klar, warm, ohne Cliffhanger.
${artifactName ? `10) Artefakt "${artifactName}" bleibt relevant, loest aber nicht allein.` : ""}
${avatarRule || ""}

STIL-ZIELE (flexibel, aber wichtig):
- Zielton: ${targetTone}.
- Meist kurze Saetze, ab und zu ein laengerer fuer Schwung.
- Dialoganteil etwa 30-40% (mindestens 25%), mit klar unterscheidbaren Stimmen.
- In jedem Beat mehrere kurze Dialogwechsel, damit die Kinderstimmen leben.
- Konkrete, alltagsnahe Sprache: maximal ein Vergleich pro Absatz, keine erwachsenen Metaphernbilder.
- Wiederholte Tell-Formeln aufbrechen ("spuerte", "Stille fiel", "innen zog sich").
- Pro Beat maximal ein kurzer Innensicht-Satz; dann wieder sichtbare Handlung/Dialog.
- Frueh konkrete Stakes benennen: was geht sichtbar verloren, wenn sie scheitern.
- Pro Beat mindestens ein konkretes Sinnesdetail.
${humorRewriteLine}
- Humor-Regel: Situationskomik und kurze Missverstaendnisse nutzen; keine Witz-Erklaerungen im Nachsatz.
- Mindestens ein klarer Spannungsmoment.
- Im Finale: konkreter Gewinn plus kleiner Preis/Kompromiss.
- Keine Meta-Saetze oder Label-Phrasen wie "Leitfrage", "Ausblick", "Der Ausblick:", "Hook", "Beat" im Storytext.
- Keine Vorschau-Saetze wie "Bald wuerden sie...", "Ein Ausblick blieb..." oder "Noch wussten sie nicht...".
- Keine Erklaersaetze ueber Objekt-Regeln ("X zeigt...", "X bedeutet..."): stattdessen konkrete Szene + Dialogreaktion.

${stylePackBlock ? `STYLE PACK (zusaetzlich):\n${stylePackBlock}\n\n` : ""}${customPromptBlock ? `${customPromptBlock}\n` : ""}INTERNES LEKTORAT (nicht ausgeben):
- Pruefe Hard Rules, Stimmen, Rhythmus, Show-don't-tell, Wortzahl.
- Wenn etwas bricht: intern ueberarbeiten.
- Danach nur das finale JSON ausgeben.

ORIGINAL-TEXT:
${originalText}

AUSGABE-FORMAT (nur JSON):
{
  "title": "Story-Titel",
  "description": "Teaser-Satz",
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
${strict ? "12) Do not include any instruction text or meta commentary in the output." : ""}

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
3) Replace template phrases with concrete action + short dialogue lines.
3b) Do NOT output headings or labels like "Ort:", "Stimmung:", "Ziel:", "Hindernis:", "Handlung:", "Action:", "Mini-Problem:", "Mini-Aufloesung:", "Mini-Resolution:", "Hook:", "Ausblick:", "Der Ausblick:", "Epilog:", "Scene:", "Mood:", "Goal:", "Obstacle:", "Outlook:", "Sichtbare Aktion:", "Aktion fortgesetzt:", "Visible action:", "Action continued:". Also never start sentences with "Ihr Ziel war", "Ein Hindernis war", "Her goal was", "An obstacle was".
4) Keep the chapter length within ${lengthTargets.wordMin}-${lengthTargets.wordMax} words.
5) Do not change the plot beats, only the wording.
${missingLine ? `6) ${missingLine}\n` : ""}

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
    2000,
  );
  if (!normalized) return "";
  if (isGerman) {
    return `# ZUSAETZLICHE NUTZER-VORGABEN (hoch priorisiert)\n${normalized}\n- Setze diese Vorgaben kreativ um, ohne die harten Regeln oben zu brechen.\n`;
  }
  return `# ADDITIONAL USER REQUIREMENTS (high priority)\n${normalized}\n- Apply these requirements creatively without breaking the hard rules above.\n`;
}


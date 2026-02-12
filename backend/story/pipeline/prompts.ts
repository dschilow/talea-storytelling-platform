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
  totalWordTarget: number;
  totalWordMin: number;
  totalWordMax: number;
  wordsPerChapter: { min: number; max: number };
  stylePackText?: string;
  strict?: boolean;
  fusionSections?: Map<number, string>;
  avatarMemories?: Map<string, AvatarMemoryCompressed[]>;
}): string {
  const { directives, cast, dna, language, ageRange, tone, totalWordMin, totalWordMax, wordsPerChapter, stylePackText, fusionSections, avatarMemories } = input;
  const isGerman = language === "de";
  const artifactName = cast.artifact?.name?.trim();
  const artifactRule = cast.artifact?.storyUseRule || "wichtiges magisches Objekt";

  // Sammle alle einzigartigen Charaktere
  const allSlots = new Set(directives.flatMap(d => d.charactersOnStage));
  const allowedNames: string[] = [];
  const characterProfiles: string[] = [];

  for (const slot of allSlots) {
    const sheet = findCharacterBySlot(cast, slot);
    if (!sheet || slot.includes("ARTIFACT")) continue;
    allowedNames.push(sheet.displayName);
    characterProfiles.push(buildCharacterProfile(sheet as CharacterSheet, isGerman));
  }

  // Kapitel-Übersicht (kompakt)
  const chapterOutlines = directives.map((d, idx) => {
    const charsOnStage = d.charactersOnStage
      .filter(s => !s.includes("ARTIFACT"))
      .map(s => findCharacterBySlot(cast, s)?.displayName)
      .filter(Boolean)
      .join(", ");

    const isLast = idx === directives.length - 1;
    const artifactNote = d.artifactUsage && !d.artifactUsage.toLowerCase().includes("nicht genutzt")
      ? ` [${artifactName}]`
      : "";

    // Kompakt: Kapitel + Setting + Ziel + Figuren + Hook
    let outline = `${idx + 1}. **${d.setting}**: ${d.goal}${artifactNote}`;
    outline += `\n   Figuren: ${charsOnStage}`;
    if (!isLast && d.outcome) {
      outline += `\n   Hook: ${d.outcome.substring(0, 80)}`;
    }

    // Fusion-Hinweise falls vorhanden
    const fusionBlock = fusionSections?.get(d.chapter);
    if (fusionBlock) {
      const lines = fusionBlock.split("\n").slice(0, 2);
      outline += `\n   ${lines.join("; ")}`;
    }

    return outline;
  }).join("\n\n");

  const focusChildNames = cast.avatars.map(a => a.displayName).filter(Boolean);
  const emotionalFocus = focusChildNames.length > 0
    ? focusChildNames.slice(0, 2).join(", ")
    : allowedNames.slice(0, 2).join(", ");
  const focusMaxActive = ageRange.max <= 8 ? 3 : 4;
  const focusIdealRange = ageRange.max <= 8 ? "2-3" : "3-4";
  const focusGlobalMax = ageRange.max <= 8 ? 4 : 6;

  // Build avatar emphasis rule if multiple avatars present
  const avatarEmphasis = focusChildNames.length >= 2
    ? `\n# Avatar-Pflicht (BEIDE Kinder muessen aktiv sein)\n` +
      `Die Kinder ${focusChildNames.join(" und ")} sind GLEICHWERTIGE Hauptfiguren.\n` +
      `- Beide muessen in JEDEM Beat vorkommen (Aktion ODER Dialog).\n` +
      `- Kein Kind darf nur danebenstehen oder nur nicken.\n` +
      `- Jedes Kind braucht eigene Entscheidungen und eigene Dialogzeilen.\n` +
      `- Beide machen Fehler und haben Erfolge – nicht nur eines.\n`
    : "";

  // Altersgerechter Stil
  const ageStyle = ageRange.max <= 5
    ? "Sehr kurze Sätze (max 10 Wörter), sanfte Wiederholung, 1 Hauptproblem, sichere Auflösung."
    : ageRange.max <= 8
      ? "Kurze Sätze (max 15 Wörter), mehr Dialog, kleine Rätsel, spielerische Spannung, klare Hooks."
      : ageRange.max <= 12
        ? "Mittlere Sätze, stärkere Motive, schärfere Wendungen, tiefere Emotionen."
        : "Komplexerer Stil, moralische Nuancen, größere Wendungen.";

  const readabilityRules = ageRange.max <= 8
    ? [
        "- Ziel: sehr leicht lesbar fuer Vorlese- und Erstlesealter.",
        "- Satzlaenge: MEIST 4-10 Woerter, ab und zu bis 14, fast NIE ueber 16.",
        "- Maximal 15% der Saetze duerfen laenger als 14 Woerter sein.",
        "- Maximal 1 Vergleich pro Absatz, keine Metaphernketten.",
        "- Satz-Rhythmus PFLICHT: Abwechslung zwischen kurz (4-6 W.) und mittel (8-12 W.).",
        "- NIEMALS drei gleich lange Saetze hintereinander.",
        "- Beispiel fuer guten Rhythmus: \"Er rannte los. Der Wind pfiff ihm ins Gesicht, scharf und kalt. Schneller! Die Tuer war nah.\"  (4, 10, 1, 4)",
      ].join("\n")
    : "- Satzlaenge altersgerecht variieren, aber klar und konkret bleiben.";

  const stylePackBlock = stylePackText?.trim()
    ? `# STYLE PACK (verbindlich)\n${stylePackText.trim()}\n`
    : "";

  // Build avatar memory section for story continuity
  // OPTIMIZED: Ultra-compact format – only story titles, no experience text, minimal rules.
  // Reasoning models (gpt-5-mini) burn disproportionate tokens on extra context.
  let memorySection = "";
  if (avatarMemories && avatarMemories.size > 0) {
    const memoryTitles: string[] = [];
    for (const avatar of cast.avatars) {
      const memories = avatarMemories.get(avatar.characterId);
      if (!memories || memories.length === 0) continue;
      const titles = memories.map(m => m.storyTitle).join(", ");
      memoryTitles.push(`${avatar.displayName}: ${titles}`);
    }
    if (memoryTitles.length > 0) {
      memorySection = `\n# Frühere Abenteuer\n${memoryTitles.join("\n")}\nBaue EINE kurze, natürliche Referenz ein ("Das erinnert mich an..."). Nicht nacherzählen.\n`;
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // HAUPTPROMPT - Optimiert für Token-Effizienz und Qualität
  // ────────────────────────────────────────────────────────────────────────────

  return `# Rolle und Ziel
Du bist ein preisgekrönter Kinderbuch-Autor mit dem Witz von Roald Dahl, der Wärme von Astrid Lindgren und der Magie von Cornelia Funke.
Schreibe eine komplette Kindergeschichte auf ${isGerman ? "Deutsch" : language}. **Nur JSON-Ausgabe.**

# Zielgruppe
- Alter: ${ageRange.min}–${ageRange.max} Jahre
- ${ageStyle}

# Ton
${tone || dna.toneBounds?.targetTone || "Warm"}, frech, aufregend – wie ein Lieblingsonkel, der heimlich ein Pirat war.
Niemals belehrend, niemals zynisch, niemals langweilig.

# Lesbarkeit (streng)
${readabilityRules}

${stylePackBlock}

# Das oberste Gebot: ZEIGEN, NICHT ERZÄHLEN
\`\`\`
❌ VERBOTEN: "Emma hatte Angst."
✅ RICHTIG: "Emmas Knie zitterten. Sie presste die Hand auf den Mund."

❌ VERBOTEN: "Der Wald war unheimlich."
✅ RICHTIG: "Nebel hing zwischen den Bäumen. Irgendwo knackte ein Ast."

❌ VERBOTEN: "Sie freuten sich sehr."
✅ RICHTIG: "Sie klatschten so laut ab, dass Bello erschrocken bellte."
\`\`\`

# Satz-Variation (PFLICHT - sonst klingt es wie ein Roboter)
\`\`\`
❌ MONOTON: "Mia saß am Tisch. Licht fiel herein. Adrian stand an der Tür. Er war nervoes."
✅ LEBENDIG: "Am Holztisch klebte noch Mehlstaub. Mia ruehrte darin herum, als der Kompass zu blinken begann. Adrian? Klebte an der Tuer wie eine Briefmarke."
\`\`\`
- NIEMALS mehr als 2 Saetze hintereinander mit "Subjekt + Verb" anfangen.
- Variiere Satzanfaenge: Ort, Zeit, Geraeusch, Frage, Dialog, Aktion.
- Nutze auch Einwortsaetze und Ausrufe: "Knacks!" / "Stille." / "Nein!"

# Stil-Regeln
1. Kurze, klare Saetze mit starken Verben.
2. Jeder Satz dient Handlung, Charakter oder Atmosphaere.
3. Dialog ist wichtig, aber nicht dominant (ca. 25-40% der Saetze).
4. Maximal 1 Adjektiv pro Nomen, keine Ketten.
5. Wenige, konkrete Sinneseindruecke statt Dauerbeschreibungen.
6. Pro Absatz maximal ein Vergleich, keine Metaphernketten.
7. Berufsrollen nur bei Einfuehrung nennen, danach vor allem Name/Pronomen.
8. Rhythmuswechsel je Beat: kurz/schnell -> ruhig/emotional -> kurz/schnell.
9. Hauptfiguren muessen verschieden klingen:
   - Kind A spricht z.B. schnell, abgehackt, mit Ausrufen.
   - Kind B spricht z.B. vorsichtig, langsam, benutzt "Wir" statt "Ich".
   - NPC hat eigenen Tick (Kichern, Reimen, Piepen, etc.).
10. Rollenbezeichnungen mit Namen nicht wiederholen (nicht dauernd "Feuerwehrfrau Fanni"), nach Einfuehrung meist Name/Pronomen.

# Humor & Charme (PFLICHT bei witzig/frech)
- Mindestens 2 uebertriebene Situationen pro Geschichte (Slapstick, Wortwitz, Absurdität).
- Kinder duerfen frech sein (aber nie gemein).
- Dialog-Humor: Figuren reden aneinander vorbei, missverstehen etwas, oder reagieren unerwartet.
- Beispiel: Statt "Sie lachten" -> "Adrian kicherte so laut, dass das Broetchen erschrocken schneller rollte."

# Verbotene Woerter
"plötzlich", "irgendwie", "ein bisschen", "ziemlich", "wirklich", "sehr", "Es war einmal"

# Verbotene Platzhalter
"[inhalt-gefiltert]", "[content-filtered]", "[redacted]"

# Fokus-Regeln
- Pro Beat maximal ${focusMaxActive} aktive Figuren, ideal ${focusIdealRange}.
- Wenn der Beat-Plan mehr Namen nennt: waehle ${focusIdealRange} Fokusfiguren mit klarer Handlung.
- Weitere Figuren nur kurz im Hintergrund, ohne eigene Nebenhandlung.
- Ueber die ganze Geschichte maximal ${focusGlobalMax} aktiv erkennbare Figuren.

# Dramaturgie-Pflicht (muss spuerbar sein)
1. Beat 1: klares Ziel + Frage.
2. Beat 2: Hindernis wird groesser + Zeitdruck oder Risiko.
3. Beat 3: echter Rueckschlag (Plan scheitert / Verlust / falsche Spur).
4. Beat 4: Tiefpunkt + mutige Entscheidung eines Kindes.
5. Beat 5: Loesung mit Preis und emotionalem Nachklang.
- Die Stakes muessen klar sein: "Wenn wir es nicht schaffen, dann ...".
- Beat 3 oder 4 muss einen klar benannten Verlust/Preis enthalten (nicht nur kleine Verzoegerung, keine Mini-Folgen wie verlorene Kruemel).

# Emotionaler Kern (Kinder-Perspektive)
- In jedem Beat mindestens 1 kurzer innerer Moment von ${emotionalFocus}.
- Zeige Koerpersignal + Gedanke (z. B. zittern + Zweifel), nicht nur Aktion.
- Mindestens ein Kind macht einen Fehler und korrigiert ihn spaeter.
- Jede Hauptfigur braucht eine erkennbare Sprachfarbe in Dialogen.

# Harte Regeln (muessen erfuellt sein)
1. Sprache: Nur ${isGerman ? "Deutsch" : language}.
2. Laenge: Gesamt ${totalWordMin}-${totalWordMax} Woerter. Pro Story-Beat ca. ${wordsPerChapter.min}-${wordsPerChapter.max} Woerter.
3. Flow: Eine zusammenhaengende Geschichte (keine Kapitel-Labels, keine Nummerierung im Text).
4. Beat-Struktur: Die Geschichte bildet alle ${directives.length} Beats in der Reihenfolge ab.
5. Absatz-Regel: Genau eine Leerzeile zwischen Beats, ohne Ueberschriften.
6. Keine Meta-Labels: Kein "Setting:", "Ziel:", "Hook:" usw.
7. Cast Lock: Nur diese Namen: ${allowedNames.join(", ")}. Keine neuen Figuren.
8. Aktive Charaktere: Figuren handeln sichtbar (Verb + Objekt) oder sprechen.
9. Figurenlimit pro Beat einhalten (max ${focusMaxActive} aktive Figuren, ideal ${focusIdealRange}).
10. Globaler Figurenfokus: Insgesamt hoechstens ${focusGlobalMax} aktiv erkennbare Figuren.
11. Figurenstimmen: In Mehrfiguren-Szenen muessen mindestens zwei klar unterscheidbare Stimmen hoerbar sein.
12. Dialog: Keine Monologe. Kurze, natuerliche Rede.
13. Anti-Wiederholung: Keine identischen Saetze. Catchphrase pro Figur hoechstens 1x.
14. Kein Deus ex Machina: Die Loesung entsteht durch Mut, Teamwork oder kluge Entscheidung.
15. Ende ohne Predigt: Die Geschichte zeigt die Botschaft, sie erklaert sie nicht.
16. Letzter Beat schliesst die Leitfrage klar und warm ab; kein neues Raetsel, kein Cliffhanger.
17. Finale-Fokus: Im letzten Beat maximal ${focusMaxActive} aktive Figuren, bevorzugt ${focusIdealRange}.

# Figuren (NUR diese erlaubt)
Jede Figur hat einzigartige Persönlichkeit, Sprechweise und Fähigkeiten:

${characterProfiles.join("\n\n")}

${memorySection}
${avatarEmphasis}
${artifactName ? `# Artefakt: ${artifactName}
**Funktion**: ${artifactRule}

**Pflicht-Bogen**:
| Phase | Kapitel | Was passiert |
|-------|---------|--------------|
| Einführung | 1–2 | Wird entdeckt, zeigt erste Fähigkeit |
| Versagen | 2–3 | Funktioniert falsch ODER führt in Sackgasse |
| Triumph | 4–5 | Held nutzt es CLEVER (Artefakt löst nicht allein!) |` : ""}

# Story-Beat-Vorgaben
${chapterOutlines}

# Qualitäts-Check (intern prüfen)
- [ ] Erster Satz macht sofort neugierig?
- [ ] Pro Beat maximal ${focusMaxActive} aktive Figuren?
- [ ] Insgesamt nicht mehr als ${focusGlobalMax} aktiv erkennbare Figuren?
- [ ] Gibt es klare Stakes: "Wenn wir es nicht schaffen, dann ..."?
- [ ] Gibt es einen echten Tiefpunkt in Beat 3 oder 4?
- [ ] Haben die Kinder sichtbare Gefühle + innere Gedanken?
- [ ] Dialoge: Klingen mindestens zwei Figuren klar unterschiedlich?
- [ ] Werden Rollenlabels nicht dauernd wiederholt?
- [ ] Ist die Sprache rhythmisch wechselnd statt dauerhaft dicht?
- [ ] Letzter Satz bleibt im Kopf?
- [ ] Ende klar geloest und warm (kein neues offenes Problem)?
- [ ] Wortanzahl im Zielkorridor pro Beat?

# Ausgabe-Format
Antworte NUR mit validem JSON. Kein Text davor oder danach.

\`\`\`json
{
  "title": "Kurzer Titel (max 7 Wörter)",
  "description": "Ein packender Teaser-Satz",
  "storyText": "Eine zusammenhängende Geschichte als Fließtext mit Leerzeile zwischen Beats, aber ohne Kapitel-Titel/Nummern."
}
\`\`\``;
}

// ─── Optimized Rewrite Prompt (V2) ────────────────────────────────────────────
// Kompakter, fokussiert nur auf die Probleme

export function buildFullStoryRewritePrompt(input: {
  originalDraft: { title: string; description: string; chapters: Array<{ chapter: number; text: string }> };
  directives: SceneDirective[];
  cast: CastSet;
  dna: TaleDNA | StoryDNA;
  language: string;
  ageRange: { min: number; max: number };
  tone?: string;
  totalWordMin: number;
  totalWordMax: number;
  wordsPerChapter: { min: number; max: number };
  qualityIssues: string;
  stylePackText?: string;
}): string {
  const { originalDraft, directives, cast, dna, language, ageRange, tone, totalWordMin, totalWordMax, wordsPerChapter, qualityIssues, stylePackText } = input;
  const isGerman = language === "de";
  const artifactName = cast.artifact?.name?.trim();

  const allSlots = new Set(directives.flatMap(d => d.charactersOnStage));
  const allowedNamesList = Array.from(allSlots)
    .map(slot => findCharacterBySlot(cast, slot)?.displayName)
    .filter((name): name is string => Boolean(name));
  const allowedNames = allowedNamesList.join(", ");
  const focusChildNames = cast.avatars.map(a => a.displayName).filter(Boolean);
  const emotionalFocus = focusChildNames.length > 0
    ? focusChildNames.slice(0, 2).join(", ")
    : allowedNamesList.slice(0, 2).join(", ");
  const focusMaxActive = ageRange.max <= 8 ? 3 : 4;
  const focusIdealRange = ageRange.max <= 8 ? "2-3" : "3-4";
  const focusGlobalMax = ageRange.max <= 8 ? 4 : 6;

  const originalText = originalDraft.chapters
    .map(ch => `--- Beat ${ch.chapter} ---\n${ch.text}`)
    .join("\n\n");

  const stylePackBlock = stylePackText?.trim()
    ? `\n# STYLE PACK (verbindlich)\n${stylePackText.trim()}\n`
    : "";

  return `# Aufgabe
Überarbeite die Geschichte. Behalte Handlung und Charaktere, behebe ALLE Probleme.

${qualityIssues}
${stylePackBlock}

# 10.0 Ziele (Pflicht)
- Figurenfokus: pro Beat max ${focusMaxActive} aktive Figuren, ideal ${focusIdealRange}.
- Aktive Figuren = spricht sichtbar oder handelt sichtbar (Verb + Objekt).
- Wenn ein Beat mehr Namen traegt: waehle ${focusIdealRange} Fokusfiguren; weitere Figuren nur kurz im Hintergrund.
- Ueber die ganze Geschichte maximal ${focusGlobalMax} aktiv erkennbare Figuren.
- Dramaturgie mit Eskalation:
  Beat 1 Ziel + Leitfrage.
  Beat 2 Risiko steigt (Zeitdruck ODER klare Gefahr).
  Beat 3 echter Rueckschlag (Plan scheitert / Verlust / falsche Spur).
  Beat 4 Tiefpunkt + mutige Entscheidung eines Kindes.
  Beat 5 Loesung mit kleinem Preis und emotionalem Nachklang.
- Stakes muessen explizit sein: genau eine konkrete Konsequenz frueh benennen ("Wenn wir es nicht schaffen, dann ...").
- In Beat 3 oder 4 muss ein echter Verlust/Preis passieren, nicht nur ein kurzer Umweg.
- In Beat 3 oder 4 darf der Rueckschlag nicht sofort relativiert werden ("kein Problem", "keine Katastrophe", etc.).
- Emotionaler Kern: in jedem Beat mindestens 1 kurzer innerer Moment von ${emotionalFocus}.
- Mindestens ein Kind macht einen Fehler und korrigiert ihn spaeter aktiv.
- Sprachrhythmus wechseln: kurz/schnell -> ruhig/emotional -> kurz/schnell.
- Letzter Beat schliesst die Leitfrage klar: kein neues Raetsel, kein Cliffhanger, warmes Ende.

# Regeln (unveraenderlich)
- Erlaubte Namen: ${allowedNames}
- Keine neuen Figuren.
- Laenge: ${totalWordMin}-${totalWordMax} Woerter gesamt, **${wordsPerChapter.min}-${wordsPerChapter.max} pro Beat**.
- Kurze Beats mit Handlung + Dialog ausbauen (zeigen, nicht erklaeren).
- Jeder Beat enthaelt klar: Ziel, Hindernis, Entscheidung, kleines Ergebnis/Hook.
- Fuer Alter ${ageRange.min}-${ageRange.max}: kurze klare Saetze, wenig Schachtelsaetze.
- Figurenstimmen schaerfen: in Mehrfiguren-Szenen mindestens zwei unterscheidbare Sprecher.
- Figurenstimmen unterscheidbar halten: jede Hauptfigur bekommt eine klare Sprachfarbe (Wortwahl + Satzrhythmus).
- Berufsrollen (z. B. "Feuerwehrfrau", "Polizist") nur bei Einfuehrung, danach meist Name/Pronomen.
- Ton: ${tone ?? dna.toneBounds?.targetTone ?? "warm"}, Alter: ${ageRange.min}-${ageRange.max}
${artifactName ? `- Artefakt "${artifactName}" aktiv und sinnvoll nutzen.` : ""}
- Letzter Beat: Epilog (2-4 Saetze) ohne Predigt.
- Schluss ohne offene Restfrage im letzten Absatz.

# VERBOTEN im Text
"Setting:", "Ziel:", "Hook:", "Hindernis:", "Aktion:", passive Sätze, "Ihr Ziel war", "Ein Hindernis war", "[inhalt-gefiltert]", "[content-filtered]", "[redacted]"

# Original-Text
${originalText}

# Ausgabe
Komplette überarbeitete Geschichte als JSON:
\`\`\`json
{
  "title": "Story-Titel",
  "description": "Teaser-Satz",
  "chapters": [
    { "chapter": 1, "text": "..." },
    ...
  ]
}
\`\`\``;
}

// ─── Chapter Expansion Prompt (V2 - kompakter) ────────────────────────────────

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
11) End with a gentle forward-looking line (except final chapter).
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
}): string {
  const { chapter, cast, dna, language, ageRange, tone, lengthHint, pacing, lengthTargets: overrideTargets, stylePackText, issues, originalText } = input;
  const isGerman = language === "de";
  const lengthTargets = overrideTargets ?? resolveLengthTargets({ lengthHint, ageRange, pacing });
  const artifactName = cast.artifact?.name?.trim();
  const characterNames = chapter.charactersOnStage
    .map(slot => findCharacterBySlot(cast, slot)?.displayName)
    .filter(Boolean) as string[];
  const allowedNames = Array.from(new Set(characterNames)).join(", ");

  const issueList = issues.length > 0 ? issues.map(issue => `- ${issue}`).join("\n") : "- Keine";

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
${stylePackText ? `\n${stylePackText}\n` : ""}

RULES:
1) Use only these names: ${allowedNames || "none"}.
2) No new proper names.
3) No meta-instructions.
3b) Do NOT output headings or labels like "Scene:", "Mood:", "Goal:", "Obstacle:", "Action:", "Mini-problem:", "Mini-resolution:", "Hook:", "Outlook:", "Epilogue:", "Ort:", "Stimmung:", "Ziel:", "Hindernis:", "Visible action:", "Action continued:", "Sichtbare Aktion:", "Aktion fortgesetzt:". Also never start sentences with "Her goal was", "An obstacle was", "Ihr Ziel war", "Ein Hindernis war".
4) Every character must act or speak.
5) Do not state belonging explicitly; avoid phrases like "always been part of this tale".
6) Avoid stock phrases like "makes an important decision", "has a special idea", "shows a new ability", "feels the tension", "decisive clue", "important hint", "question that unties the knot".
7) ${lengthTargets.wordMin}-${lengthTargets.wordMax} words, ${lengthTargets.sentenceMin}-${lengthTargets.sentenceMax} sentences.
8) No placeholder chapters. If the scene feels short, expand with a concrete action sequence + 2-3 short dialogue lines.
9) Children's-book style: vivid, rhythmic, varied sentence starts.

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
3b) Do NOT output headings or labels like "Ort:", "Stimmung:", "Ziel:", "Hindernis:", "Handlung:", "Action:", "Mini-Problem:", "Mini-Aufloesung:", "Mini-Resolution:", "Hook:", "Ausblick:", "Epilog:", "Scene:", "Mood:", "Goal:", "Obstacle:", "Outlook:", "Sichtbare Aktion:", "Aktion fortgesetzt:", "Visible action:", "Action continued:". Also never start sentences with "Ihr Ziel war", "Ein Hindernis war", "Her goal was", "An obstacle was".
4) Keep the chapter length within ${lengthTargets.wordMin}-${lengthTargets.wordMax} words.
5) Do not change the plot beats, only the wording.
${missingLine ? `6) ${missingLine}\n` : ""}

ORIGINAL TEXT:
${originalText}

Return JSON:
{ "text": "Chapter text" }`;
}

export function buildStoryTitlePrompt(input: { storyText: string; language: string }): string {
  return `Create a short story title (max 7 words) and a 1-sentence teaser hook for the following children's story in ${input.language === "de" ? "German" : input.language}.
Return JSON:
{ "title": "...", "description": "..." }

Story:
${input.storyText}`;
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


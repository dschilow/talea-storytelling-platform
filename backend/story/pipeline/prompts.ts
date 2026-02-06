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
  const { directives, cast, dna, language, ageRange, tone, totalWordMin, totalWordMax, wordsPerChapter, fusionSections, avatarMemories } = input;
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

  // Altersgerechter Stil
  const ageStyle = ageRange.max <= 5
    ? "Sehr kurze Sätze (max 10 Wörter), sanfte Wiederholung, 1 Hauptproblem, sichere Auflösung."
    : ageRange.max <= 8
      ? "Kurze Sätze (max 15 Wörter), mehr Dialog, kleine Rätsel, spielerische Spannung, klare Hooks."
      : ageRange.max <= 12
        ? "Mittlere Sätze, stärkere Motive, schärfere Wendungen, tiefere Emotionen."
        : "Komplexerer Stil, moralische Nuancen, größere Wendungen.";

  // Build avatar memory section for story continuity
  let memorySection = "";
  if (avatarMemories && avatarMemories.size > 0) {
    const memoryBlocks: string[] = [];
    // Map avatar IDs to display names via cast
    for (const avatar of cast.avatars) {
      const memories = avatarMemories.get(avatar.characterId);
      if (!memories || memories.length === 0) continue;
      const lines = memories.map((m, i) => {
        const icon = m.emotionalImpact === 'positive' ? '✨' : m.emotionalImpact === 'negative' ? '💔' : '💭';
        return `  ${i + 1}. ${icon} "${m.storyTitle}": ${m.experience}`;
      }).join("\n");
      memoryBlocks.push(`**${avatar.displayName}**:\n${lines}`);
    }
    if (memoryBlocks.length > 0) {
      memorySection = `
# Erinnerungen der Avatare (vergangene Abenteuer)
${memoryBlocks.join("\n\n")}

**Erinnerungs-Regeln**:
- Baue mindestens EINE natürliche Referenz zu einem früheren Erlebnis ein.
- Beispiel: "Das erinnert mich an...", murmelte Alexander. ODER: Seit dem Abenteuer im Kristallwald wusste sie, dass...
- NICHT nacherzählen, nur kurze, natürliche Rückblicke.
`;
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

# Das oberste Gebot: ZEIGEN, NICHT ERZÄHLEN
\`\`\`
❌ VERBOTEN: "Emma hatte Angst."
✅ RICHTIG: "Emmas Knie zitterten. Sie presste die Hand auf den Mund."

❌ VERBOTEN: "Der Wald war unheimlich."
✅ RICHTIG: "Nebel hing zwischen den Bäumen. Irgendwo knackte ein Ast."

❌ VERBOTEN: "Sie freuten sich sehr."
✅ RICHTIG: "Sie klatschten so laut ab, dass Bello erschrocken bellte."
\`\`\`

# Stil-Regeln
1. Kurze, klare Sätze mit starken Verben.
2. Jeder Satz arbeitet: Handlung, Charakter, Atmosphäre oder Lacher.
3. Dialog treibt 60% der Handlung – lebendig, unterbrochen, charakteristisch.
4. Max 1 Adjektiv pro Nomen. Keine Adjektiv-Ketten.
5. Konkrete Sinne pro Kapitel: Was hört, riecht, fühlt der Held?
6. Humor: Körperkomik, absurde Logik, Dreier-Regel (2× normal, 3. Mal Chaos).

# Verbotene Wörter
"plötzlich", "irgendwie", "ein bisschen", "ziemlich", "wirklich", "sehr", "Es war einmal"

# Harte Regeln (müssen erfüllt sein)
1. **Sprache**: Nur ${isGerman ? "Deutsch" : language}.
2. **Länge**: Gesamt ${totalWordMin}–${totalWordMax} Wörter. Pro Kapitel **${wordsPerChapter.min}–${wordsPerChapter.max} Wörter** (HARTES MINIMUM: ${wordsPerChapter.min}).
3. **Kapitel-Struktur**: Jedes Kapitel enthält: (a) Sinnesdetail-Einstieg, (b) klares Ziel, (c) Hindernis, (d) Aktion mit Konsequenz, (e) Hook am Ende (außer letztes).
4. **Keine Meta-Labels**: Keine "Setting:", "Ziel:", "Hook:" – nur Prosa.
5. **Cast Lock**: NUR diese Namen: ${allowedNames.join(", ")}. Keine neuen Charaktere!
6. **Aktive Charaktere**: Mind. 3–4 Figuren HANDELN pro Kapitel (Verb + Objekt).
7. **Anti-Wiederholung**: Keine identischen Sätze. Catchphrases genau 1×.
8. **Kein Deus ex Machina**: Der Held löst es selbst – durch Mut, Cleverness oder Teamwork.
9. **Ende ohne Predigt**: Die Geschichte IST die Moral. Nie erklären.

# Figuren (NUR diese erlaubt)
Jede Figur hat einzigartige Persönlichkeit, Sprechweise und Fähigkeiten:

${characterProfiles.join("\n\n")}

${memorySection}
${artifactName ? `# Artefakt: ${artifactName}
**Funktion**: ${artifactRule}

**Pflicht-Bogen**:
| Phase | Kapitel | Was passiert |
|-------|---------|--------------|
| Einführung | 1–2 | Wird entdeckt, zeigt erste Fähigkeit |
| Versagen | 2–3 | Funktioniert falsch ODER führt in Sackgasse |
| Triumph | 4–5 | Held nutzt es CLEVER (Artefakt löst nicht allein!) |` : ""}

# Kapitel-Vorgaben
${chapterOutlines}

# Qualitäts-Check (intern prüfen)
- [ ] Erster Satz macht sofort neugierig?
- [ ] Jedes Kapitel: mind. 1 Lacher + 1 Kribbel-Moment?
- [ ] Dialoge: Klingt jeder Charakter ANDERS?
- [ ] Sinne dabei: Hören, Riechen, Fühlen?
- [ ] Letzter Satz bleibt im Kopf?
- [ ] Wortanzahl ${wordsPerChapter.min}+ pro Kapitel?

# Ausgabe-Format
Antworte NUR mit validem JSON. Kein Text davor oder danach.

\`\`\`json
{
  "title": "Kurzer Titel (max 7 Wörter)",
  "description": "Ein packender Teaser-Satz",
  "chapters": [
    { "chapter": 1, "title": "Neugier-Hook-Titel", "text": "Kapiteltext..." },
    { "chapter": 2, "title": "Neugier-Hook-Titel", "text": "Kapiteltext..." },
    ...
  ]
}
\`\`\``;
}

// ─── Optimized Rewrite Prompt (V2) ────────────────────────────────────────────
// Kompakter, fokussiert nur auf die Probleme

export function buildFullStoryRewritePrompt(input: {
  originalDraft: { title: string; description: string; chapters: Array<{ chapter: number; title: string; text: string }> };
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
  const allowedNames = Array.from(allSlots)
    .map(slot => findCharacterBySlot(cast, slot)?.displayName)
    .filter(Boolean)
    .join(", ");

  const originalText = originalDraft.chapters
    .map(ch => `--- Kapitel ${ch.chapter}: ${ch.title} ---\n${ch.text}`)
    .join("\n\n");

  return `# Aufgabe
Überarbeite die Geschichte. Behalte Handlung und Charaktere, behebe ALLE Probleme.

${qualityIssues}

# Regeln (unveränderlich)
- Erlaubte Namen: ${allowedNames}
- Keine neuen Figuren
- Länge: ${totalWordMin}–${totalWordMax} Wörter gesamt, **${wordsPerChapter.min}–${wordsPerChapter.max} pro Kapitel**
- Kurze Kapitel → mit Aktion + Dialog erweitern (zeigen, nicht erzählen)
- Fehlende Figur → einfügen mit Aktion + mindestens 1 Dialog-Zeile
- Jedes Kapitel: Sinneseinstieg, Ziel, Hindernis, Aktion, Hook
- Ton: ${tone ?? dna.toneBounds?.targetTone ?? "warm"}, Alter: ${ageRange.min}–${ageRange.max}
${artifactName ? `- Artefakt "${artifactName}" aktiv nutzen` : ""}
- Kapiteltitel = Neugier-Hooks
- Letztes Kapitel: Epilog (2–4 Sätze)

# VERBOTEN im Text
"Setting:", "Ziel:", "Hook:", "Hindernis:", "Aktion:", passive Sätze, "Ihr Ziel war", "Ein Hindernis war"

# Original-Text
${originalText}

# Ausgabe
Komplette überarbeitete Geschichte als JSON:
\`\`\`json
{
  "title": "Story-Titel",
  "description": "Teaser-Satz",
  "chapters": [
    { "chapter": 1, "title": "...", "text": "..." },
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

  const missingLine = requiredCharacters?.length
    ? `\n**FEHLENDE FIGUREN (MÜSSEN EINGEFÜGT WERDEN):** ${requiredCharacters.join(", ")}\nJede muss: benannt werden + konkrete Aktion + mind. 1 Dialog-Zeile`
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
3. Keine Meta-Labels im Text
4. Erweitern durch: konkrete Aktion + 2–3 Dialog-Zeilen
5. Sinnesdetails hinzufügen

${contextLines ? `# Kontext\n${contextLines}\n` : ""}
# Original
${originalText}

# Ausgabe
JSON: { "title": "Kapiteltitel", "text": "Kapiteltext" }`;
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
11) Chapter title must be a curiosity hook, not "Chapter X".
12) End with a gentle forward-looking line (except final chapter).
${strict ? "13) Do not include any instruction text or meta commentary in the output." : ""}

Return JSON:
{ "title": "Short chapter title", "text": "Chapter text" }`;
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
9) Chapter title must be a curiosity hook, not "Chapter X".
10) Children's-book style: vivid, rhythmic, varied sentence starts.

ORIGINAL TEXT:
${originalText}

Return JSON:
{ "title": "Short chapter title", "text": "Chapter text" }`;
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
{ "title": "Short chapter title", "text": "Chapter text" }`;
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

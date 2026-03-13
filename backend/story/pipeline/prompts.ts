import type { CastSet, SceneDirective, StoryDNA, TaleDNA, AvatarMemoryCompressed, StoryBlueprint } from "./types";
import { getChildFocusNames, getChildFocusSheets, getCoreChapterCharacterNames, isLikelyChildCharacter } from "./character-focus";

// ─── Character Profile Builder ────────────────────────────────────────────────
// Baut ein kompaktes, einzigartiges Charakter-Profil aus den DB-Properties

interface CharacterSheet {
  displayName: string;
  roleType?: string;
  slotKey?: string;
  personalityTags?: string[];
  speechStyleHints?: string[];
  visualSignature?: string[];
  outfitLock?: string[];
  faceLock?: string[];
  forbidden?: string[];
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

function getPromptRoleLabel(sheet: CharacterSheet, isGerman: boolean): string {
  if (isLikelyChildCharacter(sheet)) {
    return isGerman ? "Kind" : "Child";
  }

  const speciesLabel = getSpeciesLabel(sheet.species || "", isGerman);
  if (speciesLabel) return speciesLabel;

  const plainRole = String(sheet.role || "").trim();
  if (plainRole && !/^(avatar|protagonist|antagonist|helper|mentor|sidekick)$/i.test(plainRole)) {
    return plainRole;
  }

  const roleType = String(sheet.roleType || "").trim();
  if (/antagonist/i.test(roleType)) {
    return isGerman ? "Stoerenfried" : "Troublemaker";
  }
  if (/helper|mentor/i.test(roleType)) {
    return isGerman ? "Helfer" : "Helper";
  }

  return "";
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

  // Personality from DB or fallback
  const personality = sheet.personalityTags?.slice(0, 3).join(", ")
    || ep?.dominant
    || "curious";

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

  // Build compact lines
  let lines: string[] = [];

  // Line 1: Name + core personality
  let line1 = `**${name}**`;
  const roleLabel = getPromptRoleLabel(sheet, isGerman);
  if (roleLabel) line1 += ` (${roleLabel})`;
  line1 += `: ${personality}`;
  if (secondaryTraits) line1 += `; ${secondaryTraits}`;
  lines.push(line1);

  // Line 2: Speech style with example
  const speechExample = generateSpeechExample(name, speechStyle, catchphrase, isGerman);
  lines.push(`  - Speech: ${speechStyle}. ${speechExample}`);

  // Line 3: Quirk + Catchphrase (if available)
  if (quirk || catchphrase) {
    let line3 = "  -";
    if (quirk) line3 += ` Quirk: ${quirk}.`;
    if (catchphrase && catchphraseContext) {
      line3 += ` Catchphrase (${catchphraseContext}): "${catchphrase}"`;
    } else if (catchphrase) {
      line3 += ` Catchphrase: "${catchphrase}"`;
    }
    lines.push(line3);
  }

  // Line 4: Profession-specific ability (based on archetype)
  const ability = getArchetypeAbility(archetype, species, isGerman);
  if (ability) {
    lines.push(`  - Ability: ${ability}`);
  }

  return lines.join("\n");
}

function buildCompactCharacterProfile(sheet: CharacterSheet, isGerman: boolean): string {
  const role = getPromptRoleLabel(sheet, isGerman);
  const dominant = sheet.enhancedPersonality?.dominant
    || sheet.personalityTags?.[0]
    || "curious";
  const speech = sheet.speechStyleHints?.[0]
    || "clear and direct";
  const rolePart = role ? ` (${role})` : "";
  return `- ${sheet.displayName}${rolePart}: ${dominant}; Voice: ${speech}.`;
}

function uniquePromptItems(items: Array<string | undefined>, limit = 4): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of items) {
    const value = String(raw || "").trim();
    if (!value) continue;
    const normalized = value.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(value);
    if (out.length >= limit) break;
  }
  return out;
}

function isPlaceholderAppearanceToken(value: string): boolean {
  const normalized = String(value || "").trim().toLowerCase();
  return [
    "distinct child",
    "clear facial features",
    "recognizable outfit",
    "consistent outfit",
    "distinct supporting character",
    "adult proportions",
    "duplicate character",
    "extra limbs",
    "complete teeth, no gap",
  ].includes(normalized);
}

function buildAppearanceLockBlock(sheets: CharacterSheet[], isGerman: boolean): string {
  const lines = sheets
    .map((sheet) => {
      const allowed = uniquePromptItems([
        ...(sheet.visualSignature || []),
        ...(sheet.outfitLock || []),
        ...(sheet.faceLock || []),
      ].filter(value => !isPlaceholderAppearanceToken(value)), 4);
      const forbidden = uniquePromptItems((sheet.forbidden || []).filter(value => !isPlaceholderAppearanceToken(value)), 4);
      if (allowed.length === 0 && forbidden.length === 0) return "";

      if (isGerman) {
        return `- ${sheet.displayName}: Nur bestaetigte Merkmale verwenden${allowed.length ? ` (${allowed.join(", ")})` : ""}. ${forbidden.length ? `Niemals erfinden: ${forbidden.join(", ")}.` : "Wenn hier kein Accessoire steht, keines dazudichten."}`;
      }

      return `- ${sheet.displayName}: Use only confirmed visual markers${allowed.length ? ` (${allowed.join(", ")})` : ""}. ${forbidden.length ? `Never invent: ${forbidden.join(", ")}.` : "If no accessory is listed here, do not add one."}`;
    })
    .filter(Boolean)
    .join("\n");

  if (!lines) return "";

  const globalRule = isGerman
    ? "- GLOBAL: Erfinde niemals Brille, Muetze, Schal, Haarfarbe, Augenfarbe oder andere Markenzeichen, wenn sie unten nicht ausdruecklich bestaetigt sind."
    : "- GLOBAL: Never invent glasses, hats, scarves, hair color, eye color, or signature accessories unless they are explicitly confirmed below.";

  return `${lines}\n${globalRule}`;
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
  // Use catchphrase as example if available
  if (catchphrase && catchphrase.length < 50) {
    return `Example: "${catchphrase}"`;
  }

  // Generate example based on speech style — dialogue samples stay in target language
  const styleExamples: Record<string, string> = {
    "fast": isGerman ? `Example: "Schnell-schnell! Keine Zeit!"` : `Example: "Quick-quick! No time!"`,
    "breathless": isGerman ? `Example: "Schnell-schnell! Keine Zeit!"` : `Example: "Quick-quick! No time!"`,
    "woof": isGerman ? `Example: "Wuff! Ich riech was! Wuff-wuff!"` : `Example: "Woof! I smell something! Woof-woof!"`,
    "barking": isGerman ? `Example: "Wuff! Ich riech was! Wuff-wuff!"` : `Example: "Woof! I smell something! Woof-woof!"`,
    "giggling": isGerman ? `Example: "Hihihi! Erwischt! Kicher-kicher!"` : `Example: "Hehehe! Caught you! Giggle-giggle!"`,
    "rhyming": isGerman ? `Example: "Eins-zwei-drei, Zauber frei!"` : `Example: "One-two-three, magic free!"`,
    "telepathic": isGerman ? `Example: "*Habt keine Furcht. Euer Mut leuchtet.*"` : `Example: "*Fear not. Your courage shines.*"`,
    "gentle": isGerman ? `Example: "*Folgt eurem Herzen...*"` : `Example: "*Follow your heart...*"`,
    "mechanical": isGerman ? `Example: "Piep-Piep. Analyse komplett."` : `Example: "Beep-Boop. Analysis complete."`,
    "croaking": isGerman ? `Example: "Quaaak! Ich bin ein Prinz! Wirklich!"` : `Example: "Croak! I'm a prince! Really!"`,
    "grumbling": isGerman ? `Example: "Grmpf. Was willst du?"` : `Example: "Grmpf. What do you want?"`,
    "whispering": isGerman ? `Example: "Psst... kommt näher..."` : `Example: "Psst... come closer..."`,
    "regal": isGerman ? `Example: "Wir befehlen, dass..."` : `Example: "We command that..."`,
    "squeaky": isGerman ? `Example: "Pieps! Eine Nuss! Da! Da!"` : `Example: "Squeak! A nut! There! There!"`,
  };

  // Find matching example
  for (const [style, example] of Object.entries(styleExamples)) {
    if (speechStyle.toLowerCase().includes(style)) {
      return example;
    }
  }

  return "";
}

function isGenericChildVoiceHint(value: string): boolean {
  const normalized = String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return normalized.length === 0 || [
    "klar",
    "clear",
    "normal",
    "neutral",
    "direkt",
    "direct",
    "einfach",
    "simple",
    "ruhig",
    "calm",
  ].includes(normalized);
}

function buildChildVoiceContract(childNames: string[], isGerman: boolean): string {
  if (childNames.length === 0) return "";

  // Voice contract templates — English instructions, dialogue samples in target language
  const templates = isGerman
    ? [
      { label: "Cheeky and fast", desc: "3-8 words, interrupts others, asks bold questions", example: '"Kann sie piepen?" / "Das ist streng-magisch."' },
      { label: "Calm and clever", desc: "concrete details, clear sentences, acts instead of talking", example: '"Wir muessen weiter." (grabs arm, walks fast)' },
      { label: "Curious and witty", desc: "invents words, makes unexpected connections", example: '"Das riecht nach Abenteuer. Und nach Kaese."' },
    ]
    : [
      { label: "Cheeky and fast", desc: "3-8 words, interrupts others, asks bold questions", example: '"Can it beep?" / "That is strict-magic."' },
      { label: "Calm and clever", desc: "concrete details, clear sentences, acts instead of talking", example: '"We need to go." (grabs arm, walks fast)' },
      { label: "Curious and witty", desc: "invents words, makes unexpected connections", example: '"Smells like adventure. And cheese."' },
    ];

  const lines = childNames
    .slice(0, 3)
    .map((name, idx) => {
      const t = templates[idx] || templates[templates.length - 1];
      return `  - ${name}: ${t.label} — ${t.desc}. Example: ${t.example}`;
    })
    .join("\n");

  const globalRule = "  - IMPORTANT: Children must sound COMPLETELY different. A child recognizes WHO speaks by the sentence alone.";

  return `${lines}\n${globalRule}`;
}

function buildFocusedChildVoiceContract(childSheets: CharacterSheet[], isGerman: boolean): string {
  if (childSheets.length === 0) return "";

  // 5-Dimensionen Voice-DNA Templates — each voice is a full personality profile
  const fallbackVoices = isGerman
    ? [
      {
        label: "DER BEOBACHTER",
        satzlaenge: "4-8 Woerter, manchmal laenger fuer Details",
        guide: "spricht ruhig, bemerkt kleine Details, stellt klare Fragen",
        wennNervoes: "wird STILLER, nicht lauter. Beisst sich auf die Lippe.",
        humor: "trockene, unerwartete Beobachtungen",
        beispiele: [
          `"Da fehlt ein Stein." (bueckt sich, tippt drauf)`,
          `"Hmm." (legt den Kopf schief) "Das ergibt keinen Sinn."`,
          `"Weisst du, was komisch ist? Der Schatten zeigt nach links."`,
        ],
      },
      {
        label: "DER DRAUFGAENGER",
        satzlaenge: "2-5 Woerter, Ausrufe, unterbricht andere",
        guide: "spricht in kurzen Ausrufen, platzt dazwischen, handelt zuerst",
        wennNervoes: "redet MEHR und SCHNELLER, nicht weniger.",
        humor: "uebertreibt alles, macht Geraeusche nach",
        beispiele: [
          `"REIN DA!" (springt bevor die anderen fertig denken)`,
          `"Langweilig. Wann passiert was?" (trommelt gegen die Wand)`,
          `"Hab keine Ahnung. Mach trotzdem." (grinst)`,
        ],
      },
      {
        label: "DER WUNDERER",
        satzlaenge: "alle Laengen gemischt, redet in Bildern",
        guide: "macht konkrete, unerwartete Beobachtungen und staunt laut",
        wennNervoes: "wird still, starrt ins Leere, sagt dann was Ueberraschendes.",
        humor: "verrueckte Vergleiche, unerwartete Assoziationen",
        beispiele: [
          `"Das sieht aus wie ein Keks mit Zaehnen." (dreht den Kopf)`,
          `"Wartet." (greift in den Rucksack) "Hab ich was fuer."`,
          `"Also wenn das ein Drache war, hatte er definitiv Schnupfen."`,
        ],
      },
    ]
    : [
      {
        label: "THE OBSERVER",
        satzlaenge: "4-8 words, sometimes longer for details",
        guide: "speaks calmly, notices small details, asks clear questions",
        wennNervoes: "gets QUIETER, not louder. Bites lip.",
        humor: "dry, unexpected observations",
        beispiele: [
          `"There's a stone missing." (crouches, taps it)`,
          `"Hmm." (tilts head) "That doesn't add up."`,
          `"You know what's weird? The shadow points left."`,
        ],
      },
      {
        label: "THE CHARGER",
        satzlaenge: "2-5 words, exclamations, interrupts others",
        guide: "speaks in short bursts, interrupts, acts first",
        wennNervoes: "talks MORE and FASTER, not less.",
        humor: "exaggerates everything, imitates sounds",
        beispiele: [
          `"IN THERE!" (jumps before others finish thinking)`,
          `"Boring. When does stuff happen?" (drums on wall)`,
          `"No clue. Doing it anyway." (grins)`,
        ],
      },
      {
        label: "THE WONDERER",
        satzlaenge: "mixed lengths, speaks in images",
        guide: "makes concrete unexpected observations and blurts them out",
        wennNervoes: "goes quiet, stares into nothing, then says something surprising.",
        humor: "wild comparisons, unexpected associations",
        beispiele: [
          `"That looks like a cookie with teeth." (turns head)`,
          `"Wait." (reaches into backpack) "Got something for this."`,
          `"If that was a dragon, it definitely had a cold."`,
        ],
      },
    ];

  const lines = childSheets
    .slice(0, 3)
    .map((sheet, idx) => {
      const rawSpeechStyle = sheet.speechStyleHints?.slice(0, 2).join(", ") || "";
      const fallback = fallbackVoices[idx] || fallbackVoices[fallbackVoices.length - 1];
      // Use character's own speech style as voice name if it's specific, otherwise use the template label
      const voiceName = isGenericChildVoiceHint(rawSpeechStyle) ? fallback.label : rawSpeechStyle;
      const examples = fallback.beispiele.map(ex => `    - ${ex}`).join("\n");

      return `  - ${sheet.displayName}: ${voiceName}
    Satzlaenge: ${fallback.satzlaenge}.
    ${fallback.guide}.
    Wenn nervoes: ${fallback.wennNervoes}
    Humor: ${fallback.humor}.
    Beispiele:
${examples}`;
    })
    .join("\n\n");

  const globalRule = isGerman
    ? "  KONTRAST-TEST: Wenn man den Dialog von Kind A mit Kind B tauschen kann ohne dass es falsch klingt → SOFORT umschreiben. Jedes Kind muss allein am Satz erkennbar sein."
    : "  CONTRAST TEST: If you can swap Child A's dialogue with Child B's without it sounding wrong → REWRITE immediately. Each child must be recognizable by the sentence alone.";

  return `${lines}\n\n${globalRule}`;
}

// ─── Golden Example & Anti-Patterns ──────────────────────────────────────────

function buildGoldenExampleBlock(isGerman: boolean): string {
  const germanExamples = `"""
SZENE 0 – SO BEGINNT KAPITEL 1 (Pflicht-Vorlage: Welt + Figuren + Auftrag):
Es war einmal, in einem kleinen Dorf am Rande eines großen, dunklen Waldes, da lebten zwei Brüder.
Das ältere Kind hieß Mira und war acht Jahre alt. Sie hatte immer einen Plan und blieb nie lange still stehen.
Ihr kleiner Bruder Timo war erst fünf und fragte schon nach dem ersten Blick, was als Nächstes passieren würde.

Eines Morgens rief ihre Mutter die beiden in die Küche. Auf dem Tisch stand ein großer Korb, gefüllt mit frisch gebackenem Kuchen.
"Eure Großmutter ist krank", sagte die Mutter mit besorgtem Blick. "Sie wohnt drüben auf der anderen Seite des Waldes. Bringt ihr bitte diesen Korb, damit sie schnell wieder gesund wird."

Mira nickte ernst. "Keine Sorge, Mama. Ich passe auf Timo auf."
Timo rückte näher an den Tisch. "Dann gehen wir jetzt, oder?"
Die Mutter lächelte. "Denkt daran: Bleibt auf dem Weg und sprecht nicht mit Fremden!"

WHY THIS OPENING WORKS:
- Paragraph 1: WHO + WHERE (2 characters, vivid traits, world established)
- Paragraph 2: MISSION (what + why — crystal clear, any 6-year-old understands)
- Paragraph 3: CHARACTER VOICES + RULE (dialogue anchors personality, sets up later danger)
- The reader knows everything before the adventure starts.

SZENE A – Rhythmus + Unterbrechung:
Mama knallte den Korb auf den Tisch. Plopp.
"Darf ich–" "Nein", sagte Mama. So schnell, als waere der Deckel ein Krokodilmaul.
Mira beugte sich vor. "Da dampft was." "Und es klappert", sagte Timo.
Er tippte mit dem Finger gegen den Korb. "Und das klingt nicht nach Ruhe."

SZENE B – Humor durch Situation:
"Kann sie auch piepen?" "Nein." "Kann sie Stopp sagen?" "Nein."
"Kann sie wenigstens einmal–" Mama schob die Muenze in Miras Tasche.
Timo seufzte. "Das ist streng-magisch."

SZENE C – Figur-Eintritt mit Detail:
Am Rand der Lichtung stand ein Wolf. Gross. Grau. Mit einer knallroten Nase.
Und einem Taschentuch. Einem echten Taschentuch.
Er putzte sich, ohne aufzusehen. "Allergie", murmelte er.

SZENE D – Konfrontation + Action:
Oma kam raus wie ein Gewitter mit Schal. Kochloeffel in der Hand. Nase rot.
Augen gefaehrlich. "RAUS", sagte sie.
Der Wolf stolperte rueckwaerts ueber den Zaun. Das Taschentuch wehte hinterher.

SZENE E – Innerer Moment (Somatic Marker):
Timo drueckte die Haende in die Taschen. Der Stoff war warm vom Rennen.
Sein Bauch machte dieses komische Ziehen, wenn etwas Grosses gleich passiert.
Er schluckte. "Okay", sagte er. Ganz leise. Nur fuer sich.

SZENE F – Szene mit Dreier-Rhythmus:
Der Stein war glatt. Kalt. Und viel zu schwer fuer einen allein.
"Ich heb an", sagte Timo. "Ich halte", sagte Mira.
Sie zogen gleichzeitig. Der Stein rutschte eine Handbreit. Dann noch eine.
Kapitaen Blubbert verschraenkte die Arme. "Ihr habt vergessen, mich zu fragen."
Er packte den Stein mit einer Hand. Hob ihn hoch.
Timo starrte. Mira auch.
"Ihr koennt jetzt klatschen", sagte Kapitaen Blubbert.

SZENE G – Absaetze, die atmen (Prosa-Rhythmus):
Der Laden war eng und warm. Bruno wischte die Theke mit einem Lappen,
der frueher mal weiss gewesen war. Jetzt war er braun. Und ein bisschen klebrig.
"Ich brauch Mehl", sagte er, ohne aufzusehen. "Drei Saecke. Und Glueck."
Timo legte den Kopf schief. "Glueck kann man nicht kaufen."
"Doch", sagte Bruno. "Es kostet nur mehr als Mehl."

SZENE H – Subtext-Dialog (Kind sagt nicht was es meint):
"Macht mir nichts aus", sagte Adrian. Er stopfte die Haende in die Taschen.
Ganz tief. Bis die Naehte spannten.
Alexander sah ihn an. Er sagte nichts. Aber er blieb stehen.
Das war genug.

SZENE I – Humor durch Uebertreibung:
Die Tuer klemmte. Adrian zerrte daran. "Geht. Nicht. Auf!"
Er zerrte staerker. Die Tuer gab keinen Millimeter nach.
"Vielleicht druecken?", sagte Alexander.
Adrian drueckte. Die Tuer schwang auf wie von allein.
"Wusste ich", sagte Adrian. Ohne rot zu werden.

SZENE J – Humor durch Wort-Erfindung:
"Was ist das fuer ein Geraeusch?", fluesterte Mia.
"Klingt wie... ein Schnarchwolf", sagte Adrian.
"Schnarchwolf ist kein Wort."
"Ist es jetzt."

SZENE K – Charakter-Widerspruch (der Vorsichtige ueberreagiert):
Alexander blieb stehen. "Wir gehen nicht da rein. Auf keinen Fall."
"Warum nicht?"
"Weil... weil es dunkel ist."
Adrian blinzelte. "Du hast Angst vor der Dunkelheit?"
"Hab ich nicht!", sagte Alexander. Viel zu schnell.
"""` ;

  const englishExamples = `"""
SCENE 0 – HOW CHAPTER 1 MUST OPEN (mandatory template: World + Characters + Mission):
Once upon a time, in a small village at the edge of a great dark forest, there lived two brothers.
The older child was called Mira and was eight years old. She always had a plan and never stood still for long.
Her little brother Timo was only five and asked what happened next before anyone had finished the first sentence.

One morning their mother called them into the kitchen. On the table stood a large basket, filled with freshly baked cake.
"Your grandmother is sick," said their mother with a worried look. "She lives on the other side of the forest. Please bring her this basket so she gets better soon."

Mira nodded seriously. "Don't worry, Mama. I'll look after Timo."
Timo stepped closer to the table. "Then we should go now, right?"
Their mother smiled. "Remember: stay on the path and don't talk to strangers!"

WHY THIS OPENING WORKS:
- Paragraph 1: WHO + WHERE (2 characters, vivid traits, world established)
- Paragraph 2: MISSION (what + why — crystal clear, any 6-year-old understands)
- Paragraph 3: CHARACTER VOICES + RULE (dialogue anchors personality, sets up later danger)
- The reader knows everything before the adventure starts.

SCENE A – Rhythm + interruption:
Mom slammed the basket on the table. Pop.
"Can I–" "No," said Mom. Quick as a crocodile jaw.
Mira leaned in. "Something is steaming." "And rattling," said Timo.
He tapped the basket. "And that does not sound calm."

SCENE B – Humor through situation:
"Can it beep?" "No." "Can it say Stop?" "No."
"Can it at least once–" Mom pushed the coin into Mira's pocket.
Timo sighed. "That's strict-magic."

SCENE C – Character entrance with detail:
At the edge of the clearing stood a wolf. Big. Gray. With a bright red nose.
And a tissue. A real tissue.
He blew his nose without looking up. "Allergies," he muttered.

SCENE D – Confrontation + Action:
Grandma came out like a thunderstorm in a scarf. Wooden spoon in hand.
Nose red. Eyes dangerous. "OUT," she said.
The wolf stumbled backwards over the fence. The tissue fluttered after him.

SCENE E – Inner Moment (Somatic Marker):
Timo pressed his hands into his pockets. The fabric was warm from running.
His belly did that weird pull-thing when something big is about to happen.
He swallowed. "Okay," he said. Very quietly. Just for himself.

"""`;

  if (isGerman) {
    return `# PROSA-QUALITAET – STUDIERE DIESE BEISPIELE (das ist das Zielniveau)

${germanExamples}

WAS DIESE BEISPIELE GROSSARTIG MACHT — WENDE ALLE 7 AUF JEDES KAPITEL AN:
1. ABSAETZE ATMEN: 2-4 Saetze pro Absatz, Leerzeile dazwischen — nie eine Textwand.
2. DIALOG VERANKERT an koerperlicher Handlung — immer. Keine schwebenden Zitate.
3. HUMOR durch Situation und Ueberraschung — nie durch Erklaerung.
4. RHYTHMUS: Kurz. Kurz. Ein laengerer Satz mit ueberraschendem Detail. Kurz.
5. KONKRETES sensorisches Detail in jedem Absatz (Geraeusch, Textur, Temperatur, Bewegung).
6. JEDE Figur erkennbar allein an Satzlaenge und Wortwahl — ohne den Namen zu lesen.
7. INNERE MOMENTE nur durch Koerperempfindungen — nie Gefuehls-Etiketten wie "sie hatte Angst".
8. SUBTEXT: Was Figuren SAGEN ist nicht immer was sie MEINEN. Haende, Blick, Tempo verraten die Wahrheit.
9. HUMOR-VIELFALT: Wort-Erfindungen, Uebertreibungen, Missverstaendnisse, Charakter-Widersprueche.`;
  }

  return `# PROSE QUALITY REFERENCE – STUDY THESE EXAMPLES (this is the target level)

${englishExamples}

WHAT MAKES THESE EXAMPLES GREAT — APPLY ALL 7 TO EVERY CHAPTER:
1. PARAGRAPH BREATHING: 2-4 sentences per paragraph, separated by blank lines — never a wall of text
2. DIALOGUE ANCHORED to physical action every single time — no floating quotes
3. HUMOR through situation and surprise — never through explanation
4. RHYTHM: Short. Short. One long sentence with a surprising detail at the end.
5. CONCRETE sensory detail in every paragraph (smell, texture, temperature, sound)
6. EACH character recognizable by sentence length and word choice alone — no name tag needed
7. INNER MOMENTS shown through body sensations only — never emotion labels like "she felt scared"
8. SUBTEXT: What characters SAY is not always what they MEAN. Hands, gaze, pace reveal the truth.
9. HUMOR VARIETY: Word inventions, exaggerations, misunderstandings, character contradictions.`;
}

function buildAntiPatternBlock(_isGerman: boolean): string {
  // Always English — models trained on English respond better to English instructions
  return `# CRITICAL FAILURES TO AVOID (these will get the story rejected)

🚫 IN-MEDIAS-RES OPENING (WORST FAILURE FOR CHILDREN):
Starting Chapter 1 mid-action without introducing anyone or explaining the mission.
"Der königliche Garten lag still im Mondlicht, als Ritter Rostfrei über den Kiesweg stapfte." → A child has NO IDEA who this is, where we are, or what's happening.
Fix: Start Ch1 with WHO + WHERE + MISSION. Then begin the action in Ch2.

🚫 TEXT WALL:
One giant paragraph per chapter. → Fix: 4-6 paragraphs per chapter, blank line between each.

🚫 REPORT STYLE:
"He went. She said. He nodded. She ran." → Fix: Group 2-4 sentences into flowing paragraphs.

🚫 EMOTION LABELS:
"He was nervous" / "She felt brave" → Fix: "His fingers dug into his jacket." / "Her chin went up."

🚫 PROMPT COPYING:
Pasting the Goal/Conflict/Setting wording verbatim into the story. → Fix: Dramatize everything.

🚫 META-CHAPTER REFERENCES IN PROSE:
"their Chapter 1 goal" / "das Ziel aus Kapitel eins" → NEVER reference chapter numbers in prose. Fix: Name the actual thing: "the lost key", "the dying garden".`;
}

function buildGeminiFlashMicroExamplesBlock(isGerman: boolean): string {
  const targetLang = isGerman ? "German" : "English";
  return `# MICRO-EXAMPLES — STUDY THE STRUCTURE (your output language: ${targetLang})

EXAMPLE: Paragraph breathing + chapter cliffhanger ending:
The corridor was cold and smelled of old stone. Leni ran her fingers along the wall, counting the bricks.
"There." She stopped at a gap. "Someone pulled this one out."
Ben leaned in. The gap was small — too small for him. He looked at Leni.
She was already crawling through.
The stone slid back into place behind her with a soft, final click.

EXAMPLE: Stakes sentence (must appear end of Chapter 1):
"If we lose the feather before midnight," Nova said without looking up, "the garden never wakes again."
Ben's stomach did that tight pulling thing. He pressed his hands into his pockets and said nothing.

EXAMPLE: Lowpoint + physical body reaction (Chapter 3 or 4):
The map was ruined. Just brown pulp in Ben's fist.
He stared at it. His throat went dry. His legs felt suddenly too heavy to lift.
"It's okay," said Nova. But her voice came out wrong — too quiet, too careful.
It wasn't okay. They both knew it.
Then Flitz squeaked something. Ben looked up.

EXAMPLE: Small tangible price (Chapter 5 ending):
The garden bloomed again, all at once, like someone had turned a switch.
Nova exhaled. She looked at her hands — the left glove was torn open at the thumb, the fabric black with soot.
She folded it over and didn't say anything about it. Some things cost what they cost.`;
}

// ═══════════════════════════════════════════════════════════════════════════
// V7 STORY BLUEPRINT PROMPT — Separates PLANNING from WRITING
// ═══════════════════════════════════════════════════════════════════════════
// The blueprint is generated in a fast, cheap LLM call BEFORE chapter writing.
// It plans the emotional arc, character wants/fears, and the mistake-and-growth
// trajectory so the writer prompt can focus purely on PROSE QUALITY.

export function buildStoryBlueprintPrompt(input: {
  directives: SceneDirective[];
  cast: CastSet;
  dna: TaleDNA | StoryDNA;
  language: string;
  ageRange: { min: number; max: number };
  tone?: string;
}): string {
  const { directives, cast, dna, language, ageRange } = input;
  const isGerman = language === "de";
  const targetTone = input.tone ?? dna.toneBounds?.targetTone ?? "warm";
  const artifactName = cast.artifact?.name?.trim();
  const artifactRule = cast.artifact?.storyUseRule || "";

  // Collect character names and compact profiles
  const allSlots = new Set(directives.flatMap(d => d.charactersOnStage));
  const characterLines: string[] = [];
  for (const slot of allSlots) {
    if (slot.includes("ARTIFACT")) continue;
    const sheet = findCharacterBySlot(cast, slot);
    if (!sheet) continue;
    const role = getPromptRoleLabel(sheet as CharacterSheet, isGerman);
    const dominant = (sheet as CharacterSheet).enhancedPersonality?.dominant
      || (sheet as CharacterSheet).personalityTags?.[0]
      || "curious";
    const speech = (sheet as CharacterSheet).speechStyleHints?.[0] || "normal";
    const quirk = (sheet as CharacterSheet).enhancedPersonality?.quirk || "";
    const rolePart = role ? ` (${role})` : "";
    const quirkPart = quirk ? ` | Quirk: ${quirk}` : "";
    characterLines.push(`- ${sheet.displayName}${rolePart}: ${dominant}; Voice: ${speech}${quirkPart}`);
  }
  const childFocusNames = getChildFocusNames(cast);
  const childFocusBlock = childFocusNames.length > 0
    ? `\n::: CHILD STORY FOCUS :::\n- The emotional arc, mistake, shame, courage, and repair must belong primarily to ${childFocusNames.join(" and ")}.\n- If adults or mentors are present, they may help, but they must not own the child's growth moment.\n`
    : "";

  // Compress directives into seed hints
  const seedHints = directives.map((d, idx) => {
    const setting = trimDirectiveText(sanitizeDirectiveNarrativeText(d.setting), 50);
    const goal = trimDirectiveText(sanitizeDirectiveNarrativeText(d.goal), 80);
    const conflict = idx === 0 ? "[NONE — orientation only]" : trimDirectiveText(sanitizeDirectiveNarrativeText(d.conflict), 80);
    return `Ch${idx + 1}: Setting: ${setting} | Goal: ${goal} | Conflict: ${conflict}`;
  }).join("\n");

  // Theme and conflict from DNA
  const themeTags = dna.themeTags?.slice(0, 4).join(", ") || "adventure";
  const coreConflict = dna.coreConflict || "overcoming a challenge through courage and friendship";

  const artifactBlock = artifactName
    ? `\nMAGICAL OBJECT\n- Name: ${artifactName}\n- Rule: ${artifactRule}\n- Plan only: wonder, temptation, price\n`
    : "";

  return `Create a story blueprint (emotional arc plan) for a children's story with 5 chapters.
Target age: ${ageRange.min}-${ageRange.max}. Tone: ${targetTone}. Output language: ${isGerman ? "German" : language}.

::: CHARACTERS :::
${characterLines.join("\n")}
${childFocusBlock}

::: STORY SEED :::
Theme: ${themeTags}
Core conflict: ${coreConflict}
${seedHints}
${artifactBlock}
::: CHAPTER BLUEPRINT :::

For each chapter, answer these questions concisely (1-2 sentences each):

CHAPTER 1 — THE INVITATION (orientation, NO conflict):
- where: Where are we? (1 concrete place cue; prefer sound, texture, or visible problem, not a smell opener)
- who: Who do we meet? (each character: 1 action cue or explicitly locked canon detail + 1 personality trait SHOWN in action)
- want: What does the child want? (the desire that drives the story)
- curiosityHook: Last moment — what makes the reader NEED to turn the page?
- foreground: Which 2 characters are in the foreground? (max 2, others react briefly)
- humorBeat: What is one funny or playful moment? (physical comedy, misunderstanding, or witty line)

CHAPTER 2 — THE WONDER (discovery + first complication):
- newElement: What exciting thing appears? (artifact, new place, new character)
- boldChoice: What small brave decision does the child make?
- complication: What doesn't go as planned?
- openQuestion: What question stays unanswered?
- foreground: Which 2 characters are most active? (others can react with 1 line)
- humorBeat: What makes the reader smile? (a quirky reaction, an unexpected detail)

CHAPTER 3 — THE MISTAKE (child's genuine error + consequence):
- mistake: What does the child do wrong? (MUST be an active choice, NOT bad luck)
- mistakeReason: WHY do they make this mistake? (impatience? pride? fear? — rooted in their CHARACTER TRAIT)
- consequence: What CONCRETE thing breaks, is lost, or goes wrong because of it?
- bodyReaction: How does the child's body react? (stomach drops, throat tightens, hands shake — be specific)
- stuckFeeling: Why does everything feel hopeless now? (1 sentence of inner doubt)
- foreground: Which 2 characters carry this scene?

CHAPTER 4 — DARKEST MOMENT + TURNING POINT:
- worstMoment: What is the WORST situation? (concrete, not abstract)
- almostGivingUp: What does the child SAY or THINK that shows they want to give up? (direct thought/dialogue)
- insightTrigger: What small detail triggers the insight? (a memory, a friend's earlier words, a pattern noticed)
- newChoice: What does the child decide — DIFFERENTLY than in Ch3?
- foreground: Which 2 characters are central?

CHAPTER 5 — THE LANDING (resolution + warmth):
- concreteWin: What EXACTLY was won? (tangible object/result, not "they learned")
- smallPrice: What small TANGIBLE thing was lost? (torn glove, scratched knee, tired legs — NOT abstract)
- ch1Callback: How does this echo Chapter 1? (same place/object/phrase, but the child has changed)
- finalImage: Final warm image (physical, specific — NOT a moral statement, NOT "and they lived happily")
- humorBeat: One last smile (a funny callback, a light moment of relief)

::: EMOTIONAL ARC :::
Write one sentence per chapter describing how the child FEELS:
1. Comfort → Curiosity (warm, safe start)
2. Curiosity → Excitement → First Doubt (the world expands)
3. Confidence → Overreach → "Oh no, what have I done?" (the child's own fault)
4. Stuck → Almost Giving Up → One Spark of Courage (darkest, then light from within)
5. Courage → Effort → Success → Quiet Warmth (earned, not given)

::: CHARACTER INNER LIFE :::
For each character, define:
- WANT: What do they desire in this specific story?
- FEAR: What are they avoiding or afraid of?

::: DIALOGUE PLAN :::
- Across the whole story, aim for 25-40% dialogue. EVERY chapter needs at least 4-5 spoken lines. Quiet orientation and low-point passages may use slightly less if clarity improves.
- Every dialogue line = 1 physical action + 1 spoken line. Never floating quotes.
- Characters must sound DIFFERENT: vary sentence length, vocabulary, and energy level.

::: OUTPUT FORMAT :::
Return JSON only:
{
  "blueprint": {
    "chapter1": { "where": "...", "who": "...", "want": "...", "curiosityHook": "...", "foreground": "...", "humorBeat": "..." },
    "chapter2": { "newElement": "...", "boldChoice": "...", "complication": "...", "openQuestion": "...", "foreground": "...", "humorBeat": "..." },
    "chapter3": { "mistake": "...", "mistakeReason": "...", "consequence": "...", "bodyReaction": "...", "stuckFeeling": "...", "foreground": "..." },
    "chapter4": { "worstMoment": "...", "almostGivingUp": "...", "insightTrigger": "...", "newChoice": "...", "foreground": "..." },
    "chapter5": { "concreteWin": "...", "smallPrice": "...", "ch1Callback": "...", "finalImage": "...", "humorBeat": "..." }
  },
  "emotionalArc": ["...", "...", "...", "...", "..."],
  "characterWants": { "Name1": "...", "Name2": "..." },
  "characterFears": { "Name1": "...", "Name2": "..." }${artifactName ? `,
  "artifactArc": { "wonder": "...", "temptation": "...", "price": "..." }` : ""}
}
Keep each field to 1-2 sentences. Total output under 800 words.`;
}

/**
 * V7 Blueprint System Prompt — used for the blueprint planning call.
 */
export function buildBlueprintSystemPrompt(language: string): string {
  const isGerman = language === "de";
  return isGerman
    ? `Du bist ein erfahrener Kinderbuch-Dramaturg. Du planst Geschichten mit klaren emotionalen Bögen, nachvollziehbaren Kinderfiguren und einer echten Fehler-und-Wachstums-Reise. Deine Pläne sind konkret und kinderfreundlich, nie abstrakt oder belehrend. Antworte immer als JSON.`
    : `You are an experienced children's book dramaturg. You plan stories with clear emotional arcs, relatable child characters, and a genuine mistake-and-growth journey. Your plans are concrete and child-friendly, never abstract or preachy. Always respond as JSON.`;
}

// ═══════════════════════════════════════════════════════════════════════════
// V7 BLUEPRINT-DRIVEN STORY WRITER PROMPT
// ═══════════════════════════════════════════════════════════════════════════
// Dramatically simplified compared to V6. The blueprint handles all planning,
// so this prompt focuses purely on PROSE QUALITY. ~60 lines instead of ~180.

export function buildLeanBlueprintDrivenStoryPrompt(input: {
  blueprint: StoryBlueprint;
  cast: CastSet;
  directives: SceneDirective[];
  language: string;
  ageRange: { min: number; max: number };
  totalWordMin: number;
  totalWordMax: number;
  wordsPerChapter: { min: number; max: number };
  humorLevel?: number;
  stylePackText?: string;
  userPrompt?: string;
  avatarMemories?: Map<string, AvatarMemoryCompressed[]>;
}): string {
  const { blueprint, cast, directives, language, ageRange, totalWordMin, totalWordMax, wordsPerChapter } = input;
  const isGerman = language === "de";
  const outputLang = isGerman ? "German" : language;
  const umlautRule = isGerman ? " Use proper German umlauts (ä, ö, ü, ß). No English words." : "";

  const allSlots = new Set(directives.flatMap(d => d.charactersOnStage));
  const allowedNames: string[] = [];
  const characterLines: string[] = [];
  const promptSheets: CharacterSheet[] = [];
  for (const slot of allSlots) {
    if (slot.includes("ARTIFACT")) continue;
    const sheet = findCharacterBySlot(cast, slot);
    if (!sheet) continue;
    if (!allowedNames.includes(sheet.displayName)) allowedNames.push(sheet.displayName);
    const cs = sheet as CharacterSheet;
    promptSheets.push(cs);
    const role = getPromptRoleLabel(cs, isGerman);
    const rolePart = role ? ` (${role})` : "";
    const speech = cs.speechStyleHints?.[0] || "normal";
    const quirk = cs.enhancedPersonality?.quirk ? ` Quirk: ${cs.enhancedPersonality.quirk}.` : "";
    characterLines.push(`- ${cs.displayName}${rolePart}: Voice: ${speech}.${quirk}`);
  }

  const focusChildSheets = getChildFocusSheets(cast);
  const focusChildNames = focusChildSheets.map(sheet => sheet.displayName).filter(Boolean);
  const childVoiceContract = buildFocusedChildVoiceContract(focusChildSheets as CharacterSheet[], isGerman);
  const appearanceLockBlock = buildAppearanceLockBlock(promptSheets, isGerman);
  const chapterBeatLines = [
    `- Kapitel 1 – EIN NORMALER TAG, DER SCHIEF GEHT: ${blueprint.chapter1.where}. ${blueprint.chapter1.want}.${blueprint.chapter1.stakes ? ` Wenn sie scheitern: ${blueprint.chapter1.stakes}.` : ""} Neugier-Haken: ${blueprint.chapter1.curiosityHook}`,
    `- Kapitel 2 – DIE ENTDECKUNG: ${blueprint.chapter2.newElement}. Mutige Entscheidung: ${blueprint.chapter2.boldChoice}. Was schiefgeht: ${blueprint.chapter2.complication}`,
    `- Kapitel 3 – DER MOMENT WO ALLES KIPPT: Das Kind macht einen Fehler: ${blueprint.chapter3.mistake}. Warum: ${blueprint.chapter3.mistakeReason}. Was danach anders ist: ${blueprint.chapter3.consequence}`,
    `- Kapitel 4 – DUNKELSTER MOMENT + WENDEPUNKT: ${blueprint.chapter4.worstMoment}. Was den Funken zuendet: ${blueprint.chapter4.insightTrigger}. Neue Entscheidung: ${blueprint.chapter4.newChoice}`,
    `- Kapitel 5 – DIE LANDUNG: Gewonnen: ${blueprint.chapter5.concreteWin}. Kleiner Preis: ${blueprint.chapter5.smallPrice}. Schlussbild: ${blueprint.chapter5.finalImage}`,
  ].map(line => sanitizePromptBlock(line, 400) || line);
  const emotionalArcLines = blueprint.emotionalArc
    .map((beat, idx) => `- Ch${idx + 1}: ${beat}`)
    .join("\n");
  const artifactName = cast.artifact?.name?.trim();
  const humorTarget = Math.max(0, Math.min(3, Number.isFinite(input.humorLevel as number) ? Number(input.humorLevel) : 2));
  const humorRule = humorTarget >= 3
    ? "Place at least 3 genuine smile moments across the story."
    : humorTarget >= 2
      ? "Place 2 genuine smile moments across the story."
      : humorTarget >= 1
        ? "Place 1 light smile moment."
        : "";
  const stylePackBlock = trimPromptLines(sanitizeStylePackBlock(input.stylePackText, isGerman), 4);
  const customPromptBlock = trimPromptLines(formatCustomPromptBlock(input.userPrompt, isGerman), 5);

  let memoryLine = "";
  if (input.avatarMemories && input.avatarMemories.size > 0) {
    for (const avatar of cast.avatars) {
      const memories = input.avatarMemories.get(avatar.characterId);
      if (!memories || memories.length === 0) continue;
      const topTitle = String(memories[0]?.storyTitle || "").trim();
      if (topTitle) {
        memoryLine = `- One avatar may reference an earlier adventure ONCE: "${topTitle}"`;
        break;
      }
    }
  }

  return `Write a 5-chapter children's story in ${outputLang}.${umlautRule}
Use the blueprint as guidance, but tell a natural story. Never copy blueprint wording literally.

CHARACTERS
${characterLines.join("\n")}
${childVoiceContract ? `\nVOICE CONTRACT\n${childVoiceContract}` : ""}
${appearanceLockBlock ? `\nAPPEARANCE LOCKS\n${appearanceLockBlock}` : ""}

STORY BEATS
${chapterBeatLines.join("\n")}

EMOTIONAL ARC
${emotionalArcLines}

FOCUS
- The emotional POV belongs mainly to ${focusChildNames.join(", ") || allowedNames.slice(0, 2).join(", ")}.
- Adults or magical helpers may support, but they must not solve the inner problem for the child.
${artifactName ? `- Artefakt "${artifactName}": Darf Probleme ZEIGEN, Hinweise geben, Staunen ausloesen — aber NIE das Problem allein loesen. Die Loesung kommt IMMER von einer Entscheidung der Figuren. Max 1 Kapitel mit Artefakt im Mittelpunkt.` : ""}
${memoryLine ? memoryLine : ""}

IKONISCHE SZENE (Pflicht):
- Jede Geschichte braucht mindestens 1 Szene die ein Kind NACHSPIELEN wuerde.
- Ein Moment den man SEHEN kann. Ein Satz den ein Kind NACHSPRECHEN wuerde. Eine KOERPERLICHE Handlung.
${stylePackBlock ? `\nSTYLE\n${stylePackBlock}` : ""}
${customPromptBlock ? `\nUSER REQUIREMENTS\n${customPromptBlock}` : ""}

NON-NEGOTIABLES

PROSA-HANDWERK:
1. RHYTHMUS IST PFLICHT: Kurz. Kurz. Ein laengerer mit Ueberraschung. Kurz. NIEMALS: Mittel. Mittel. Mittel. Mittel. 30% aller Saetze muessen UNTER 6 Woerter haben.
2. KEINE BERICHTSPROSA: "Er ging. Sie sagte. Er nickte." ist VERBOTEN. Saetze muessen atmen, ueberraschen, einen Rhythmus haben.
3. KOERPER STATT ETIKETTEN: VERBOTEN: "Er war nervoes / aufgeregt / traurig". STATTDESSEN: "Seine Finger krallten sich in den Stoff." / "Sein Bauch machte eine Rolle."
4. DIALOG = SUBTEXT: Kinder sagen selten genau was sie meinen. "Mir egal" + Haende in Taschen = NICHT egal. "Ich hab keine Angst" + zu schnell = sie HABEN Angst.

FIGUREN-HANDWERK:
5. JEDE Figur ist WIDERSPRUCHLICH: Der Vorsichtige ueberreagiert 1x. Der Mutige hat 1x Recht mit Bauchgefuehl. Der Kluge macht 1 dummen Fehler.
6. NEBENFIGUREN MUESSEN HANDELN: Wenn eine Figur in 2+ Kapiteln nur "nickte" und "rief", braucht sie eine EIGENE kleine Entscheidung.
7. Max 2 Figuren im Vordergrund pro Kapitel. 1 Nebenfigur darf kurz reagieren.

PLOT-HANDWERK:
8. KEIN ARTEFAKT-DEUS-EX-MACHINA: Das Problem wird durch eine FIGUREN-ENTSCHEIDUNG geloest, nie durch Artefakt-Magie allein. Das Artefakt darf Probleme ZEIGEN aber nicht LOESEN. Max 1 von 5 Kapiteln darf das Artefakt im Mittelpunkt haben.
9. ANTI-FORMEL: Wenn der Leser vorhersagen kann was passiert, ist die Szene zu formelhaft. Mindestens 1 UEBERRASCHENDER Moment pro Kapitel.
10. MORAL WIRD NIE AUSGESPROCHEN: Keine Figur sagt die Lektion laut. Keine Sprueche. Keine Reime mit Moral. Die Lektion ZEIGT sich durch das was passiert.
11. ENDEN MUESSEN LANDEN: Kein abruptes "sie rannten raus, fertig." Das Ende braucht: 1 ruhigen Moment + 1 physisches Detail + 1 Satz der nachhallt.

STRUKTUR:
12. Chapter 1: Soft Launch. Absatz 1 verankert das Kind an vertrautem Ort durch Handlung/Stimme. Absatz 2 nennt Mission + konkretes Risiko. Nach Absatz 2 muss WER, WO, WAS, WARUM klar sein.
13. Chapters 2-5 beginnen mit Anknuepfung an das Ende des vorherigen Kapitels.
14. Chapter 3: Fehler des Kindes mit konkreter Konsequenz. KEIN Pech. Der Fehler kommt aus dem Charakter.
15. Chapter 4: Tiefpunkt + innerer Wendepunkt.
16. Chapter 5: Loest dieselbe Mission wie Kapitel 1. Konkreter Gewinn + kleiner Preis + warmes Schlussbild.
17. 4-5 Absaetze pro Kapitel, je 2-4 Saetze. Leerzeile zwischen Absaetzen.
18. Nur Aussehen erwaehnen das oben explizit gelockt ist. Keine Brillen, Muetzen, Schals erfinden.
19. No report prose, no moral summary, no new names.
20. Word target: total ${totalWordMin}-${totalWordMax}; per chapter ${wordsPerChapter.min}-${wordsPerChapter.max}. If short, add one more concrete beat or dialogue exchange.
${humorRule ? `21. HUMOR: ${humorRule} Nutze Koerperkomik, Wort-Erfindungen, Missverstaendnisse oder Kontrast-Komik.` : ""}

OUTPUT
{
  "title": "Short curiosity-driven title (max 6 words)",
  "description": "One teaser sentence with a question hook",
  "chapters": [
    { "chapter": 1, "paragraphs": ["Paragraph 1.", "Paragraph 2.", "Paragraph 3.", "Paragraph 4."] }
  ]
}
"paragraphs" MUST be a JSON array of 4-5 strings. Each string = one paragraph. NEVER put the whole chapter in one string.`;
}

export function buildLeanStoryBlueprintPrompt(input: {
  directives: SceneDirective[];
  cast: CastSet;
  dna: TaleDNA | StoryDNA;
  language: string;
  ageRange: { min: number; max: number };
  tone?: string;
}): string {
  const { directives, cast, dna, language, ageRange } = input;
  const isGerman = language === "de";
  const targetTone = input.tone ?? dna.toneBounds?.targetTone ?? "warm";
  const artifactName = cast.artifact?.name?.trim();
  const artifactRule = cast.artifact?.storyUseRule || "";
  const allSlots = new Set(directives.flatMap(d => d.charactersOnStage));
  const characterLines: string[] = [];
  const promptSheets: CharacterSheet[] = [];
  for (const slot of allSlots) {
    if (slot.includes("ARTIFACT")) continue;
    const sheet = findCharacterBySlot(cast, slot);
    if (!sheet) continue;
    promptSheets.push(sheet as CharacterSheet);
    const role = getPromptRoleLabel(sheet as CharacterSheet, isGerman);
    const dominant = (sheet as CharacterSheet).enhancedPersonality?.dominant
      || (sheet as CharacterSheet).personalityTags?.[0]
      || "curious";
    const speech = (sheet as CharacterSheet).speechStyleHints?.[0] || "normal";
    const rolePart = role ? ` (${role})` : "";
    characterLines.push(`- ${sheet.displayName}${rolePart}: ${dominant}; Voice: ${speech}`);
  }
  const childFocusNames = getChildFocusNames(cast);
  const appearanceLockBlock = buildAppearanceLockBlock(promptSheets, isGerman);
  const childFocusBlock = childFocusNames.length > 0
    ? `- The child's emotional arc belongs mainly to ${childFocusNames.join(" and ")}.`
    : "";
  const seedHints = directives.map((d, idx) => {
    const setting = trimDirectiveText(sanitizeDirectiveNarrativeText(d.setting), 42);
    const goal = trimDirectiveText(sanitizeDirectiveNarrativeText(d.goal), 60);
    const conflict = idx === 0 ? "orientation only" : trimDirectiveText(sanitizeDirectiveNarrativeText(d.conflict), 60);
    return `- Ch${idx + 1}: ${setting} | Goal: ${goal} | Conflict: ${conflict}`;
  }).join("\n");
  const themeTags = dna.themeTags?.slice(0, 4).join(", ") || "adventure";
  const coreConflict = dna.coreConflict || "overcoming a challenge through courage and friendship";
  const artifactBlock = artifactName
    ? `\nMAGICAL OBJECT\n- Name: ${artifactName}\n- Rule: ${artifactRule}\n- Plan: wonder, temptation, price`
    : "";

  return `Create a SHORT story blueprint for a 5-chapter children's story.
Target age: ${ageRange.min}-${ageRange.max}. Tone: ${targetTone}. Output language: ${isGerman ? "German" : language}.

CHARACTERS
${characterLines.join("\n")}
${childFocusBlock}
${appearanceLockBlock ? `\nAPPEARANCE LOCKS\n${appearanceLockBlock}` : ""}

STORY SEED
- Theme: ${themeTags}
- Core conflict: ${coreConflict}
${seedHints}
${artifactBlock}

RULES
- Concrete, child-readable, no abstract morals.
- Keep every field short. Prefer one sentence.
- Chapter 1 uses a soft launch for ages 6-8: familiar place + child behavior first, mission + concrete risk by paragraph 2, oddity or trouble by paragraph 3.
- Chapter 1 must name the concrete risk if the child fails.
- Chapter 3 mistake comes from the child's trait, not bad luck.
- Chapter 4 turning point comes from inside the child.
- Chapter 5 shows concrete win + small price + callback to chapter 1.
- Max 2 foreground characters per chapter.
- No smell-led opener and no invented accessories. Appearance details only if explicitly locked.

RETURN JSON ONLY:
{
  "blueprint": {
    "chapter1": { "where": "...", "who": "...", "want": "...", "stakes": "...", "curiosityHook": "...", "foreground": "...", "humorBeat": "..." },
    "chapter2": { "newElement": "...", "boldChoice": "...", "complication": "...", "openQuestion": "...", "foreground": "...", "humorBeat": "..." },
    "chapter3": { "mistake": "...", "mistakeReason": "...", "consequence": "...", "bodyReaction": "...", "stuckFeeling": "...", "foreground": "..." },
    "chapter4": { "worstMoment": "...", "almostGivingUp": "...", "insightTrigger": "...", "newChoice": "...", "foreground": "..." },
    "chapter5": { "concreteWin": "...", "smallPrice": "...", "ch1Callback": "...", "finalImage": "...", "foreground": "...", "humorBeat": "..." }
  },
  "emotionalArc": ["...", "...", "...", "...", "..."],
  "characterWants": { "Name1": "...", "Name2": "..." },
  "characterFears": { "Name1": "...", "Name2": "..." }${artifactName ? `,
  "artifactArc": { "wonder": "...", "temptation": "...", "price": "..." }` : ""}
}
Total output under 500 words.`;
}

export function buildReleaseV7SystemPrompt(language: string, ageRange: { min: number; max: number }): string {
  // Use the FULL V7 system prompt — it contains the complete craft rules
  // (humor taxonomy, dialogue depth, character truth, rhythm enforcement)
  // that the lean release prompt was missing.
  return buildV7SystemPrompt(language, ageRange);
}

export function buildBlueprintDrivenStoryPrompt(input: {
  blueprint: StoryBlueprint;
  cast: CastSet;
  directives: SceneDirective[];
  language: string;
  ageRange: { min: number; max: number };
  totalWordMin: number;
  totalWordMax: number;
  wordsPerChapter: { min: number; max: number };
  humorLevel?: number;
  stylePackText?: string;
  userPrompt?: string;
  avatarMemories?: Map<string, AvatarMemoryCompressed[]>;
}): string {
  const { blueprint, cast, directives, language, ageRange, totalWordMin, totalWordMax, wordsPerChapter } = input;
  const isGerman = language === "de";
  const outputLang = isGerman ? "German" : language;
  const umlautRule = isGerman ? " Use proper German umlauts (ä, ö, ü, ß). No English words." : "";

  // Build compact character profiles — name + detail + speech example only
  const allSlots = new Set(directives.flatMap(d => d.charactersOnStage));
  const characterLines: string[] = [];
  const allowedNames: string[] = [];
  for (const slot of allSlots) {
    if (slot.includes("ARTIFACT")) continue;
    const sheet = findCharacterBySlot(cast, slot);
    if (!sheet) continue;
    if (!allowedNames.includes(sheet.displayName)) allowedNames.push(sheet.displayName);
    const cs = sheet as CharacterSheet;
    const role = getPromptRoleLabel(cs, isGerman);
    const rolePart = role ? ` (${role})` : "";
    const speech = cs.speechStyleHints?.[0] || "normal";
    const speechEx = generateSpeechExample(cs.displayName, speech, cs.enhancedPersonality?.catchphrase || "", isGerman);
    characterLines.push(`- ${cs.displayName}${rolePart}: Voice: ${speech}. ${speechEx}`);
  }

  // Child voice contract
  const focusChildSheets = getChildFocusSheets(cast);
  const focusChildNames = focusChildSheets.map(sheet => sheet.displayName).filter(Boolean);
  const childVoiceContract = buildFocusedChildVoiceContract(focusChildSheets as CharacterSheet[], isGerman);
  const chapterFocusFallback = (chapterNumber: number): string => {
    const directive = directives.find(item => item.chapter === chapterNumber);
    if (!directive) return "tight pair";
    return getCoreChapterCharacterNames({ directive, cast, ageMax: ageRange.max }).join(", ") || "tight pair";
  };
  const chapterFocusBlock = [
    `- Chapter 1 foreground: ${(blueprint.chapter1 as any).foreground || chapterFocusFallback(1)}`,
    `- Chapter 2 foreground: ${(blueprint.chapter2 as any).foreground || chapterFocusFallback(2)}`,
    `- Chapter 3 foreground: ${(blueprint.chapter3 as any).foreground || chapterFocusFallback(3)}`,
    `- Chapter 4 foreground: ${(blueprint.chapter4 as any).foreground || chapterFocusFallback(4)}`,
    `- Chapter 5 foreground: ${(blueprint.chapter5 as any).foreground || chapterFocusFallback(5)}`,
  ].join("\n");

  // Artifact
  const artifactName = cast.artifact?.name?.trim();

  // Humor
  const humorTarget = Math.max(0, Math.min(3, Number.isFinite(input.humorLevel as number) ? Number(input.humorLevel) : 2));
  const humorRule = humorTarget >= 3
    ? "Humor: HIGH — 3+ laugh moments (slapstick, misunderstanding, witty comeback)."
    : humorTarget >= 2
      ? "Humor: MEDIUM — 2+ laugh moments suitable for children."
      : humorTarget >= 1
        ? "Humor: LIGHT — one smile moment."
        : "";

  // Style pack & custom prompt
  const stylePackBlock = trimPromptLines(sanitizeStylePackBlock(input.stylePackText, isGerman), 8);
  const customPromptBlock = trimPromptLines(formatCustomPromptBlock(input.userPrompt, isGerman), 8);

  // Memory reference
  let memoryLine = "";
  if (input.avatarMemories && input.avatarMemories.size > 0) {
    for (const avatar of cast.avatars) {
      const memories = input.avatarMemories.get(avatar.characterId);
      if (!memories || memories.length === 0) continue;
      const topTitle = String(memories[0]?.storyTitle || "").trim();
      if (topTitle) {
        memoryLine = `- One avatar may reference an earlier adventure ONCE ("That reminds me of..."): "${topTitle}"`;
        break;
      }
    }
  }

  // Age rules
  const ageMax = ageRange.max;
  const ageRule = ageMax <= 6
    ? `Sentences: max 8 words. Simple vocabulary. Lots of repetition.`
    : ageMax <= 8
      ? `Sentences: max 12 words on average. Everyday language. No jargon, no complex metaphors. Every paragraph must be clear when read aloud.`
      : `Medium sentences allowed. Richer vocabulary possible. Balance complex with short punchy sentences.`;

  // Safety
  const safetyRule = "No violence, weapons, blood, horror, bullying, politics/religion, drugs/alcohol.";

  return `Write a 5-chapter children's story in ${outputLang}.${umlautRule}
Use the BLUEPRINT below as your guide — but NEVER copy it word-for-word. Tell the story, don't report the plan.

::: BLUEPRINT (your emotional roadmap — dramatize, don't copy) :::
${JSON.stringify(blueprint, null, 2)}

::: CHARACTERS :::
${characterLines.join("\n")}
${childVoiceContract ? `\n${childVoiceContract}` : ""}

::: STORY FOCUS :::
- The emotional POV and mistake-growth arc belong primarily to ${focusChildNames.join(", ") || allowedNames.slice(0, 2).join(", ")}.
- Adults, mentors, or magical helpers may support, but they must not solve the inner problem for the child.
- Keep chapter focus narrow:
${chapterFocusBlock}

${artifactName ? `::: ARTEFAKT :::\n- "${artifactName}": Darf Probleme ZEIGEN, Hinweise geben, Staunen ausloesen — aber NIE das Problem allein loesen. Die Loesung kommt IMMER von einer Entscheidung der Figuren. Max 1 Kapitel mit Artefakt im Mittelpunkt.\n` : ""}
${memoryLine ? `${memoryLine}\n` : ""}
::: IKONISCHE SZENE (Pflicht) :::
- Mindestens 1 Szene die ein Kind NACHSPIELEN wuerde: visuell stark, mit einem Satz den man NACHSPRECHEN wuerde, und einer KOERPERLICHEN Handlung.

${stylePackBlock ? `::: STYLE :::\n${stylePackBlock}\n` : ""}
${customPromptBlock ? `::: USER REQUEST :::\n${customPromptBlock}\n` : ""}

::: WHAT GREAT PROSE SOUNDS LIKE :::

GOOD (notice: short sentences, body, humor, dialogue = 40%):
Mama knallte den Korb auf den Tisch. Peng.
"Darf ich–" "Nein", sagte Mama. Schnell wie ein Krokodilmaul.
Mira beugte sich vor. "Da dampft was." "Und es klappert", sagte Timo.
Er tippte gegen den Korb. "Und... das macht Ärger."
Oma kicherte und schob ihm ein Stück Kuchen über den Tisch. "Probier mal." Timo stopfte sich das halbe Stück in den Mund. Krümel flogen. "Mmphf", machte er und grinste breit.

BAD (report-style, no body, no humor, floating dialogue):
Mira und Timo kamen bei Oma an. Sie waren aufgeregt. "Das ist gut", sagte einer von ihnen. Oma lächelte. Sie gab ihnen Kuchen. Alle waren glücklich.

→ Every paragraph needs RHYTHM (short-short-long), BODY (what hands/feet/face do), and DIALOGUE anchored to a physical action. Humor should appear across the story, but not every paragraph needs a joke.

::: RULES :::

PROSA-HANDWERK:
1. RHYTHMUS: Kurz. Kurz. Ein laengerer mit Ueberraschung. Kurz. NIEMALS: Mittel. Mittel. Mittel. 30% der Saetze UNTER 6 Woerter.
2. KEINE BERICHTSPROSA: "Er ging. Sie sagte. Er nickte." ist VERBOTEN. Saetze muessen atmen und ueberraschen.
3. KOERPER STATT ETIKETTEN: Nie "Er war nervoes" → "Seine Finger krallten sich in den Stoff."
4. DIALOG = SUBTEXT: "Mir egal" + Haende in Taschen = NICHT egal. Kinder reden DRUMHERUM bei Scham oder Angst.
5. DIALOG-ANTEIL: 25-40% Dialog. JEDES Kapitel mindestens 4-5 gesprochene Zeilen. Jede Zeile mit koerperlicher Handlung. KEINE schwebenden Zitate.

FIGUREN-HANDWERK:
6. JEDE Figur klingt ANDERS: Einer spricht in 2-5-Wort-Fetzen, einer in ruhigen Saetzen, einer unterbricht.
7. FIGUREN SIND WIDERSPRUCHLICH: Der Vorsichtige ueberreagiert 1x. Der Mutige zeigt 1x Sensibilitaet.
8. NEBENFIGUREN: Wenn eine Figur in 2+ Kapiteln nur "nickte" → sie braucht eine EIGENE kleine Entscheidung.
9. Max 2 characters FOREGROUND per chapter. 1 may react with a single line.

PLOT-HANDWERK:
10. KEIN ARTEFAKT-DEUS-EX-MACHINA: Loesung kommt IMMER von Figuren-Entscheidung. Artefakt darf ZEIGEN aber nicht LOESEN. Max 1 von 5 Kapiteln mit Artefakt im Mittelpunkt.
11. ANTI-FORMEL: Mindestens 1 ueberraschender Moment pro Kapitel. Wenn vorhersehbar → zu formelhaft.
12. MORAL WIRD NIE AUSGESPROCHEN: Keine Sprueche, keine Reime mit Moral. Die Lektion zeigt sich durch Handlung.
13. ENDEN LANDEN: Kein abruptes Ende. Ruhiger Moment + physisches Detail + 1 Satz der nachhallt.
14. Chapters 1-4 end with cliffhanger — reader MUST want to turn the page.

STRUKTUR:
15. 4-6 paragraphs per chapter. Each: 2-4 sentences. Blank line between paragraphs.
16. Chapter 1: Soft launch. Absatz 1 verankert Kind an vertrautem Ort. Absatz 2: Mission + Risiko. Nach Absatz 2: WER, WO, WAS, WARUM klar.
17. Chapters 2-5 open by connecting to previous chapter's ending.
18. Chapter 3: child-caused mistake from character trait. Not bad luck.
19. Chapter 5: resolves SAME mission as Ch1. Concrete win + small price + warm final image.
20. ${ageRule}
21. ${safetyRule}
22. HUMOR: 2-3 Smile-Momente ueber die Story. Koerperkomik, Wort-Erfindungen, Missverstaendnisse, Kontrast-Komik. Kapitel 4 darf ernster sein.
${humorRule ? `23. ${humorRule}` : ""}

::: WORD TARGET (HARD MINIMUM) :::
Total: ${totalWordMin}-${totalWordMax} words. Per chapter: ${wordsPerChapter.min}-${wordsPerChapter.max} words.
IMPORTANT: Each chapter MUST reach at least ${wordsPerChapter.min} words. Short chapters are the #1 quality failure. When in doubt, add one more dialogue exchange or action beat per paragraph.
Cast lock: only ${allowedNames.join(", ")}. No new names.

::: OUTPUT :::
{
  "title": "Short curiosity-driven title (max 6 words)",
  "description": "One teaser sentence with a question hook",
  "chapters": [
    { "chapter": 1, "paragraphs": ["Paragraph 1 (2-4 sentences).", "Paragraph 2.", "Paragraph 3.", "Paragraph 4."] }
  ]
}
"paragraphs" MUST be a JSON array of 4-6 strings. Each string = one paragraph. NEVER put the whole chapter in one string.`;
}

// ═══════════════════════════════════════════════════════════════════════════
// V7 SYSTEM PROMPT — used for chapter writing
// ═══════════════════════════════════════════════════════════════════════════

export function buildV7SystemPrompt(language: string, ageRange: { min: number; max: number }): string {
  const isGerman = language === "de";
  if (isGerman) {
    return `Du bist ein Elite-Kinderbuchautor (${ageRange.min}-${ageRange.max} Jahre). Stil: witzig wie "Bitte nicht oeffnen", lebendig wie "Mein Lotta-Leben", spannend wie "Schule der magischen Tiere".

RHYTHMUS: 30%+ Saetze UNTER 6 Woerter. Max 15% ueber 12. Muster: Kurz. Kurz. Mittel mit Detail. Kurz. VERBOTEN: Mittel. Mittel. Mittel. Keine Fremdwoerter.

HUMOR (1x pro Kapitel, Kap.4 darf ernster sein): Koerperkomik, Wort-Erfindung ("Schnarchwolf"), Missverstaendnis, Kontrast-Komik, Running Gag (2-3x absurder).

DIALOG (25-40%, mind. 4-5 Zeilen pro Kapitel):
- Dialog = Werkzeug Nr.1 fuer Charakter+Humor+Spannung. Keine leeren "Ja"/"Okay".
- Subtext: "Mir egal" + Haende in Taschen = NICHT egal. Kinder reden drumherum bei Scham/Angst.
- Jede Zeile an Koerper-Aktion gebunden: "Komm!", rief sie und zerrte am Aermel. NICHT: "Komm!", sagte sie.

FIGUREN: KEIN Kind ist immer klug/impulsiv. Das Vorsichtige muss 1x falsch liegen, das Mutige 1x sensibel sein. Max 2 Figuren im Vordergrund pro Kapitel. Jede Buehnen-Figur spricht oder handelt 1x.

REGELN:
1. Gefuehle durch KOERPER zeigen, nie Etiketten. VERBOTEN: "Er war nervoes." STATTDESSEN: "Sein Bauch machte eine Rolle."
2. Jede Figur klingt ANDERS — erkennbar ohne Namen. Einer: 2-5-Wort-Fetzen, einer: Detail-Saetze, einer: unterbricht.
3. Absaetze: 2-4 Saetze. JEDES Kapitel = JSON-Array von 4-6 Absatz-Strings.
4. Geschichte, kein Bericht. Keine Listen, keine Protokoll-Sprache.
5. Moral NIE aussprechen. Lektion zeigt sich durch Handlung.
6. ANTI-FORMEL: 1 ueberraschender Moment pro Kapitel.

Schreibe ausschliesslich auf Deutsch. Korrekte Umlaute (ae, oe, ue, ss). Keine englischen Woerter.`;
  }
  return `You are an elite children's book author (ages ${ageRange.min}-${ageRange.max}). Style: witty like Roald Dahl, alive like Diary of a Wimpy Kid, warm like Magic Tree House.

RHYTHM: 30%+ sentences UNDER 6 words. Max 15% over 12. Pattern: Short. Short. Medium with detail. Short. FORBIDDEN: Medium. Medium. Medium. No jargon.

HUMOR (1x per chapter, ch.4 may be serious): Physical comedy, word invention ("snore-wolf"), misunderstanding, contrast comedy, running gag (2-3x more absurd).

DIALOGUE (25-40%, min 4-5 lines per chapter):
- Dialogue = tool #1 for character+humor+tension. No empty "Yes"/"Okay".
- Subtext: "I don't care" + hands in pockets = they DO care. Kids talk around shame/fear.
- Every line anchored to body action: "Come!" she called, tugging his sleeve. NOT: "Come!" she said.

CHARACTERS: NO child is always smart/impulsive. The careful one must be wrong 1x, the brave one sensitive 1x. Max 2 foreground per chapter. Every on-stage character speaks or acts 1x.

RULES:
1. Emotions through BODY, never labels. FORBIDDEN: "He was nervous." INSTEAD: "His stomach did a flip."
2. Each character sounds DIFFERENT — recognizable without the name. One: 2-5-word bursts, one: detail-sentences, one: interrupts.
3. Paragraphs: 2-4 sentences. EVERY chapter = JSON array of 4-6 paragraph strings.
4. Story, not report. No lists, no protocol language.
5. Moral NEVER spoken. Lesson shows through action.
6. ANTI-FORMULA: 1 surprising moment per chapter.`;
}

// ═══════════════════════════════════════════════════════════════════════════
// V7 REVISION PROMPT — blueprint-aware, focused on specific fixes
// ═══════════════════════════════════════════════════════════════════════════

export function buildV7RevisionPrompt(input: {
  originalDraft: { title: string; description: string; chapters: Array<{ chapter: number; text: string }> };
  blueprint?: StoryBlueprint;
  cast: CastSet;
  language: string;
  ageRange: { min: number; max: number };
  totalWordMin: number;
  totalWordMax: number;
  wordsPerChapter: { min: number; max: number };
  qualityIssues: string;
  stylePackText?: string;
}): string {
  const { originalDraft, language, totalWordMin, totalWordMax, wordsPerChapter, qualityIssues } = input;
  const isGerman = language === "de";
  const outputLang = isGerman ? "German" : language;
  const umlautRule = isGerman ? " Korrekte Umlaute (ä, ö, ü, ß). Keine englischen Wörter." : "";

  const allNames = [...input.cast.avatars, ...input.cast.poolCharacters]
    .map(s => s.displayName)
    .filter(Boolean)
    .join(", ");

  const originalText = originalDraft.chapters
    .map(ch => `--- Chapter ${ch.chapter} ---\n${ch.text}`)
    .join("\n\n");

  const blueprintHint = input.blueprint
    ? `\n::: BLUEPRINT (emotional roadmap — use as guide) :::\n${JSON.stringify(input.blueprint, null, 2)}\n`
    : "";

  const stylePackBlock = trimPromptLines(sanitizeStylePackBlock(input.stylePackText, isGerman), 5);

  return `TASK: Rewrite this story so it sounds like a REAL PUBLISHED children's book. Fix the specific issues listed below.

::: CRITIC FEEDBACK (MUST FIX) :::
${qualityIssues || "- General prose improvement needed. Too flat, robot-style prose."}
${blueprintHint}
::: REWRITE RULES (focus on these) :::

1. PARAGRAPHS: If chapters have single-sentence chains ("He ran. She said. He nodded."), merge into flowing paragraphs of 2-4 sentences.

2. EMOTIONS = BODY: Find every "he was nervous/happy/sad" and replace with physical sensation.

3. DISTINCT VOICES: Each character must sound different. If you can swap two characters' dialogue without it sounding wrong → fix it.

4. DIALOGUE ANCHORING: Every dialogue line needs a physical action anchor. No floating quotes.

5. DIALOGUE RATIO: Each chapter must have at least 4-5 spoken lines (25-40% dialogue). Dialogue is the #1 tool for character, humor, and tension. If a chapter is below 20% dialogue, ADD more exchanges.

6. CHAPTER TRANSITIONS: The first sentence of each chapter (from Ch2 on) must connect to the last sentence of the previous chapter.

7. CHAPTER 1 OPENING: Keep a soft launch. Paragraph 1 grounds the lead child in a familiar place through action, voice, or a visible child-linked detail. Paragraph 2 states mission + concrete risk. Do NOT rewrite chapter 1 into a static scenic postcard or a hard action cold-open.

::: HARD RULES :::
1. Language: ONLY ${outputLang}.${umlautRule}
2. Length: ${totalWordMin}-${totalWordMax} words. Chapters: ${wordsPerChapter.min}-${wordsPerChapter.max}.
3. Cast Lock: ${allNames}. No new names.
4. Never copy goal/conflict text into the story. Dramatize.
5. Chapter 1 may open quietly, but the first sentence must already point to the lead child or the concrete child-world problem. No pure scenic setup.

${stylePackBlock ? `::: STYLE :::\n${stylePackBlock}\n` : ""}
::: ORIGINAL DRAFT (REWRITE) :::
${originalText}

::: OUTPUT :::
{
  "title": "Story title",
  "description": "Teaser sentence",
  "chapters": [
    { "chapter": 1, "paragraphs": ["Paragraph 1 (2-4 sentences).", "Paragraph 2.", "Paragraph 3.", "Paragraph 4."] }
  ]
}
"paragraphs" MUST be a JSON array of 4-6 strings. Each string = one paragraph. NEVER put the whole chapter in one string.
Only fix what the critic feedback demands. Do not invent new plot points.`;
}

// --- Legacy Full Story Prompt (V6 for Gemini 3 Flash) -----------------------------------------
// KEY INSIGHT: Gemini Flash responds best to EXAMPLES, not to rule lists.
// V6 changes:
//   - Shorter system instruction (author persona, not rule engine)
//   - Expanded golden examples (7 scenes covering all prose patterns)
//   - "PROSE DNA" section teaching rhythm through patterns, not rules
//   - Expanded _planning field forcing concrete voice signatures + somatic markers
//   - Anti-patterns shortened to 4 critical items (long lists cause "avoidance prose")
//   - Added PARAGRAPH STRUCTURE rule (the #1 quality killer was single-sentence chains)
// NOTE: V6 is kept as fallback. V7 blueprint-driven prompt is the new default.

export function buildFullStoryPrompt(input: {
  directives: SceneDirective[];
  cast: CastSet;
  dna: TaleDNA | StoryDNA;
  model?: string;
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
  const { directives, cast, dna, model, language, ageRange, tone, humorLevel, totalWordMin, totalWordMax, wordsPerChapter, stylePackText, fusionSections, avatarMemories, userPrompt } = input;
  const promptMode = input.promptMode ?? "full";
  const isCompactPrompt = promptMode === "compact";
  const modelName = String(model || "").toLowerCase();
  const isGeminiFlashModel = modelName.startsWith("gemini-3-flash");
  const isGerman = language === "de";
  const targetLanguage = isGerman ? "Deutsch" : language;
  const targetTone = tone ?? dna.toneBounds?.targetTone ?? (isGerman ? "warm" : "warm");
  const artifactName = cast.artifact?.name?.trim();
  const artifactRule = cast.artifact?.storyUseRule || (isGerman ? "wichtiges magisches Objekt" : "important magical object");

  const allSlots = new Set(directives.flatMap(d => d.charactersOnStage));
  const allowedNames: string[] = [];
  const characterProfiles: string[] = [];
  const promptSheets: CharacterSheet[] = [];

  for (const slot of allSlots) {
    if (slot.includes("ARTIFACT")) continue;
    const sheet = findCharacterBySlot(cast, slot);
    if (!sheet) continue;
    if (!allowedNames.includes(sheet.displayName)) {
      allowedNames.push(sheet.displayName);
    }
    const promptSheet = sheet as CharacterSheet;
    promptSheets.push(promptSheet);
    characterProfiles.push(
      isCompactPrompt
        ? buildCompactCharacterProfile(promptSheet, isGerman)
        : buildCharacterProfile(promptSheet, isGerman),
    );
  }

  const focusChildSheets = getChildFocusSheets(cast);
  const focusChildNames = focusChildSheets.map(sheet => sheet.displayName).filter(Boolean);
  const childVoiceContract = buildFocusedChildVoiceContract(focusChildSheets as CharacterSheet[], isGerman);
  const appearanceLockBlock = buildAppearanceLockBlock(promptSheets, isGerman);
  const focusMaxActive = ageRange.max <= 8 ? 3 : 4;
  const focusIdealRange = ageRange.max <= 8 ? "2-3" : "3-4";

  const avatarRule = focusChildNames.length >= 2
    ? `- Child-focus requirement: ${focusChildNames.join(" and ")} carry the emotional arc and must stay active in EVERY beat. Supporting adults or mentors may help, but must not take over the child's growth.`
    : focusChildNames.length === 1
      ? `- Child-focus requirement: ${focusChildNames[0]} must stay emotionally active in EVERY beat (action, dialogue, or body reaction).`
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
    const settingMax = 60;
    const goalMax = 120;
    const conflictMax = 120;
    const outcomeMax = 80;

    const isFirstChapter = idx === 0;
    const conflictLine = isFirstChapter
      ? `   Conflict: [NONE — Ch1 is ORIENTATION ONLY: introduce world + characters + mission. No action conflict yet.]`
      : `   Conflict: ${trimDirectiveText(sanitizeDirectiveNarrativeText(directive.conflict), conflictMax)}`;
    return `CHAPTER ${idx + 1}:\n   Setting: ${trimDirectiveText(sanitizeDirectiveNarrativeText(directive.setting), settingMax)}${artifactTag}\n   Goal: ${trimDirectiveText(sanitizeDirectiveNarrativeText(directive.goal), goalMax)}\n${conflictLine}\n   Characters: ${uniqueCast.join(", ") || "none"}\n   End Trigger: ${trimDirectiveText(sanitizeDirectiveNarrativeText(directive.outcome), outcomeMax)}${fusionHint ? `\n   Hint: ${trimDirectiveText(sanitizeDirectiveNarrativeText(fusionHint), 60)}` : ""}`;
  }).join("\n\n");
  const geminiBeatCards = directives.map((directive, idx) => {
    const castNames = directive.charactersOnStage
      .filter(slot => !slot.includes("ARTIFACT"))
      .map(slot => findCharacterBySlot(cast, slot)?.displayName)
      .filter((name): name is string => Boolean(name));
    const uniqueCast = Array.from(new Set(castNames));
    const fusionHint = fusionSections?.get(directive.chapter)?.split("\n").slice(0, 1).join(" ").trim();
    const artifactTag = artifactName && directive.artifactUsage && !directive.artifactUsage.toLowerCase().includes("nicht")
      ? ` [${artifactName}]`
      : "";
    const settingCue = trimDirectiveText(sanitizeDirectiveNarrativeText(directive.setting), 52);
    const actionCue = trimDirectiveText(sanitizeDirectiveNarrativeText(directive.goal), 92);
    const pressureCue = trimDirectiveText(sanitizeDirectiveNarrativeText(directive.conflict), 92);
    const turnCue = trimDirectiveText(sanitizeDirectiveNarrativeText(directive.outcome), 74);
    const artifactCue = directive.artifactUsage
      ? trimDirectiveText(sanitizeDirectiveNarrativeText(directive.artifactUsage), 74)
      : "";

    const isFirstChapter = idx === 0;
    const pressureLine = isFirstChapter
      ? "- Pressure now: [NONE — Ch1 is ORIENTATION ONLY. Introduce world + characters + mission. Conflict starts in Ch2.]"
      : `- Pressure now: ${pressureCue}`;
    return `CH ${idx + 1}
- Scene anchor: ${settingCue}${artifactTag}
- Must happen: ${actionCue}
${pressureLine}
- End shift: ${turnCue}
- On stage: ${uniqueCast.join(", ") || "none"}${artifactCue ? `\n- Artifact move: ${artifactCue}` : ""}${fusionHint ? `\n- Extra cue: ${trimDirectiveText(sanitizeDirectiveNarrativeText(fusionHint), 58)}` : ""}`;
  }).join("\n\n");

  const safetyRule = "No explicit violence, no weapons, no blood, no horror, no bullying, no politics/religion, no drugs/alcohol/gambling.";

  const titleHint = "Max 6 words, curiosity-driven, avoid 'object and person' pattern (e.g. avoid 'Tom and the Stone').";

  const outputLang = isGerman ? "German" : targetLanguage;
  const umlautRule = isGerman ? " Use proper German umlauts (ä, ö, ü, ß), never ASCII substitutes. No English words." : "";

  // Age-appropriate reading level rules — always in English for model quality
  const ageMin = ageRange.min;
  const ageMax = ageRange.max;
  const ageGroupRule = ageMax <= 6
    ? `AGE GROUP ${ageMin}-${ageMax}: VERY short sentences (max 8 words each). Only simple everyday vocabulary. Lots of repetition for rhythm. One action per sentence. No background knowledge required. The output language is ${outputLang} but these structural rules always apply.`
    : ageMax <= 8
      ? `AGE GROUP ${ageMin}-${ageMax}: Short to medium sentences (max 12 words). Everyday conversational language. No jargon, no complex metaphors. Every paragraph must be immediately understandable to a child reading aloud. The output language is ${outputLang} but these structural rules always apply.`
      : `AGE GROUP ${ageMin}-${ageMax}: Medium sentences allowed. Richer vocabulary and imagery possible. Some complex sentences okay if balanced with short punchy ones.`;

  // Chapter 1 character introduction requirement
  const ch1CharIntroNames = characterProfiles
    .slice(0, 4)
    .map(p => {
      const match = p.match(/\*\*(.+?)\*\*/);
      return match ? match[1] : null;
    })
    .filter(Boolean)
    .join(", ");

  const ch1IntroRule = `CHAPTER 1 MANDATORY – WORLD SETUP + CHARACTER INTRODUCTION:

A child picks up this book knowing NOTHING. Chapter 1 is not action — it is ORIENTATION.
Before any danger, quest, or problem begins, the reader needs to know:
  1. WHO are the characters? (name + one concrete behavior cue; use appearance only if it is canonically locked)
  2. WHERE are they? (the place in one concrete, child-readable cue; do NOT open with "It smelled of...")
  3. WHAT is the mission/goal? (stated clearly and simply, like a parent explaining it)
  4. WHY does it matter? (what bad thing happens if they fail — concrete, not vague)

CHAPTER 1 STRUCTURE (mandatory order):
  PARAGRAPH 1 – WORLD + CHARACTERS: Introduce the setting and EACH character through action, position, or voice. Mention appearance only when it is explicitly locked. No name-drops — weave details into action.
    EXAMPLE: "Mira hatte schon die Hand am Eimer, bevor jemand etwas sagen konnte. Neben ihr tippte Timo mit dem Schuh gegen den Brunnenrand und fragte als Erster, was kaputt war."
  PARAGRAPH 2 – THE MISSION: Explain clearly and simply WHAT the characters must do and WHY. A child must understand in one reading.
    EXAMPLE: "Der Brunnen verliert Wasser", sagte die Mutter. "Bringt diesen Eimer zum Zauberkreis, sonst bleibt das Dorf heute Abend dunkel."
  PARAGRAPH 3+ – THE HOOK: Something goes slightly wrong or mysterious appears. A question forms. The adventure begins.
  FINAL PARAGRAPH – STAKES: State CONCRETELY what is lost if they fail. End on unresolved tension — not relief.

Characters who appear in Chapter 1: ${ch1CharIntroNames}.

ABSOLUTE RULES:
- NEVER start Chapter 1 mid-action or mid-quest. The reader must first understand the world.
- NEVER open Chapter 1 with an atmosphere-only smell sentence like "Es roch nach...".
- NEVER assume the reader knows who the characters are. Introduce everyone.
- NEVER invent glasses, hats, scarves, eye colors, or signature accessories unless they are explicitly locked in the character section.
- The mission/goal must be so clear that a 6-year-old can repeat it back.
- Keep the foreground on a tight pair. Any additional character may only react briefly.`;

  const humorTarget = Math.max(0, Math.min(3, Number.isFinite(humorLevel as number) ? Number(humorLevel) : 2));
  const humorRule = humorTarget >= 3
    ? "Humor: HIGH. Needs 3+ laugh moments (slapstick, misunderstanding, witty comeback)."
    : humorTarget >= 2
      ? "Humor: MEDIUM. Needs 2+ laugh moments suitable for children."
      : humorTarget >= 1
        ? "Humor: LIGHT. One smile moment."
        : "Humor: Optional.";

  const goldenExample = buildGoldenExampleBlock(isGerman);
  const antiPatterns = buildAntiPatternBlock(isGerman);
  const geminiMicroExamples = buildGeminiFlashMicroExamplesBlock(isGerman);
  const chapterChecklist = directives.map((directive, idx) => {
    const castNames = directive.charactersOnStage
      .filter(slot => !slot.includes("ARTIFACT"))
      .map(slot => findCharacterBySlot(cast, slot)?.displayName)
      .filter((name): name is string => Boolean(name));
    const uniqueCast = Array.from(new Set(castNames));
    const focusCast = getCoreChapterCharacterNames({ directive, cast, ageMax });

    let specialRule = `Keep the foreground on ${focusCast.join(", ") || uniqueCast.slice(0, 2).join(", ") || "a tight pair"}. Any additional character may only react briefly.`;
    if (idx === 0) {
      specialRule += isGerman
        ? " KAPITEL 1: Fuehre jede Figur zuerst ueber Handlung, Stimme oder Position ein. Aussehen nur nennen, wenn es im Appearance-Lock bestaetigt ist. Kein Geruchs-Opener. Dann: Enthaelt einen expliziten Stakes-Satz mit \"Wenn ... sonst ...\" und einem konkreten Ding (z. B. Schluessel, Weg, Karte)."
        : " CHAPTER 1: Introduce each character first through action, voice, or position. Mention looks only if confirmed in the appearance lock. No smell-led opener. Then: Include one explicit stakes sentence with \"if ... otherwise ...\" and one concrete thing at risk (key, path, map).";
    }
    if (idx === 2 || idx === 3) {
      specialRule += isGerman
        ? " Konkreter Rueckschlag (brach/verlor/blockiert/zu spaet) plus Koerpersignal (Magen/schluckte/zitterte)."
        : " Include a concrete setback (broke/lost/blocked/too late) plus one body reaction (stomach/swallowed/trembled).";
    }
    if (idx === directives.length - 1) {
      specialRule += isGerman
        ? " Zeige konkreten Gewinn (geschafft/gefunden/gerettet + Objekt) UND kleinen Preis mit Marker (aber/kostete/musste/riss/kaputt)."
        : " Show concrete payoff (saved/found/solved + object) AND a small cost marker (but/cost/had to/tore/broke).";
    }

    return `- Ch${idx + 1}: ${uniqueCast.join(", ") || "none"}. ${specialRule}`;
  }).join("\n");

  if (isGeminiFlashModel) {
    return `You are writing a REAL children's book chapter sequence, not a template report.
Write natural, vivid prose with emotional subtext and clear scene momentum.

${geminiMicroExamples}

# NON-NEGOTIABLE QUALITY TARGET
- Prose must read like published children's fiction, never like prompt output.
- Use paragraphs that breathe (usually 2-4 sentences), varied rhythm, and sensory detail only when it sharpens action. Do not force smell into openings.
- Dialogue must be character-specific and anchored to action (no talking heads).
- No moral lecture, no meta narration, no scene labels, no protocol/report tone.
- BANNED fillers: "plötzlich", "auf einmal", "suddenly", repetitive "dann" sentence starts.

# HARD CONSTRAINTS
1. Language: ${outputLang} only.${umlautRule}
2. Format: single valid JSON object.
3. Length: total ${totalWordMin}-${totalWordMax} words. Chapter target ${wordsPerChapter.min}-${wordsPerChapter.max}.
4. Cast lock: only ${allowedNames.join(", ")}. No new names.
5. Safety: ${safetyRule}
6. ${humorRule}
7. NEVER copy Goal/Conflict/Setting wording verbatim. Dramatize into scene action.
8. STRICT ANTI-ECHO: Do not reuse ANY 4+ word phrase from STORY BEATS as dialogue or narration. Beat text = instructions, not prose. If a beat says "if they lose the trail, the garden stays dark" → no character may speak those words. Instead: show a dying flower, a cracked clock face, a character's jaw going tight. Translate instructions into ACTIONS and IMAGES.
8b. Before finalizing each chapter: check your first 3 dialogue lines — do they echo the Goal/Conflict wording? If yes → rewrite as physical action.
9. Keep optional metadata ultra-short; spend tokens on chapter prose.
10. APPEARANCE LOCK: Never invent glasses, hats, scarves, hair colors, eye colors, or signature accessories unless they are explicitly confirmed below.
11. Validator anchors (must be natural prose, not checklist text):
   - Ch1 PARAGRAPH 1: Establish WHO + WHERE through action, voice, and place. Mention appearance only when explicitly locked. Never start mid-action and never start with "Es roch nach...".
   - Ch1 PARAGRAPH 2: State the MISSION clearly (what + why). Must be so simple a 6-year-old can repeat it.
   - Ch1 includes a concrete stakes sentence: what is lost if they fail.
   - Ch1-4 each end on UNRESOLVED TENSION (never "...and they were relieved" or "...they continued").
   - Each chapter uses a DIFFERENT obstacle type — no plot device repeats within the story.
   - EVERY character listed in a chapter speaks at least one line AND does one physical action.
   - Ch3 or Ch4 contains setback + physical body reaction (2-3 sentences of feeling stuck).
   - Final chapter includes concrete win + small tangible price + callback to Ch1's opening.
12. Dialogue formatting: use standard double quotes "..." for dialogue, never single quotes.
13. Avoid possessive name+noun constructs like "Adrians Magen" or "Mamas Schal"; use pronouns (sein/ihr) instead.
14. ${ageGroupRule}
15. PARAGRAPH STRUCTURE: Use blank lines between paragraphs. Each chapter needs 4-6 paragraphs of 2-4 sentences each. NEVER one block of text.

::: CHAPTER 1 – CHARACTER INTRODUCTION (MANDATORY) :::
${ch1IntroRule}

${avatarRule ? `${avatarRule}\n` : ""}
${stylePackBlock ? `::: STYLE PACK :::\n${stylePackBlock}\n` : ""}
${customPromptBlock ? `::: USER REQUEST :::\n${customPromptBlock}\n` : ""}

::: CHARACTER VOICES :::
${characterProfiles.join("\n")}
${childVoiceContract ? `\n${childVoiceContract}` : ""}
${appearanceLockBlock ? `\n::: CHARACTER APPEARANCE LOCKS :::\n${appearanceLockBlock}\n` : ""}
${memorySection}
${artifactName ? `::: ARTIFACT :::\n- Name: ${artifactName}\n- Rule: ${artifactRule}\n- Arc: Discovery -> Misuse -> Mastery (child-led resolution).\n` : ""}

::: CHAPTER CHECKLIST (MUST PASS) :::
${chapterChecklist}

::: STORY BEATS (reference, do not copy) :::
${geminiBeatCards}

::: OUTPUT FORMAT :::
Return JSON only:
{
  "title": "${titleHint}",
  "description": "One teaser sentence with a question hook",
  "_checks": {
    "ch1_stakes_sentence": "very short",
    "ch3_or_ch4_lowpoint": "very short",
    "ch5_payoff_price": "very short",
    "anti_meta": "ok"
  },
  "chapters": [
    { "chapter": 1, "paragraphs": ["Paragraph one (2-4 sentences).", "Paragraph two (2-4 sentences).", "Paragraph three.", "Paragraph four.", "Paragraph five (optional)."] }
  ]
}
IMPORTANT: "paragraphs" MUST be a JSON array of 4-6 strings. Each string = one paragraph (2-4 sentences). NEVER put the whole chapter in one string.
The "_checks" object is optional. If included, keep it under 40 words total.`;
  }

  // V6: Gemini 3 Flash "Maximum Quality" – Example-driven, not rule-driven.
  // The key insight: Gemini Flash writes EXACTLY like the examples. So we give it
  // the best possible examples and minimal rules.
  return `You are a world-class children's book author. You write prose that sounds like a REAL PUBLISHED BOOK,
not like AI-generated text. Your writing is warm, witty, and alive.

${goldenExample}

${antiPatterns}

::: PROSE DNA – HOW TO WRITE LIKE A REAL PUBLISHED AUTHOR :::

**PARAGRAPH BREATHING (THE #1 QUALITY MARKER):**
Every chapter MUST have 4-7 clearly separated paragraphs with a blank line between them.
NEVER write one wall of text. Each paragraph = one beat: arrival, discovery, conflict, reaction, or decision.
Paragraph length: 2-4 sentences. Never 1. Never 8+.
After every 3-4 sentences of action → one short dialogue exchange. After dialogue → return to action/environment.
This rhythm: ACTION → DIALOGUE → REACTION → ACTION is what makes stories feel ALIVE.

**SENSORY DISCIPLINE:**
- Use sensory detail only when it sharpens action, danger, or place.
- Never begin any chapter with an atmosphere-only smell sentence like "Es roch nach...".
- Prefer movement, sound, texture, or a visible problem over perfume-style description.

**SENTENCE RHYTHM:**
- Short. Short. One longer flowing sentence with a surprise or image at the end.
- Interrupt dialogue with action: "I can–" She tripped. "–do this."
- Trio-rhythm for descriptions: Smooth. Cold. And far too heavy for one person alone.
- BANNED sentence starters: "suddenly", "all at once", "then" (as a chain connector), "finally"

**EMOTION = BODY, NEVER LABELS:**
- NEVER: "He was nervous" → INSTEAD: "His fingers dug into the fabric of his jacket."
- NEVER: "She felt happy" → INSTEAD: "Her toes curled inside her boots."
- Each chapter gets EXACTLY ONE somatic-marker moment (stomach tightening, throat dry, hands shaking, etc.)

**DIALOGUE = CHARACTER IDENTITY:**
- Each character must be recognizable by their sentence length and vocabulary ALONE — no name tag needed
- EVERY dialogue line must be physically anchored (no floating quotes, no talking heads)
- Quick 3+ line exchanges create energy and humor — use them at least once per chapter
- At least 25% of each chapter must be dialogue

**ACTIVE PRESENCE — ZERO GHOST CHARACTERS:**
- EVERY character listed for a chapter MUST speak at least ONE line AND perform at least ONE physical action
- If you struggle to give a character something to do → use them for comic relief, observation, or contradiction
- A character who only exists as "he was also there" does NOT count as present
- After writing each chapter: mentally check every listed name — did they speak? did they move?

**CHAPTER ENDINGS — NO SOFT LANDINGS:**
- Chapters 1-4 must end with UNRESOLVED TENSION: a door slamming shut, a sudden noise, a choice not yet made
- The reader must feel a physical urge to turn the page
- FORBIDDEN endings for Chapters 1-4: "...and so they continued." / "...and things were okay." / "...they were relieved."
- Chapter 5 ends with resolution + ONE warm, specific image (not a moral statement)

**PLOT DEVICE VARIETY — NO REPEATS:**
- Each chapter must use a DIFFERENT type of obstacle: false clue / trap / physical barrier / broken tool / betrayal / time pressure
- NEVER use the same trick twice in one story (e.g., "false trail" can appear ONCE maximum)
- The artifact may help, but the CHILD must be the one who decides how — the artifact never acts alone

::: HARD CONSTRAINTS :::
1. LANGUAGE: ${outputLang} ONLY.${umlautRule}
2. FORMAT: Single valid JSON object.
3. LENGTH: Total ${totalWordMin}-${totalWordMax} words. Each chapter: ${wordsPerChapter.min}-${wordsPerChapter.max} words.
   → Stories under ${totalWordMin} words = REJECTED. Expand dialogue and scene texture!
4. CAST LOCK: Only ${allowedNames.join(", ")}. No new character names. Ever.
5. SAFETY: ${safetyRule}
6. ${humorRule}
7. NEVER copy Goal/Conflict/Setting text into the story. Dramatize into natural prose.
8. STRICT ANTI-ECHO: Do not reuse ANY 4+ word phrase from STORY BEATS as dialogue or narration. Beat text = instructions, not prose. If a beat says "if they lose the trail, the garden stays dark" → no character may speak those words. Instead: show a dying flower, a cracked clock face, a character's jaw going tight. Translate instructions into ACTIONS and IMAGES.
8b. Before finalizing each chapter: check your first 3 dialogue lines — do they echo the Goal/Conflict wording? If yes → rewrite as physical action.
9. Dialogue formatting: use standard double quotes "..." for dialogue, never single quotes.
10. APPEARANCE LOCK: Never invent glasses, hats, scarves, hair colors, eye colors, or signature accessories unless they are explicitly confirmed below.
11. Avoid possessive name+noun constructs like "Adrians Magen" or "Mamas Schal"; use pronouns instead.
12. ${ageGroupRule}
13. PARAGRAPH BREAKS: Use blank lines between paragraphs. 4-7 paragraphs per chapter minimum. Never one text wall.

::: CHAPTER 1 – CHARACTER INTRODUCTION (MANDATORY) :::
${ch1IntroRule}

${avatarRule ? `${avatarRule}\n` : ""}
${stylePackBlock ? `::: STYLE PACK :::\n${stylePackBlock}\n` : ""}
${customPromptBlock ? `::: USER REQUEST :::\n${customPromptBlock}\n` : ""}

::: CHARACTER VOICES :::
${characterProfiles.join("\n")}
${childVoiceContract ? `\n${childVoiceContract}` : ""}
${appearanceLockBlock ? `\n::: CHARACTER APPEARANCE LOCKS :::\n${appearanceLockBlock}\n` : ""}
${memorySection}
${artifactName ? `::: ARTIFACT :::\n- Name: ${artifactName}\n- Rule: ${artifactRule}\n- Arc: Discovery → Temptation → Child-led Mastery (the CHILD decides how the artifact is used, it never acts alone).\n` : ""}

::: STORY BEATS (DRAMATIZE – DO NOT COPY) :::
${beatLines}

::: STORY STRUCTURE REQUIREMENTS :::
- Chapter 1: WORLD SETUP → MISSION → HOOK → STAKES (NO ACTION CONFLICT)
  ⚠️ CHAPTER 1 HAS NO CONFLICT. The Beat Card conflict field for Ch1 is IGNORED. Ch1 is PURE ORIENTATION.
  Chapter 1 is ORIENTATION first, action second. The reader knows nothing.
  PARAGRAPH 1 – WORLD + CHARACTERS: State WHO and WHERE through action, voice, and a concrete place cue. Mention appearance only when it is explicitly locked. Write as if explaining to a 6-year-old who has never heard of these characters.
    FORBIDDEN: Starting in the middle of action ("Adrian rannte durch den Wald..."). FORBIDDEN: smell-led openings like "Es roch nach...". REQUIRED: Start with the world and the people in it.
  PARAGRAPH 2 – THE MISSION (mandatory): An adult/authority figure gives the characters a clear task. State WHAT they must do and WHY in simple language. Any child must be able to repeat the mission after reading this paragraph.
  PARAGRAPH 3 – FIRST STEP / HOOK: The characters set out. Something small goes slightly wrong or mysterious. The question forms.
  FINAL PARAGRAPH – STAKES: State CONCRETELY what is lost if they fail. End on unresolved tension — a sound, a shadow, a question unanswered.
  Conflict starts in Chapter 2. Not before.
- Chapter 2: DISCOVERY + TEMPTATION. One exciting thing appears. One character wants to take a shortcut. Chapter ends with a door slamming, a trap springing, a wrong choice — unresolved.
- Chapter 3: COMPLICATION + SETBACK. A plan fails. Something breaks or is lost. Show the physical/emotional reaction for 2-3 sentences. Characters feel stuck — before one small idea emerges. Chapter ends mid-action or with a new danger.
- Chapter 4: DARKEST MOMENT → TURNING POINT. The worst thing happens. A character almost gives up. ONE moment of courage or insight changes everything. Chapter ends with forward momentum but danger still present.
- Chapter 5: RESOLUTION + CALLBACK + SMALL PRICE. Show EXACTLY what was won. Connect back to Chapter 1's opening image or problem. Include ONE small tangible loss (torn glove, lost hat, missed dinner). Final image: specific and warm, not a moral statement.

::: OUTPUT FORMAT :::
Write a JSON object:

{
  "_planning": {
    "voice_signatures": { "[char1]": "style + 2 words", "[char2]": "style + 2 words" },
    "ch1_intro_check": "List each character in Ch1 + one action cue or locked canon detail + their spoken line",
    "obstacles": { "ch1": "none (orientation)", "ch2": "type", "ch3": "type", "ch4": "type", "ch5": "type" },
    "payoff_and_price": "Ch5: what is won (concrete) + what small thing is lost"
  },
  "title": "${titleHint}",
  "description": "Teaser sentence that plants a QUESTION in the reader's mind",
  "chapters": [
    { "chapter": 1, "paragraphs": ["Paragraph one (2-4 sentences).", "Paragraph two (2-4 sentences).", "Paragraph three.", "Paragraph four.", "Paragraph five (optional)."] }
  ]
}
IMPORTANT: "paragraphs" MUST be a JSON array of 4-6 strings. Each string = one paragraph (2-4 sentences). NEVER put the whole chapter in one string.`;
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

  const focusChildSheets = getChildFocusSheets(cast);
  const focusChildNames = focusChildSheets.map(sheet => sheet.displayName).filter(Boolean);
  const childVoiceContract = buildFocusedChildVoiceContract(focusChildSheets as CharacterSheet[], isGerman);
  const avatarRule = focusChildNames.length >= 2
    ? `- ${focusChildNames.join(" and ")} carry the emotional arc and must stay active in EVERY beat. Supporting adults or mentors may help, but must not own the child's growth.`
    : focusChildNames.length === 1
      ? `- ${focusChildNames[0]} must stay emotionally active in EVERY beat.`
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
    .map(ch => `-- - Beat ${ch.chapter} ---\n${ch.text} `)
    .join("\n\n");

  const outputLang = isGerman ? "German" : targetLanguage;
  const umlautRule = isGerman ? " Use proper German umlauts (�, �, �, �), never ASCII. No English words." : "";

  const goldenExampleRef = buildGoldenExampleBlock(isGerman);

  return `TASK: Rewrite this story so it sounds like a REAL PUBLISHED children's book. The draft was rejected for sounding AI-generated.

::: CRITIC FEEDBACK(MUST FIX) :::
${qualityIssues || "- General prose improvement needed. Too flat, robot-style prose."}

${goldenExampleRef}

::: THE REWRITE RULES(focus on these 5 things) :::

  1. ** PARAGRAPH STRUCTURE(THE #1 PROBLEM) **
    The draft likely has single - sentence chains: "He ran. She said. He nodded."
  FIX: Rewrite into flowing paragraphs of 2 - 5 sentences where action, dialogue, and detail blend:
  "Der Laden roch nach altem Holz. Bruno wischte die Theke, ohne aufzusehen. 'Drei Saecke Mehl', sagte er. 'Und Glueck.'"

  2. ** EMOTION = BODY, NEVER LABELS **
    Find every "he was nervous/happy/sad" and replace with physical sensation:
    - "Er war nervoes" → "Seine Finger krallten sich in den Stoff."
      - "Sie war gluecklich" → "Ihre Zehen wackelten in den Stiefeln."

  3. ** DISTINCT VOICES **
    Each character must sound different by sentence length, word choice, and attitude.
   If you can swap two characters' dialogue lines without it sounding wrong → FIX IT.

  4. ** DIALOGUE ANCHORING **
    Every dialogue line needs a physical action anchor.No talking heads.
      Bad: "Hallo", sagte Tom.Good: Tom trat gegen den Dreck. "Hallo."

  5. ** CHAPTER 1 OPENING **
    Keep a soft launch for ages 6-8. Paragraph 1 grounds the lead child in a familiar place through action, voice, or a visible child-linked detail.
    Paragraph 2 states the mission and the concrete risk.
    Do NOT rewrite chapter 1 into a static scenic postcard or a hard action cold-open.

::: HARD RULES:::
  1) Language: ONLY ${outputLang}.${umlautRule}
  2) Length: ${totalWordMin} -${totalWordMax} words.Chapters: ${wordsPerChapter.min} -${wordsPerChapter.max}.
   → IF TOO SHORT: Add dialogue exchanges and sensory details, not filler.
3) Cast Lock: ${allowedNames || "(none)"}. No new names.
    ${humorRewriteLine}
  5) NEVER copy Goal / Conflict / Setting text into the story.Dramatize!
  6) BANNED: "plötzlich", emotion labels, single - sentence chains, moral lectures.
  7) Chapter 1 may open quietly, but the first sentence must already point to the lead child or the concrete child-world problem. No pure scenic setup.

    ${stylePackBlock ? `::: STYLE PACK :::\n${stylePackBlock}\n` : ""}
${customPromptBlock ? `::: USER REQUEST :::\n${customPromptBlock}\n` : ""}

::: ORIGINAL DRAFT(REWRITE COMPLETELY) :::
${originalText}

::: OUTPUT FORMAT:::
  {
    "_planning": {
      "paragraph_fix": "I will merge single-sentence chains into flowing paragraphs of 2-5 sentences.",
        "emotion_replacements": ["3 specific emotion words I found and will replace with body actions"],
          "voice_signatures": {
        "[character1]": "sentence style + 2 typical words",
          "[character2]": "sentence style + 2 typical words"
      },
      "fix_strategy": "How I will fix the critic feedback issues"
    },
    "title": "Story title",
      "description": "Teaser sentence",
        "chapters": [
          { "chapter": 1, "paragraphs": ["Paragraph one (2-4 sentences).", "Paragraph two (2-4 sentences).", "Paragraph three.", "Paragraph four."] }
        ]
  }
IMPORTANT: "paragraphs" MUST be a JSON array of 4-6 strings. Each string = one paragraph (2-4 sentences). NEVER put the whole chapter in one string.`;
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
  includePlanning?: boolean;
}): string {
  const {
    chapter,
    cast,
    dna,
    language,
    ageRange,
    tone,
    lengthTargets,
    originalText,
    previousContext,
    nextContext,
    requiredCharacters,
    includePlanning = false,
  } = input;
  const isGerman = language === "de";
  const artifactName = cast.artifact?.name?.trim();
  const artifactAlreadyPresent = Boolean(
    artifactName
    && [originalText, previousContext].some(text => String(text || "").includes(artifactName))
  );

  const characterNames = chapter.charactersOnStage
    .map(slot => findCharacterBySlot(cast, slot)?.displayName)
    .filter(Boolean) as string[];
  const uniqueCharacterNames = Array.from(new Set(characterNames));
  const allowedNames = uniqueCharacterNames.join(", ");
  const focusChildNames = getChildFocusNames(cast);
  const chapterFocusNames = getCoreChapterCharacterNames({ directive: chapter, cast, ageMax: ageRange.max });
  const supportNames = uniqueCharacterNames.filter(name => !chapterFocusNames.includes(name));
  const emotionalFocus = focusChildNames.length > 0
    ? focusChildNames.slice(0, 2).join(", ")
    : characterNames.slice(0, 2).join(", ");
  const focusMaxActive = ageRange.max <= 8 ? 3 : 4;
  const focusIdealRange = ageRange.max <= 8 ? "2-3" : "3-4";

  const missingLine = requiredCharacters?.length
    ? `\n** MISSING CHARACTERS (ADD WITH MINIMAL CHANGES):** ${requiredCharacters.join(", ")}\nFor each missing character: INSERT 2-3 sentences that CONNECT to the existing action. The character must REACT to what just happened or CONTRIBUTE to the current goal — not just appear randomly. Include one body action + one dialogue line that reveals personality. Do NOT rewrite the existing text. Total limit remains max ${focusMaxActive} active characters.`
    : "";

  const contextLines = [
    previousContext ? `Previous chapter ended: "${previousContext}"` : "",
    nextContext ? `Next chapter begins: "${nextContext}"` : ""
  ].filter(Boolean).join("\n");

  return `# TASK
Expand the chapter without changing the plot. Show, don't tell!
IMPORTANT: Keep read-aloud clarity high. Use mostly short-to-medium sentences. Many should land around 6-14 words. A few longer sentences are fine if they stay easy to follow.
Add dialogue where it improves clarity and momentum, plus body-action. Quiet setup or low-point beats may use slightly less dialogue.
No feeling-diagnosis sentences like "he was very nervous/sad"; instead show behavior + speech.
Target quality: published children's fiction (Preußler/Lindgren level). Clear cause-effect, concrete action, body reactions, distinct voices.
Expand by adding one more concrete beat, reaction, or dialogue exchange. Smooth existing sentences only if it improves clarity.

# SCENE
    - Setting: ${sanitizeDirectiveNarrativeText(chapter.setting)}, Mood: ${chapter.mood ?? "COZY"}
  - Goal: ${sanitizeDirectiveNarrativeText(chapter.goal)}
  - Available characters: ${allowedNames}
  - Foreground characters: ${chapterFocusNames.join(", ") || allowedNames}
${supportNames.length > 0 ? `  - Support characters: ${supportNames.join(", ")} (brief reaction only if needed)` : ""}
${artifactName && chapter.artifactUsage && artifactAlreadyPresent ? `- Artifact: ${artifactName} (${sanitizeDirectiveNarrativeText(chapter.artifactUsage)})` : ""}
${artifactName && !artifactAlreadyPresent ? `- Artifact status: ${artifactName} is NOT on stage yet. Do not introduce it in this chapter unless it already exists in the original text.` : ""}
  - Tone: ${tone ?? dna.toneBounds?.targetTone ?? "warm"}, Age: ${ageRange.min} -${ageRange.max}
${missingLine}

# LENGTH TARGET
    ** ${lengthTargets.wordMin} -${lengthTargets.wordMax} words, ${lengthTargets.sentenceMin} -${lengthTargets.sentenceMax} sentences **

# RULES
  1. ONLY these names: ${allowedNames}. NEVER invent new characters, names, or entities.
2. No new characters.
3. Max ${focusMaxActive} active characters per chapter, ideal ${focusIdealRange}.
  4. Foreground characters must drive the scene through action or dialogue. Support characters may react briefly or stay absent unless continuity requires them.
5. No meta-labels in the text. NEVER copy the Goal, Conflict, or Setting text directly into the story.
6. SENTENCE LENGTH: Mix short and medium sentences. Many should stay in a child-friendly 6-14 word range, but a few longer read-aloud sentences are okay when clear.
7. At least 1 inner child-moment of ${emotionalFocus} (body signal + thought).
8. Expand by ADDING concrete dialogue lines, reactions, and action beats — not by piling on vague description.
9. Max 1 comparison per paragraph, no metaphor chains.
10. No preview, meta or summary sentences.
11. No explanatory sentences about object rules.
12. Dialogues must sound distinguishable; no speaker - tag formula loops.
13. Running gag sparsely: same sound - word / catchphrase max 2x.
14. If output is German: use proper German spelling; do not use ASCII substitutions like ae/oe/ue. NO English words in output.
15. Dialogue formatting: use standard double quotes "..." for dialogue, never single quotes.
16. Avoid possessive name+noun constructs like "Adrians Magen" or "Mamas Schal"; use pronouns (sein/ihr) instead.
17. Never introduce the artifact early. If it is not already present in the original text or continuity context, leave it out.

${contextLines ? `# CONTEXT\n${contextLines}\n` : ""}
# ORIGINAL
${originalText}

# OUTPUT
JSON:
${includePlanning ? `{
  "_planning": {
    "anti_leak_check": "List any words from the Goal/Conflict that you are tempted to use, and write your concrete alternative here instead.",
    "voice_separation_check": "How will you ensure each character sounds distinct? (e.g. short sentences vs formal words)"
  },
  "paragraphs": ["Paragraph one (2-4 sentences).", "Paragraph two (2-4 sentences).", "Paragraph three.", "Paragraph four."]
}` : `{
  "paragraphs": ["Paragraph one (2-4 sentences).", "Paragraph two (2-4 sentences).", "Paragraph three.", "Paragraph four."]
}`}
IMPORTANT: "paragraphs" MUST be a JSON array of 4-6 strings. Each string = one paragraph. NEVER use a "text" field.`;
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
  "paragraphs": ["Paragraph one (2-4 sentences).", "Paragraph two (2-4 sentences).", "Paragraph three.", "Paragraph four."]
}
IMPORTANT: "paragraphs" MUST be a JSON array of 4-6 strings. Each string = one paragraph. NEVER use a "text" field.`;
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
  includePlanning?: boolean;
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
    includePlanning = false,
  } = input;
  const isGerman = language === "de";
  const lengthTargets = overrideTargets ?? resolveLengthTargets({ lengthHint, ageRange, pacing });
  const artifactName = cast.artifact?.name?.trim();
  const artifactAlreadyPresent = Boolean(
    artifactName
    && [originalText, previousContext].some(text => String(text || "").includes(artifactName))
  );
  const characterNames = chapter.charactersOnStage
    .map(slot => findCharacterBySlot(cast, slot)?.displayName)
    .filter(Boolean) as string[];
  const uniqueCharacterNames = Array.from(new Set(characterNames));
  const allowedNames = uniqueCharacterNames.join(", ");
  const chapterFocusNames = getCoreChapterCharacterNames({ directive: chapter, cast, ageMax: ageRange.max });
  const supportNames = uniqueCharacterNames.filter(name => !chapterFocusNames.includes(name));

  const issueList = issues.length > 0 ? issues.map(issue => `- ${issue}`).join("\n") : "- Keine";
  const continuityContext = [
    previousContext ? `- Previous chapter ended with: "${previousContext}"` : "",
    nextContext ? `- Next chapter starts with: "${nextContext}"` : "",
  ].filter(Boolean).join("\n");

  return `Revise the chapter below to fix ONLY the listed issues. Write the output in ${isGerman ? "German" : language}.
Target quality: published children's fiction (concrete action, distinct voices, emotional subtext), never report-style prose.

CRITICAL PLOT PRESERVATION:
- Keep the SAME events, characters, dialogue, and ending as the original.
- You may ADD lines, REPHRASE sentences, or REMOVE weak phrases.
- You must NOT replace the plot, invent new scenes, or change what happens.
- The revised chapter must be recognizably the same story as the original.

ISSUES TO FIX:
${issueList}

SCENE DIRECTIVE (for context only — do NOT rewrite the chapter to match this):
- Setting: ${sanitizeDirectiveNarrativeText(chapter.setting)}
- Mood: ${chapter.mood ?? "COZY"}
- Goal: ${sanitizeDirectiveNarrativeText(chapter.goal)}
- Conflict: ${sanitizeDirectiveNarrativeText(chapter.conflict)}
- Outcome: ${sanitizeDirectiveNarrativeText(chapter.outcome)}
- Available characters: ${allowedNames || "none"}
- Foreground characters: ${chapterFocusNames.join(", ") || allowedNames || "none"}
${supportNames.length > 0 ? `- Support characters: ${supportNames.join(", ")} (brief reaction only if needed)` : ""}
${artifactName && chapter.artifactUsage && artifactAlreadyPresent
  ? `- Artifact: ${sanitizeDirectiveNarrativeText(chapter.artifactUsage)} (Name: ${artifactName} may be named because it is already on stage)`
  : artifactName
    ? `- Artifact status: ${artifactName} is not on stage yet. Do not introduce or name it in this revision.`
    : "- Artifact: none"}
- Tone: ${tone ?? dna.toneBounds?.targetTone ?? "warm"}
${continuityContext ? `\nCONTINUITY CONTEXT:\n${continuityContext}` : ""}
${stylePackText ? `\n${stylePackText}\n` : ""}

RULES:
1) Use only these names: ${allowedNames || "none"}. NEVER invent new characters, names, or entities.
2) No new proper names.
2b) If output language is German: use proper German spelling; do not use ASCII substitutions like ae/oe/ue.
3) No meta instructions, labels, previews, or summary lines in prose. NEVER copy the Goal, Conflict, or Setting text directly into the story.
4) Foreground characters must act or speak. Support characters may react briefly or stay absent if the chapter is clearer without them.
5) Remove stock phrases and repetitive speaker formulas.
6) ${lengthTargets.wordMin}-${lengthTargets.wordMax} words, ${lengthTargets.sentenceMin}-${lengthTargets.sentenceMax} sentences.
7) Keep dialogue lively (target roughly 25-45% where fitting, no monologue blocks).
8) Keep continuity with adjacent chapters using explicit transitions where needed.
9) Do not explain object rules as textbook statements; show via action + reaction + short dialogue.
10) Keep running gags sparse: same onomatopoeia/catchphrase at most 2 times in this chapter.
11) Use normal prose paragraphs (mostly 2-4 sentences); no one-sentence report chains.
12) No meta/report lines like "Die Szene endete" / "The scene ended".
13) Dialogue formatting: use standard double quotes "..." for dialogue, never single quotes.
14) Avoid possessive name+noun constructs like "Adrians Magen" or "Mamas Schal"; use pronouns (sein/ihr) instead.
15) Never pull the artifact into an earlier chapter just because it exists later in the story.

PROMPT LEAK PREVENTION:
You are strictly forbidden from copying the exact phrasing of the Goal, Conflict, or Setting into the story text.
You must translate these abstract concepts into concrete, in-world actions and dialogue.

ORIGINAL TEXT:
${originalText}

Return JSON:
${includePlanning ? `{
  "_planning": {
    "anti_leak_check": "List any words from the Goal/Conflict that you are tempted to use, and write your concrete alternative here instead.",
    "voice_separation_check": "How will you ensure each character sounds distinct? (e.g. short sentences vs formal words)"
  },
  "paragraphs": ["Paragraph one (2-4 sentences).", "Paragraph two (2-4 sentences).", "Paragraph three.", "Paragraph four."]
}` : `{
  "paragraphs": ["Paragraph one (2-4 sentences).", "Paragraph two (2-4 sentences).", "Paragraph three.", "Paragraph four."]
}`}
IMPORTANT: "paragraphs" MUST be a JSON array of 4-6 strings. Each string = one paragraph. NEVER use a "text" field.`;
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
  "paragraphs": ["Paragraph one (2-4 sentences).", "Paragraph two (2-4 sentences).", "Paragraph three.", "Paragraph four."]
}
IMPORTANT: "paragraphs" MUST be a JSON array of 4-6 strings. Each string = one paragraph. NEVER use a "text" field.`;
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
  const overlyRigid = isGerman
    ? /(dialogue first|40%\s*dialog|30-40%\s*dialog|jedes kapitel.*schmunzel|humor ist pflicht|ohne dialog oder physical action|ohne dialog oder koerperliche aktion|keine abs[aä]tze ohne dialog)/i
    : /(dialogue first|40%\s*dialogue|30-40%\s*dialogue|every chapter needs at least one smile|humor is mandatory|paragraphs without dialogue or physical action)/i;
  const controlLine = buildControlLinePattern(isGerman);
  const lines = base
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !banned.test(line))
    .filter(line => !controlLine.test(line))
    .filter(line => !overlyRigid.test(line));
  const curatedLines = isGerman
    ? [
      "ORIENTATION FIRST: Kapitel 1 darf ruhig und klar beginnen. Nach Absatz 2 muessen WER, WO, WAS und WARUM klar sein.",
      "FOCUS: Meist 2 aktive Figuren pro Kapitel. Weitere Figuren reagieren nur kurz.",
      "DIALOGUE BALANCE: Dialog belebt die Szene, aber Orientierung und Ursache-Folge sind wichtiger als eine starre Quote.",
      "TRANSITIONS: Jeder neue Ort, Hinweis oder Plan braucht einen kurzen Brueckensatz.",
    ]
    : [
      "ORIENTATION FIRST: Chapter 1 may begin quietly and clearly. By paragraph 2, WHO, WHERE, WHAT, and WHY must be clear.",
      "FOCUS: Usually keep 2 active characters per chapter. Others may only react briefly.",
      "DIALOGUE BALANCE: Dialogue should enliven the scene, but clarity and cause-effect matter more than a rigid quota.",
      "TRANSITIONS: Every new place, clue, or plan needs one short bridge sentence.",
    ];
  return [...curatedLines, ...lines].slice(0, 10).join("\n").trim();
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




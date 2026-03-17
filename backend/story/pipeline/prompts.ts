import type { CastSet, SceneDirective, StoryDNA, TaleDNA, AvatarMemoryCompressed, StoryBlueprint } from "./types";
import { getChildFocusNames, getChildFocusSheets, getCoreChapterCharacterNames, isLikelyChildCharacter } from "./character-focus";
import { isGeminiFlashFamilyModel } from "./model-routing";

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
SZENE 0 – CH1 OPENING (Pflicht: WER + WO + AUFTRAG + Erzaehlerstimme):
Okay, also. Mira war acht. Sie hatte IMMER einen Plan. Meistens funktionierte er sogar. (Meistens.)
Ihr Bruder Timo war fuenf und hatte eine einzige Frage an die Welt: "Und dann?"
An diesem Morgen roch die Kueche nach Pfannkuchen. Aber es gab keine Pfannkuchen. Stattdessen stand Mama da, mit einem Korb und einem Gesicht, das sagte: Keine Widerrede.
"Eure Grossmutter ist krank. Bringt ihr das hier." Sie knallte den Korb auf den Tisch. Plopp.
"Darf ich–" "Nein", sagte Mama. So schnell, als waere der Deckel ein Krokodilmaul.

SZENE A – Erzaehler kommentiert + Situationskomik:
Was dann passierte, war — na ja. Sagen wir so: Es war nicht Timos Schuld. Nicht ganz.
Der Ast war nass. Die Schuhe waren glatt. Und der Korb? Der Korb flog. Einfach so.
"TIMO!" Mira stand da, Mund offen, Haende in der Luft.
"War der Baum", sagte Timo. Mit dem Gesicht im Matsch.
(Es war nicht der Baum.)

SZENE B – Dialog treibt Handlung + Koerper-Aktionen:
"Da rein?" Adrian starrte in den Tunnel. "Echt jetzt?"
"Echt jetzt." Alexander kniete sich hin und leuchtete rein. Sein Arm verschwand bis zum Ellbogen.
"Siehst du was?"
"Dunkelheit."
"Super. Genau das wollte ich hoeren." Adrian verschraenkte die Arme. Dann kniete er sich doch hin. "Ich geh vor."
"Du hast gerade noch gesagt–" "Hab ich nicht." Er krabbelte los.

SZENE C – Subtext + Koerpergefuehl:
"Macht mir nichts aus", sagte Adrian. Er stopfte die Haende in die Taschen. Ganz tief. Bis die Naehte spannten.
Sein Magen machte dieses Ding. Dieses kalte Drehen.
Alexander sah ihn an. Sagte nichts. Aber er blieb stehen.
Das war genug.

SZENE D – Running Gag + Wort-Erfindung:
"Was ist das fuer ein Geraeusch?" Mira blieb stehen.
"Klingt wie ein Schnarchwolf", sagte Adrian.
"Schnarchwolf ist kein Wort."
"Ist es jetzt." Er grinste.
(Spoiler: Drei Kapitel spaeter wuerde sich herausstellen, dass es tatsaechlich ein Wolf war. Der schnarchte. Aber das wissen wir noch nicht.)
"""` ;

  const englishExamples = `"""
SCENE 0 – CH1 OPENING (mandatory: WHO + WHERE + MISSION + Narrator voice):
Okay so. Mira was eight. She ALWAYS had a plan. Most of the time it even worked. (Most of the time.)
Her brother Timo was five and had exactly one question for the world: "And then?"
That morning the kitchen smelled like pancakes. But there were no pancakes. Instead Mom stood there with a basket and a face that said: Don't argue.
"Your grandmother is sick. Bring her this." She slammed the basket on the table. Pop.
"Can I—" "No," said Mom. Quick as a crocodile jaw.

SCENE A – Narrator comments + Situational comedy:
What happened next was — well. Let's say this: It wasn't Timo's fault. Not entirely.
The branch was wet. His shoes were slippery. And the basket? The basket flew. Just like that.
"TIMO!" Mira stood there, mouth open, hands in the air.
"It was the tree," said Timo. Face in the mud.
(It was not the tree.)

SCENE B – Dialogue drives action + Body anchors:
"In there?" Adrian stared at the tunnel. "Seriously?"
"Seriously." Alexander knelt and aimed the flashlight in. His arm disappeared up to the elbow.
"See anything?"
"Darkness."
"Great. Exactly what I wanted to hear." Adrian crossed his arms. Then knelt down anyway. "I'll go first."
"You just said—" "No I didn't." He was already crawling.

SCENE C – Subtext + Body feeling:
"I don't care," said Adrian. He stuffed his hands into his pockets. Deep. Until the seams strained.
His stomach did that thing. That cold turning.
Alexander looked at him. Said nothing. But he stayed.
That was enough.
"""`;

  if (isGerman) {
    return `# PROSA-QUALITAET – STUDIERE DIESE BEISPIELE (das ist das Zielniveau)

${germanExamples}

WENDE AUF JEDES KAPITEL AN:
1. ERZAEHLERSTIMME: Du kommentierst, uebertreibst, sprichst den Leser an. Wie ein bester Freund der die Geschichte erzaehlt.
2. DIALOG = 40-50% des Textes. Mindestens 6 Dialogzeilen pro Kapitel. Dialog treibt die Handlung.
3. JEDE Dialogzeile an Koerper-Aktion verankern. NICHT: "sagte er." SONDERN: "rief er und zerrte am Aermel."
4. HUMOR durch Situation, Uebertreibung, Erzaehler-Kommentar. Nie erklaert.
5. RHYTHMUS: Kurz. Kurz. Mittel mit Ueberraschung. Kurz. Wie ein Comic.
6. KOERPER statt Etiketten: "Sein Magen drehte sich" statt "Er war nervoes."
7. SUBTEXT: Was die Figur SAGT ist nicht was sie MEINT.
8. Jede Figur erkennbar ohne Namen — am Satzbau, an Lieblingsworten, an Reaktionen.`;
  }

  return `# PROSE QUALITY REFERENCE – STUDY THESE EXAMPLES (this is the target level)

${englishExamples}

APPLY TO EVERY CHAPTER:
1. NARRATOR VOICE: You comment, exaggerate, address the reader. Like a best friend telling the story.
2. DIALOGUE = 40-50% of text. At least 6 dialogue lines per chapter. Dialogue drives the plot.
3. EVERY dialogue line anchored to body action. NOT: "he said." BUT: "he called, tugging at the sleeve."
4. HUMOR through situation, exaggeration, narrator commentary. Never explained.
5. RHYTHM: Short. Short. Medium with surprise. Short. Like a comic.
6. BODY not labels: "His stomach flipped" not "He was nervous."
7. SUBTEXT: What the character SAYS is not what they MEAN.
8. Each character recognizable without name — by sentence length, favorite words, reactions.`;
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
"their Chapter 1 goal" / "das Ziel aus Kapitel eins" → NEVER reference chapter numbers in prose. Fix: Name the actual thing: "the lost key", "the dying garden".

🚫 NEUTRAL NARRATOR:
Flat, invisible narrator with no personality. → Fix: The narrator comments, jokes, exaggerates, addresses the reader. They are a CHARACTER, not a camera.

🚫 LOW DIALOGUE:
Chapters with 80%+ narration and barely any talking. → Fix: 40-50% of text is dialogue. At least 6 lines per chapter. Dialogue drives the plot.`;
}

function buildGeminiFlashMicroExamplesBlock(isGerman: boolean): string {
  const targetLang = isGerman ? "German" : "English";
  return `# MICRO-EXAMPLES — STUDY THE STRUCTURE (your output language: ${targetLang})

EXAMPLE: Narrator voice + chapter cliffhanger:
Okay, here's the thing about dark corridors: They're never as empty as they look.
Leni ran her fingers along the wall, counting bricks. Twenty-one. Twenty-two. Twenty-three—
"There." She stopped. "Someone pulled this one out."
Ben leaned in. The gap was small. Way too small for him. He looked at Leni.
She was already crawling through. (Of course she was.)
The stone slid back into place behind her with a soft, final click.

EXAMPLE: Dialogue-heavy stakes scene (end of Chapter 1):
"If we lose the feather before midnight," Nova said without looking up, "the garden never wakes again."
"Define never."
"Never-never. Gone-forever-never."
Ben's stomach did that tight pulling thing. He pressed his hands into his pockets and said nothing. Which, for Ben, said everything.

EXAMPLE: Lowpoint + narrator + body reaction (Chapter 3/4):
The map was ruined. Just brown pulp in Ben's fist.
He stared at it. His throat went dry. You know that moment when you KNOW you messed up, but your brain hasn't told your mouth yet?
"It's okay," said Nova. But her voice came out wrong — too quiet, too careful.
It wasn't okay. They both knew it.
Then Flitz squeaked something. Ben looked up.

EXAMPLE: Warm landing + tangible price (Chapter 5 ending):
The garden bloomed again, all at once, like someone had flipped a switch. (Nobody had flipped a switch. But that's what it looked like.)
Nova exhaled. She looked at her hands — the left glove was torn open at the thumb, black with soot.
She folded it over and didn't say anything. Some things cost what they cost.
Ben sat down on the cold stone. "Same time next week?" he said. He was grinning. Which was weird, because his legs were still shaking.`;
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
- mistakeChild: Which child makes the mistake? (THIS child must be the one who grows in Ch4-5!)
- mistake: What does the child do wrong? (MUST be an active choice, NOT bad luck)
- mistakeReason: WHY do they make this mistake? (impatience? pride? fear? — rooted in their CHARACTER TRAIT)
- consequence: What CONCRETE thing breaks, is lost, or goes wrong because of it?
- bodyReaction: How does the child's body react? (stomach drops, throat tightens, hands shake — be specific)
- stuckFeeling: Why does everything feel hopeless now? (1 sentence of inner doubt)
- foreground: Which 2 characters carry this scene?

CHAPTER 4 — DARKEST MOMENT + TURNING POINT:
- worstMoment: What is the WORST situation? (concrete, not abstract)
- almostGivingUp: What does the SAME child from Ch3 SAY or THINK that shows they want to give up?
- insightTrigger: What small detail triggers the insight? (a memory, a friend's earlier words, a pattern noticed)
- newChoice: What does the SAME child from Ch3 decide — DIFFERENTLY than their mistake?
- whoSolves: The CHILD solves it, NOT an adult or artifact. Adults may give hints, but the child decides.
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
- Let dialogue carry scenes whenever it adds friction, warmth, humor, or a clue. Most chapters should feel dialogue-active, but quiet orientation and low-point passages may use less direct speech.
- Pair spoken lines with action or reaction when helpful. Avoid floating quotes and avoid mechanical quote spam.
- Characters must sound DIFFERENT: vary sentence length, vocabulary, and energy level.

::: OUTPUT FORMAT :::
Return JSON only:
{
  "blueprint": {
    "chapter1": { "where": "...", "who": "...", "want": "...", "curiosityHook": "...", "foreground": "...", "humorBeat": "..." },
    "chapter2": { "newElement": "...", "boldChoice": "...", "complication": "...", "openQuestion": "...", "foreground": "...", "humorBeat": "..." },
    "chapter3": { "mistakeChild": "...", "mistake": "...", "mistakeReason": "...", "consequence": "...", "bodyReaction": "...", "stuckFeeling": "...", "foreground": "..." },
    "chapter4": { "worstMoment": "...", "almostGivingUp": "...", "insightTrigger": "...", "newChoice": "...", "whoSolves": "...", "foreground": "..." },
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
    `- Kapitel 1 – EIN NORMALER TAG, DER SCHIEF GEHT: ${blueprint.chapter1.where}. ${blueprint.chapter1.want}.${blueprint.chapter1.stakes ? ` Wenn sie scheitern: ${blueprint.chapter1.stakes}.` : ""} Neugier-Haken: ${blueprint.chapter1.curiosityHook}.${blueprint.chapter1.humorBeat ? ` Schmunzler: ${blueprint.chapter1.humorBeat}.` : ""}`,
    `- Kapitel 2 – DIE ENTDECKUNG: ${blueprint.chapter2.newElement}. Mutige Entscheidung: ${blueprint.chapter2.boldChoice}. Was schiefgeht: ${blueprint.chapter2.complication}.${blueprint.chapter2.humorBeat ? ` Spielmoment: ${blueprint.chapter2.humorBeat}.` : ""}`,
    `- Kapitel 3 – DER MOMENT WO ALLES KIPPT: Das Kind macht einen Fehler: ${blueprint.chapter3.mistake}. Warum: ${blueprint.chapter3.mistakeReason}. Koerpersignal direkt danach: ${blueprint.chapter3.bodyReaction}. Was danach anders ist: ${blueprint.chapter3.consequence}`,
    `- Kapitel 4 – DUNKELSTER MOMENT + WENDEPUNKT: ${blueprint.chapter4.worstMoment}. Fast-Aufgeben: ${blueprint.chapter4.almostGivingUp}. Was den Funken zuendet: ${blueprint.chapter4.insightTrigger}. Neue Entscheidung: ${blueprint.chapter4.newChoice}. Das Kind loest es: ${blueprint.chapter4.whoSolves}`,
    `- Kapitel 5 – DIE LANDUNG: Gewonnen: ${blueprint.chapter5.concreteWin}. Kleiner Preis: ${blueprint.chapter5.smallPrice}. Rueckbezug: ${blueprint.chapter5.ch1Callback}. Schlussbild: ${blueprint.chapter5.finalImage}.${blueprint.chapter5.humorBeat ? ` Letzter Schmunzler: ${blueprint.chapter5.humorBeat}.` : ""}`,
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

  return `Write a 5-chapter children's story in ${outputLang}. EACH chapter MUST have ${wordsPerChapter.min}-${wordsPerChapter.max} words (total ${totalWordMin}-${totalWordMax}). Chapter 5 MUST be the SAME length as chapters 1-4. Short chapters are REJECTED.${umlautRule}
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

QUALITAETSBAR (echte Kinderbuchwirkung statt KI-Regeltext):
- Schreibe die Art von Geschichte, die Kinder weitererzaehlen wuerden: merkbare Figuren, ein starkes Bild, eine peinliche oder mutige Entscheidung, ein kleiner Lacher, ein warmes Ende.
- Zielmix: Gruppenwaerme und Freundschaft, geheimnisvoller Sog, konkrete Komik, klare Kapitelhaken.
- Dialog soll die Szene tragen, aber nicht mechanisch Quote auf Quote stapeln. Meist 25-35% direkte Rede reichen. Tiefpunkt-Kapitel duerfen knapper sein, wenn Spannung und Klarheit gewinnen.
- Erzaehler-Einschuebe nur sparsam und pointiert. Keine Dauer-Klammern, kein Dauer-Spoiler-Ton.
- Jede Figur braucht eigenes Sprechtempo: eine Figur knapp und impulsiv, eine genauer oder trockener, eine dritte falls vorhanden nur kurz und klar.
- Kapitel 1 startet klar und vertraut: Wer? Wo? Was ist der Auftrag? Warum ist er wichtig?
- Kapitel 3: ein kindlicher Fehler aus Uebereifer, Neugier, Angst oder Sturheit.
- Kapitel 4: echter Tiefpunkt, dann eine Einsicht aus Beobachtung, Erinnerung oder Charakterstaerke des Kindes.
- Kapitel 5: konkreter Gewinn, kleiner Preis, warmes physisches Schlussbild und ein leichter Rueckbezug auf Kapitel 1.
- Keine Moral-Saetze. Keine Prompt-Sprache. Keine Platzhalter wie "ploetzlich" oder "auf einmal".
- 4-6 Absätze pro Kapitel, je 2-4 Sätze. Kapitel 5 muss sich genauso voll und verdient anfuehlen wie die anderen.
${humorRule ? `- HUMOR: ${humorRule}` : ""}

SELF-CHECK:
- Klingt das wie ein rundes Kapitel aus einem Kinderbuch und nicht wie eine Aufgabenliste?
- Koennte man jede Hauptfigur am Tonfall erkennen?
- Gibt es in jedem Kapitel mindestens einen konkreten szenischen Moment, nicht nur Erklaerung?
- Ist der Tiefpunkt in Kapitel 4 innen spuerbar und die Loesung nicht vom Artefakt erledigt?
- Endet Kapitel 5 warm, konkret und verdient?

OUTPUT
You MUST return EXACTLY 5 chapter objects: chapters 1, 2, 3, 4, 5. Missing chapters are INVALID.
{
  "title": "Short curiosity-driven title (max 6 words)",
  "description": "One teaser sentence with a question hook",
  "chapters": [
    { "chapter": 1, "paragraphs": ["Paragraph 1.", "Paragraph 2.", "Paragraph 3.", "Paragraph 4."] },
    { "chapter": 2, "paragraphs": ["Paragraph 1.", "Paragraph 2.", "Paragraph 3.", "Paragraph 4."] },
    { "chapter": 3, "paragraphs": ["Paragraph 1.", "Paragraph 2.", "Paragraph 3.", "Paragraph 4."] },
    { "chapter": 4, "paragraphs": ["Paragraph 1.", "Paragraph 2.", "Paragraph 3.", "Paragraph 4."] },
    { "chapter": 5, "paragraphs": ["Paragraph 1.", "Paragraph 2.", "Paragraph 3.", "Paragraph 4."] }
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
- Chapter 3 mistake comes from the child's trait, not bad luck. Include a BODY REACTION (stomach, hands, throat). The child who makes the mistake MUST be the same child who grows in Ch4-5.
- Chapter 4 turning point comes from inside the child — NOT from adults or artifact magic. Helpers may give hints, but the CHILD makes the decision.
- Chapter 5 shows concrete win + small price + callback to chapter 1.
- Max 2 foreground characters per chapter.
- No smell-led opener and no invented accessories. Appearance details only if explicitly locked.

RETURN JSON ONLY:
{
  "blueprint": {
    "chapter1": { "where": "...", "who": "...", "want": "...", "stakes": "...", "curiosityHook": "...", "foreground": "...", "humorBeat": "..." },
    "chapter2": { "newElement": "...", "boldChoice": "...", "complication": "...", "openQuestion": "...", "foreground": "...", "humorBeat": "..." },
    "chapter3": { "mistakeChild": "...", "mistake": "...", "mistakeReason": "...", "consequence": "...", "bodyReaction": "...", "stuckFeeling": "...", "foreground": "..." },
    "chapter4": { "worstMoment": "...", "almostGivingUp": "...", "insightTrigger": "...", "newChoice": "...", "whoSolves": "...", "foreground": "..." },
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
  const isGerman = language === "de";
  if (isGerman) {
    return `Du bist ein erstklassiger Autor fuer moderne Kinderbuecher fuer ${ageRange.min}-${ageRange.max} Jahre.
Zielgefuehl: warm, spannend, humorvoll, konkret, vorlesbar. Denk an die Mischung aus Freundschaft, kleinem Geheimnis, alltagsnaher Magie, echter Kinderperspektive und klarer Szenenfuehrung.

WICHTIGER ALS EFFEKTE:
- starke Szene statt Regelstapel
- unterscheidbare Kinderstimmen
- kleine Geheimnisse, konkrete Hindernisse, echter Tiefpunkt
- Humor aus Verhalten, Missverstaendnissen und Timing
- Wende aus der Figur selbst, nicht aus Magie oder Erwachsenenhilfe
- ein Kind verursacht in Kapitel 3 oder 4 durch einen eigenen Fehler echten Schaden und repariert ihn spaeter aktiv
- Humor verteilt ueber die Geschichte: fruehes Schmunzeln, mittleres Chaos, warmer Callback am Ende

SCHREIBE WIE EIN VERLAGSTEXT:
- klare, lebendige Abschnitte
- gemischter Rhythmus: kurze Saetze an Spannungsstellen, sonst natuerlicher Fluss
- direkte Rede nur dort, wo sie Beziehung, Reibung oder Komik traegt
- Erzähler-Kommentare sparsam: maximal 0-1 augenzwinkernder Einschub pro Kapitel, nie Dauer-Kommentar
- keine Moral-Saetze, keine Listenprosa, keine Prompt-Sprache
- Emotionen ueber Koerper, Blick, Handeln
- Deutsch natuerlich, sauber, mit Umlauten`;
  }
  return `You are a top-tier contemporary children's book author for ages ${ageRange.min}-${ageRange.max}.
Target feel: warm, funny, suspenseful, concrete, highly readable aloud. Blend friendship, a small mystery, everyday magic, and a genuine child point of view.

PRIORITIZE:
- strong scenes over rule-following
- distinct child voices
- concrete stakes, a real low point, and an earned inner turn
- humor from behavior, misunderstanding, and timing
- resolutions driven by the child, not by magic or adults
- a child causes a real setback through a wrong choice in chapter 3 or 4 and later repairs it actively
- spread humor across the story: early smile, mid-story chaos beat, warm callback near the end

WRITE LIKE A PUBLISHED BOOK:
- clear lively paragraphs
- varied rhythm: short sentences at pressure points, natural flow elsewhere
- dialogue only where it sharpens conflict, warmth, or comedy
- narrator asides used sparingly, never constantly
- no moralizing, no report prose, no prompt language
- emotions through body, gaze, and action`;
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
      ? `Sentences: short to medium with clean read-aloud flow. Everyday language. No jargon, no dense metaphor stacks. Longer sentences are fine if they stay crystal clear.`
      : `Medium sentences allowed. Richer vocabulary possible. Balance complex with short punchy sentences.`;

  // Safety
  const safetyRule = "No violence, weapons, blood, horror, bullying, politics/religion, drugs/alcohol.";

  return `Write a 5-chapter children's story in ${outputLang}. EACH chapter MUST have ${wordsPerChapter.min}-${wordsPerChapter.max} words (total ${totalWordMin}-${totalWordMax}). Chapter 5 MUST be the SAME length as chapters 1-4. Short chapters are REJECTED.${umlautRule}
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

GOOD (notice: scene clarity, body, humor, and useful dialogue):
Mama knallte den Korb auf den Tisch. Peng.
"Darf ich–" "Nein", sagte Mama. Schnell wie ein Krokodilmaul.
Mira beugte sich vor. "Da dampft was." "Und es klappert", sagte Timo.
Er tippte gegen den Korb. "Und... das macht Ärger."
Oma kicherte und schob ihm ein Stück Kuchen über den Tisch. "Probier mal." Timo stopfte sich das halbe Stück in den Mund. Krümel flogen. "Mmphf", machte er und grinste breit.

BAD (report-style, no body, no humor, floating dialogue):
Mira und Timo kamen bei Oma an. Sie waren aufgeregt. "Das ist gut", sagte einer von ihnen. Oma lächelte. Sie gab ihnen Kuchen. Alle waren glücklich.

→ Every paragraph needs RHYTHM, BODY (what hands/feet/face do), and scene energy. Dialogue should be anchored to action when it appears. Humor should appear across the story, but not every paragraph needs a joke.

::: RULES :::

::: BESTSELLER RULES (WIE "SCHULE DER MAGISCHEN TIERE", "BITTE NICHT ÖFFNEN", "DIE DREI ??? KIDS") :::

PROSA-HANDWERK:
1. ERZÄHLERSTIMME: Du darfst charmant und leicht augenzwinkernd erzählen, aber sparsam. Ein kleiner Einschub wirkt nur, wenn er wirklich Charme bringt.
2. RHYTHMUS & MELODIE: Spannung braucht Takt. Nutze kurze Sätze an Druckstellen und sonst einen natürlichen Fluss. Keine trägen Satzketten und keine mechanische Taktvorgabe.
3. KEINE BERICHTSPROSA: "Er ging. Sie sagte. Er nickte." -> VERBOTEN. Lass das Setting und die Figuren atmen und interagieren.
4. SINNESDETAILS & KÖRPER: Keine Gefühls-Schubladen wie "Er war nervös". Nutze Sinne: "Sein Hals schnürte sich zu", "Ihre Finger gruben sich in das Holz", "Es roch nach staubigem Plüsch."
5. DIALOG = SUBTEXT: Figuren sagen oft das Gegenteil von dem, was sie fühlen. Ein trotziges "Mir doch egal!", während eine Träne weggewischt wird, zählt.
6. DIALOG-EINSATZ: Nutze direkte Rede dort, wo sie Reibung, Wärme, Witz oder ein Rätsel trägt. Nicht jeder Absatz braucht Dialog, aber Szenen dürfen nie nur berichtet wirken.

FIGUREN-HANDWERK:
7. JEDE Figur klingt ANDERS: Einer poltert furchtlos los, einer murmelt kurze Halbsätze, einer redet hektisch doppelt so schnell.
8. LEBENDIGE WIDERSPRÜCHE: Der supercoole Held zuckt bei einer kleinen Spinne zusammen. Das ängstliche Mädchen wird beim Rätsellösen laut und eifrig.
9. NEBENFIGUREN AKTIVIEREN: Niemand nickt einfach nur. Jeder tut etwas Spezifisches im Raum. Max 2 Fokus-Charaktere in Aktion.

PLOT-HANDWERK:
11. KEIN ARTEFAKT-DEUS-EX-MACHINA: Artefakte weisen den Weg, lösen das Problem aber NIE allein. Das Kind entscheidet.
12. ANTI-FORMEL: Überrasche den Leser. Was offensichtlich passiert, passiert NICHT.
13. SHOW, DON'T TELL (MORAL): "Das Wichtigste ist Freundschaft" ist streng verboten! Zeige es stattdessen (sie fangen sich auf, sie teilen ehrlich).
14. ENDEN LANDEN: Kapitel 5 hat 1 leisen Moment, 1 physisches Detail, 1 augenzwinkernden Callback zu Kapitel 1.
15. Chapters 1-4 MUST end with a cliffhanger or open question!

STRUKTUR:
16. 4-6 Absätze per chapter. Each: 2-4 sentences.
17. Chapter 1: Soft launch. Abs.1 vertraut, Abs.2 Mission+Risiko. Nach Abs.2: WER, WO, WAS, WARUM klar.
18. Chapters 2-5 open by connecting to previous chapter's ending! Keine harten Zeitsprünge wie "Am nächsten Tag".
19. Chapter 3: Kindheitstypischer Fehler (Trotz, Neugier, Übermut). Starke Körperreaktion (flauer Magen, heiße Ohren). 
20. Chapter 4: Das KIND löst das Problem (emotionale Entscheidung). Erwachsene geben höchstens einen Anstoß.
21. Chapter 5: Resolves SAME mission. Concrete win + small price + warm final image. (GLEICHE LÄNGE WIE KAPITEL 1-4!)
22. ${ageRule}
23. ${safetyRule}
24. HUMOR (PFLICHT): 2-3 Smile-Momente über die Story. Purer Quatsch, Situationskomik, lustige Dialoge.
${humorRule ? `25. ${humorRule}` : ""}

::: WORD TARGET (HARD MINIMUM) :::
Total: ${totalWordMin}-${totalWordMax} words. Per chapter: ${wordsPerChapter.min}-${wordsPerChapter.max} words.
IMPORTANT: Each chapter MUST reach at least ${wordsPerChapter.min} words. Short chapters ruin the story. Add meaningful dialogue if you fall short.
Cast lock: only ${allowedNames.join(", ")}. No new names.

::: SELF-CHECK :::
- Gibt es nur dort Erzähler-Einschübe, wo sie echten Charme bringen?
- Fühlen sich die Kapitel szenisch und lebendig an, statt berichtet?
- Gibt es Rhythmuswechsel zwischen Druckstellen und ruhigem Fluss?
- Wurden alle Gefühlslaute ("nervös", "ängstlich") durch körperliche Reaktionen ersetzt?
- Keine platt ausgesprochene Moral?
- Hat Kapitel 5 genau so viel Text wie Kapitel 1-4?
Wenn NEIN → umschreiben!

::: OUTPUT :::
You MUST return EXACTLY 5 chapter objects: chapters 1, 2, 3, 4, 5. Missing chapters are INVALID.
{
  "title": "Short curiosity-driven title (max 6 words)",
  "description": "One teaser sentence with a question hook",
  "chapters": [
    { "chapter": 1, "paragraphs": ["Paragraph 1 (2-4 sentences).", "Paragraph 2.", "Paragraph 3.", "Paragraph 4."] },
    { "chapter": 2, "paragraphs": ["Paragraph 1.", "Paragraph 2.", "Paragraph 3.", "Paragraph 4."] },
    { "chapter": 3, "paragraphs": ["Paragraph 1.", "Paragraph 2.", "Paragraph 3.", "Paragraph 4."] },
    { "chapter": 4, "paragraphs": ["Paragraph 1.", "Paragraph 2.", "Paragraph 3.", "Paragraph 4."] },
    { "chapter": 5, "paragraphs": ["Paragraph 1.", "Paragraph 2.", "Paragraph 3.", "Paragraph 4."] }
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
    return `Du bist der absolute Bestseller-Autor für moderne Kinderbücher (Zielgruppe: ${ageRange.min}-${ageRange.max} Jahre).
Dein Stil ist ein unwiderstehlicher Genremix: Die Magie, Freundschaft und das Schul-Setting von "Die Schule der magischen Tiere", der mysteriöse Witz und die Spannung aus "Bitte nicht öffnen", das charmante Tierchaos aus "Die Haferhorde" und die geniale rotzfreche Alltags-Komik à la "Mein Lotta-Leben" oder "Oma macht das Internet kaputt".

SCHREIBPROZESS — So schaffst du diese Premium-Qualität:
1. Plane den Absatz: Wer spricht? Welches Geheimnis, Konkurrenzkampf oder Chaos liegt in der Luft?
2. Schreibe DIALOG ZUERST — Lass die Figuren clever, rotzfrech oder tollpatschig raushauen, was sie (nicht) denken.
3. Füge lebendige, sinnliche Körperaktions-Beats und funkelnde Erzähler-Kommentare hinzu.
4. Lese-Flow-Prüfung: Klingt es musikalisch, als wolltest du es sofort laut und enthusiastisch vorlesen?

ERZÄHLERSTIMME (PFLICHT) — Du bist der augenzwinkernde Verbündete des Lesers:
FALSCH: "Adrian öffnete die Tür. Er ging hinein."
RICHTIG: "Adrian drückte die Klinke nach unten. Was dahinter wartete? Tja. Sagen wir so: Es war garantiert kein langweiliger Besenschrank. (Es war im Übrigen auch nicht das, was IHR jetzt denkt.)"
- Pro Kapitel MUSS es 3-4 direkte Ansprachen, lustige Warnungen oder ironische Klammern geben.
- Spiel mit dem Leser! "(Spoiler: Das war gelogen.)" / "Hättet ihr diese Kiste aufgemacht? Eben. Adrian auch nicht. Eigentlich."

DIALOG (40-50% des Textes) — Das Herzstück eines Bestsellers:
FALSCH (abgelehnt, zu langweilig): Er sah in den Brunnen. Das Wasser war dunkel. Er trat zurück.
RICHTIG (bestseller-like!): 
  "Da rein?" Er starrte in das pechschwarze Loch voller Grusel. "Vergiss es."
  "Ich geh vor." Alexander kniete sich schon in den Matsch.
  "Spinnst du?!" Adrian packte ihn panisch am Ärmel.
  "Da unten leuchtet was." "Wo?" "Daaaa!" 
- Mindestens 10 knackige Sätze Dialog pro Kapitel! Jede Äußerung mit Mimik, Gestik oder Action gepaart.
- SUBTEXT! Kinder sind Meister darin, NICHT das zu sagen, was sie fühlen. Wer "Mir doch absolut schnurz" sagt, der fummelt gleichzeitig fieberhaft an seinem Pulloverbündchen herum.

SPRACHMELODIE & VORLESE-RHYTHMUS:
FALSCH: "Er rannte schnell zur klappernden Tür und zerrte wie wild daran, aber sie klemmte so stark, dass absolut nichts passierte."
RICHTIG: "Er rannte los. Riss an der Türklinke. Nichts. Nicht mal ein Wackeln. Na toll."
- Beat für Beat: Jeder dritte Satz sollte rasant und ultrakurz sein (1-5 Wörter). 
- Lass die Sätze knallen. Verzichte komplett auf träge Bandwurmsätze! Niemals 3 lange Sätze nacheinander.

HUMOR, CHAOS & WÄRME:
- Körperkomik: Ein epischer Plan, der an einem Nieser scheitert. Verheddern, Stolpern, zu lautes Atmen in der Stille.
- Wortwitz: Erfinde lustige Quatsch-Begriffe der Kinder ("Obermega-Schnarchnasen-Aktion").
- Wärme: Mitten im reinsten Grusel oder Chaos gibt es den Moment der Solidarität. Ein anerkennendes Nicken, ein halber Keks.

KÖRPER & SINNE (Show, don't tell!):
VERBOTEN (wird radikal abgestraft): "Er fühlte sich nervös." / "Sie war sehr traurig." / "Er hatte glatt Angst."
RICHTIG: "Sein kompletter Mageninhalt fuhr Achterbahn." / "Das Herz hämmerte in ihren Ohren wie eine wilde Buschtrommel." / "Der Geruch nach nassem Staub ließ ihn blinzeln."

TABUS (Jeder Verstoß bedeutet Ablehnung der Geschichte):
- KEINE platt servierte, moralische Lehre! ("So verstanden sie, dass Lügen böse ist"). Moral wird nur GEZEIGT, nie verkündet!
- KEINE "Plötzlich..." oder "Auf einmal..." (Mach die Aktion ohne Ankündigung!)
- Format: Keine Mini-Kapitel! Jedes Kapitel hat ein starkes erzählerisches Gewicht. Arrays aus 4-6 Textblöcken.
- Perfektes, fließendes Deutsch, Umlaute korrekt.`;
  }
  return `You are an award-winning children's book author. Your style: Roald Dahl, Jeff Kinney (Wimpy Kid), Dav Pilkey (Dog Man). Target: ${ageRange.min}-${ageRange.max} years.

WRITING PROCESS — work like this:
1. Plan each paragraph: Who speaks? What do they want? What do they NOT say?
2. Write DIALOGUE FIRST — then add body actions and narrator commentary.
3. Check: Does EVERY sentence sound different from the one before? Could you identify the character without names?

NARRATOR VOICE — you are NOT invisible. You are the funny best friend:
WRONG: "Adrian opened the door. He went inside."
RIGHT: "Adrian opened the door. What was behind it? Well. Let's just say: It wasn't what he expected. (It wasn't what YOU expected either.)"
- Narrator interjections are optional and should stay sparse. Use them only when they genuinely add charm or comic timing.
- Patterns: "(Spoiler: That was a lie.)" / "And then — no, wait." / "What? Yes. Really."

DIALOGUE — scene-driven, not quota-driven:
WRONG: Adrian went to the door. He opened it. Alexander followed. They walked down the hallway.
RIGHT: "In there?" Adrian stared at the tunnel. "Seriously?"
"Seriously." Alexander was already on his knees.
"See anything?" "Darkness." "Great."
- Use dialogue whenever it sharpens friction, humor, warmth, or mystery. Quiet passages without dialogue are allowed.
- Kids interrupt. Talk around things. Don't say what they mean.
- SUBTEXT: "I don't care." (Hands stuffed deep in pockets, seams straining.) = He cares SO MUCH.

SENTENCE RHYTHM — write like a comic:
WRONG: "He went to the door and carefully opened it while Alexander waited behind him."
RIGHT: "He went to the door. Pressed the handle. Nothing. Great."
- Use short sentences at pressure points, but keep the overall rhythm natural and easy to read aloud.
- FORBIDDEN: 3+ medium sentences in a row.
- Vary sentence openings. Never 3x "He..." in a row.

HUMOR — required in ch.1-3 and ch.5:
- Physical comedy: Someone stumbles, chokes, forgets to breathe.
- Narrator comment: "(It was not the tree.)" / "(Spoiler: It gets worse.)"
- Word inventions: "snore-wolf", "nonsense-bush", "giggle-attack".
- Running gag: 1 thing returns 2-3x, each time more absurd.
- Ch.4 may be serious — humor returns in ch.5.

CHARACTER VOICES — each character has DNA:
WRONG: "Let's go!" said Adrian. "Yes!" said Alexander. "Okay!" said Mia.
RIGHT: "Hmm." Adrian tilted his head. "Something's off."
  "IN THERE!" Alexander was already halfway in.
  "So-I-once-read-that—" Mia talked so fast the words stuck together.
- Each kid needs: own sentence length, own favorite words, own body language.

EMOTIONS — always BODY, never labels:
FORBIDDEN: "He was sad." / "She felt happy." / "He was nervous."
RIGHT: "His stomach did that thing. That cold turning." / "Her hands trembled."

TABOOS:
- NO moral sentences: "He learned that..." / "The most important thing was..." / "He didn't need X to be Y."
- NO report style: "Then they went..." / "The next day..."
- NO emotion labels: "nervous", "sad", "happy", "afraid" as narration.
- NO name more than 7x per chapter. Use pronouns and context.

FORMAT: Paragraphs 2-4 sentences. Chapters = JSON array of 4-6 paragraph strings.
Write exclusively in English. No jargon.`;
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

  return `TASK: Rewrite this story. Fix ONLY the listed issues. Do not invent new plot points.

MUST FIX:
${qualityIssues || "- General prose improvement needed."}
${blueprintHint}
REWRITE FOCUS:
- Baue Kapitel wie echte Szenen um, nicht wie eine Reparaturliste.
- Dialog gezielt staerken: nur dort erhoehen, wo Reibung, Humor, Angst oder Naehe entstehen. Keine Quote-Maschine.
- Verteile Humor bewusst: frueher Schmunzelmoment, spaeter Entlastung, am Ende ein warmer kleiner Lacher.
- Lege vor dem Umschreiben fuer jede Hauptfigur eine klare Sprechsignatur fest (Rhythmus + typische Woerter).
- Erzähler-Kommentare nur sparsam und nur wenn sie wirklich Charme bringen.
- Rhythmus vorlesbar halten: kurze Saetze an Druckstellen, sonst natuerlicher Mischrhythmus.
- Kapitel 4: Die innere Wende gehoert dem Kind. Kein Artefakt, kein Erwachsener loest das Kernproblem.
- Kapitel 5: konkreter Gewinn + kleiner Preis + Rueckbezug auf das Anfangsziel.
- Emotions = body, never labels. Each character sounds different WITHOUT name tags.
- Ch2-5: FIRST sentence connects to LAST moment of previous chapter.
- EVERY chapter: ${wordsPerChapter.min}-${wordsPerChapter.max} words. INCLUDING chapter 5!
- No name more than 7x per chapter.

HARD RULES:
- Language: ONLY ${outputLang}.${umlautRule}
- Length: ${totalWordMin}-${totalWordMax} words. Chapters: ${wordsPerChapter.min}-${wordsPerChapter.max}.
- Cast: ${allNames}. No new names.
${stylePackBlock ? `\nSTYLE:\n${stylePackBlock}` : ""}

ORIGINAL DRAFT:
${originalText}

SELF-CHECK before output: stronger scene? clearer voices? no artifact deus-ex? no moral sentence? chapter 5 concrete and warm?

OUTPUT:
{
  "title": "Story title",
  "description": "Teaser sentence",
  "chapters": [
    { "chapter": 1, "paragraphs": ["Paragraph 1.", "Paragraph 2.", "Paragraph 3.", "Paragraph 4."] }
  ]
}
"paragraphs" = JSON array of 4-6 strings. Each = one paragraph.`;
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
  const isGeminiFlashModel = isGeminiFlashFamilyModel(modelName);
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
      ? `AGE GROUP ${ageMin}-${ageMax}: Short to medium sentences with clean read-aloud flow. Everyday conversational language. No jargon or dense metaphor stacks. Longer sentences are allowed when they stay crystal clear. The output language is ${outputLang} but these structural rules always apply.`
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
14. Chapter 1 sentence 1 MUST contain the lead child name or the concrete problem object. No scenic throat-clearing.
15. Chapter 3 or 4 MUST show a child-made wrong choice causing the setback. Bad luck alone is not enough.
16. Plan 3 humor beats across the story: one by Ch2, one by Ch3 or Ch4, one warm/light callback in Ch5.
17. Before each chapter, lock the 2 foreground voices: one rhythm cue + one word-choice cue per child.

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
    FORBIDDEN: Starting in the middle of action ("Adrian rannte durch den Wald..."). FORBIDDEN: smell-led openings like "Es roch nach...". REQUIRED: Start with the world and the people in it. Sentence 1 must already name the lead child or the concrete problem object.
  PARAGRAPH 2 – THE MISSION (mandatory): An adult/authority figure gives the characters a clear task. State WHAT they must do and WHY in simple language. Any child must be able to repeat the mission after reading this paragraph.
  PARAGRAPH 3 – FIRST STEP / HOOK: The characters set out. Something small goes slightly wrong or mysterious. The question forms.
  FINAL PARAGRAPH – STAKES: State CONCRETELY what is lost if they fail. End on unresolved tension — a sound, a shadow, a question unanswered.
  Conflict starts in Chapter 2. Not before.
- Chapter 2: DISCOVERY + TEMPTATION. One exciting thing appears. One character wants to take a shortcut. Chapter ends with a door slamming, a trap springing, a wrong choice — unresolved.
- Chapter 3: COMPLICATION + SETBACK. A CHILD'S wrong choice or shortcut causes the setback. Something breaks or is lost. Within the NEXT 2 sentences after the mistake, show one body signal (stomach / hands / throat / face) and one short self-justifying line from that child. Characters feel stuck — before one small idea emerges. Chapter ends mid-action or with a new danger.
- Chapter 4: DARKEST MOMENT → TURNING POINT. The worst thing happens. Before any repair works, the SAME child must admit the mistake aloud in one short line and choose a DIFFERENT action. Outside need may reveal the clue, but the turn starts with the child's confession/decision, not with the world solving it.
- Chapter 5: RESOLUTION + CALLBACK + SMALL PRICE. Show EXACTLY what was won in the first half of the chapter. Connect back to Chapter 1's opening image or problem. Include ONE small tangible loss (torn glove, lost hat, missed dinner). Final image: specific and warm, not a moral statement.

::: OUTPUT FORMAT :::
Write a JSON object:

{
  "_planning": {
    "voice_signatures": { "[char1]": "style + 2 words", "[char2]": "style + 2 words" },
    "ch1_intro_check": "List each character in Ch1 + one action cue or locked canon detail + their spoken line",
    "humor_beats": { "ch1_or_2": "playful beat", "ch3_or_4": "relief or friction laugh", "ch5": "warm callback smile" },
    "mistake_growth_arc": { "mistake_child": "name", "wrong_choice": "short", "lesson_in_ch4": "short", "different_action_in_ch5": "short" },
    "obstacles": { "ch1": "none (orientation)", "ch2": "type", "ch3": "type", "ch4": "type", "ch5": "type" },
    "payoff_and_price": "Ch5: what is won (concrete) + what small thing is lost",
    "read_aloud_guards": ["one sentence to simplify", "one dialogue exchange to sharpen"]
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
  6. ** HUMOR + PAYOFF DISTRIBUTION **
    Add 2-3 child-friendly smile moments across the story and make the final one feel like a callback, not a random joke.
    The mistake child must act differently in Chapter 5, visibly and concretely.

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
      "humor_repairs": ["where a smile moment returns", "which chapter gets relief humor"],
      "mistake_growth_fix": "How the child clearly acts differently in Chapter 5",
      "read_aloud_repairs": ["1 clumsy sentence I will simplify", "1 dialogue exchange I will sharpen"],
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
  const artifactAlreadyPresent = hasArtifactReference([originalText, previousContext], artifactName);

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
Expand the chapter without changing the plot. Add concrete dialogue + action beats, not vague padding.

# SCENE
- Setting: ${sanitizeDirectiveNarrativeText(chapter.setting)}, Mood: ${chapter.mood ?? "COZY"}
- Goal: ${sanitizeDirectiveNarrativeText(chapter.goal)}
- Foreground: ${chapterFocusNames.join(", ") || allowedNames} | All allowed: ${allowedNames}
${supportNames.length > 0 ? `- Support: ${supportNames.join(", ")} (brief reaction only)` : ""}
${artifactName && chapter.artifactUsage && artifactAlreadyPresent ? `- Artifact: ${artifactName} (${sanitizeDirectiveNarrativeText(chapter.artifactUsage)})` : ""}
${artifactName && !artifactAlreadyPresent ? `- Artifact: ${artifactName} NOT on stage. Do not introduce.` : ""}
- Tone: ${tone ?? dna.toneBounds?.targetTone ?? "warm"}, Age: ${ageRange.min}-${ageRange.max}
${missingLine}

# TARGET: ${lengthTargets.wordMin}-${lengthTargets.wordMax} words, ${lengthTargets.sentenceMin}-${lengthTargets.sentenceMax} sentences

# RULES
1. NARRATOR VOICE: A tiny narrator wink is allowed if it adds charm, but never force commentary into the chapter.
2. ONLY these names: ${allowedNames}. No new characters. Max ${focusMaxActive} active, ideal ${focusIdealRange}.
3. Emotions through body, never labels. FALSCH: "Er war nervoes." RICHTIG: "Sein Magen drehte sich." Keep the rhythm read-aloud friendly. Split only sentences that feel overloaded or clumsy.
4. Use dialogue where friction, warmth, humor, or clues happen. Quiet paragraphs without dialogue are allowed. Each character sounds different.
5. At least 1 inner child-moment of ${emotionalFocus} (body signal + thought).
6. No meta-labels, no Goal/Conflict text in prose, no moral summary.
7. Max 1 comparison per paragraph. Running gag max 2x.
8. ${isGerman ? "Korrekte deutsche Umlaute. Keine ae/oe/ue. Keine englischen Woerter." : ""}
9. Double quotes "..." for dialogue. No possessive name+noun ("Adrians Magen" → "sein Magen").
10. Never introduce artifact if not already in original text.

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
  const artifactAlreadyPresent = hasArtifactReference([originalText, previousContext], artifactName);
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
Target quality: published children's fiction with clear scene work, distinct voices, emotional subtext, and read-aloud flow. Never report-style prose.

CRITICAL PLOT PRESERVATION:
- Keep the SAME events, characters, dialogue, and ending as the original.
- You may ADD lines, REPHRASE sentences, or REMOVE weak phrases.
- You must NOT replace the plot, invent new scenes, or change what happens.
- The revised chapter must be recognizably the same story as the original.
- Keep roughly the SAME chapter length. Do not compress the scene or remove whole beats.

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
1) Only these names: ${allowedNames || "none"}. No new characters.
2) ${lengthTargets.wordMin}-${lengthTargets.wordMax} words. Paragraphs 2-4 sentences. Use as much dialogue as the scene truly needs, usually dialogue-rich but never mechanical.
3) Emotions through body, never labels. Each character sounds different.
4) No meta-labels, no Goal/Conflict text in prose. No report chains.
5) ${isGerman ? "Korrekte Umlaute. Keine ae/oe/ue. Keine englischen Woerter." : ""}
6) Double quotes for dialogue. No possessive name+noun ("Adrians Magen" → "sein Magen").
7) Running gag max 2x. Max 1 comparison per paragraph.
8) Never introduce artifact if not in original text.

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

function hasArtifactReference(texts: Array<string | undefined>, artifactName?: string): boolean {
  const normalizedArtifact = normalizeArtifactToken(artifactName);
  if (!normalizedArtifact) return false;

  const candidateTokens = new Set<string>([normalizedArtifact]);
  for (const token of normalizedArtifact.split(/[\s-]+/).filter(Boolean)) {
    if (token.length >= 5) candidateTokens.add(token);
  }
  if (normalizedArtifact.length >= 6) {
    candidateTokens.add(normalizedArtifact.slice(-6));
  }
  if (normalizedArtifact.length >= 8) {
    candidateTokens.add(normalizedArtifact.slice(-8));
  }

  return texts.some((text) => {
    const normalizedText = normalizeArtifactToken(text);
    if (!normalizedText) return false;
    for (const token of candidateTokens) {
      if (token.length >= 5 && normalizedText.includes(token)) {
        return true;
      }
    }
    return false;
  });
}

function normalizeArtifactToken(value?: string): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9äöü-]+/g, "");
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
    ? /(jedes kapitel.*schmunzel|humor ist pflicht)/i
    : /(every chapter needs at least one smile|humor is mandatory)/i;
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
      "DIALOGUE SUPPORTS SCENES: Dialog soll Reibung, Waerme, Witz oder Hinweise tragen. Ruhige Passagen sind erlaubt, aber ein Kapitel darf nicht nur berichtet wirken.",
      "TRANSITIONS: Jeder neue Ort, Hinweis oder Plan braucht einen kurzen Brueckensatz.",
    ]
    : [
      "ORIENTATION FIRST: Chapter 1 may begin quietly and clearly. By paragraph 2, WHO, WHERE, WHAT, and WHY must be clear.",
      "FOCUS: Usually keep 2 active characters per chapter. Others may only react briefly.",
      "DIALOGUE SUPPORTS SCENES: Dialogue should carry friction, warmth, humor, or clues. Quiet passages are allowed, but a chapter must not read like report prose.",
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




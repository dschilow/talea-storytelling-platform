import type { CastSet, SceneDirective, StoryDNA, TaleDNA } from "./types";

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

  if (isGerman) {
    return `You are a professional children's story author.

Write Chapter ${chapter.chapter} for a ${ageRange.min}-${ageRange.max} year old audience in German.
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
3) No stage directions, no meta commentary, no English text in the output.
4) Each character must have a concrete action or short line; no name lists.
5) Mention the artifact if required (by name).
6) Write ${lengthTargets.wordMin}-${lengthTargets.wordMax} words, ${lengthTargets.sentenceMin}-${lengthTargets.sentenceMax} sentences, age-appropriate.
7) No placeholder chapters. If the scene feels short, expand with a concrete action sequence + 2-3 short dialogue lines.
8) Children's-book style: vivid imagery, rhythmic flow, varied sentence starts, occasional dialogue.
9) Do not state belonging explicitly; show it through actions. Avoid phrases like "always been part of this tale".
10) Avoid stock phrases like "makes an important decision", "has a special idea", "shows a new ability", "feels the tension", "decisive clue", "important hint", "question that unties the knot".
11) Avatars and supporting characters must be actively involved, not just present.
12) Chapter title must be a curiosity hook, not "Chapter X".
13) End with a gentle forward-looking line (except final chapter).
${strict ? "14) Double-check that no English sentence appears in the German output." : ""}

Return JSON:
{ "title": "Short chapter title", "text": "Chapter text" }`;
  }

  return `You are a professional children's story author.

Write Chapter ${chapter.chapter} for a ${ageRange.min}-${ageRange.max} year old audience in ${language}.
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

  if (isGerman) {
    return `Revise the chapter below to satisfy the rules without losing the plot. Write the output in German.

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
3) No meta text or instructions in the output.
3b) Do NOT output headings or labels like "Ort:", "Stimmung:", "Ziel:", "Hindernis:", "Handlung:", "Action:", "Mini-Problem:", "Mini-Aufloesung:", "Mini-Resolution:", "Hook:", "Ausblick:", "Epilog:", "Scene:", "Mood:", "Goal:", "Obstacle:", "Outlook:", "Sichtbare Aktion:", "Aktion fortgesetzt:", "Visible action:", "Action continued:". Also never start sentences with "Ihr Ziel war", "Ein Hindernis war", "Her goal was", "An obstacle was".
4) Every character must act or speak.
5) Do not state belonging explicitly; avoid "always been part of this tale".
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

  return `Revise the chapter below to satisfy the rules without losing the plot.

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
  const { chapter, cast, dna, language, ageRange, tone, lengthTargets, stylePackText, originalText, previousContext, nextContext, requiredCharacters } = input;
  const isGerman = language === "de";
  const artifactName = cast.artifact?.name?.trim();
  const characterNames = chapter.charactersOnStage
    .map(slot => findCharacterBySlot(cast, slot)?.displayName)
    .filter(Boolean) as string[];
  const allowedNames = Array.from(new Set(characterNames)).join(", ");

  const prev = previousContext ? `PREVIOUS CHAPTER CONTEXT:\n${previousContext}\n` : "";
  const next = nextContext ? `NEXT CHAPTER CONTEXT:\n${nextContext}\n` : "";
  const missingLine = requiredCharacters?.length
    ? `MISSING CHARACTERS (MUST INSERT): ${requiredCharacters.join(", ")}.\nEach missing character must be named, perform a concrete action, and speak at least one short line of dialogue.`
    : "";

  return `Expand the chapter below without changing the plot. Keep continuity with adjacent chapters. Write the output in ${isGerman ? "German" : language}.

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
3) No meta text or instructions.
3b) Do NOT output headings or labels like "Ort:", "Stimmung:", "Ziel:", "Hindernis:", "Handlung:", "Action:", "Mini-Problem:", "Mini-Aufloesung:", "Mini-Resolution:", "Hook:", "Ausblick:", "Epilog:", "Scene:", "Mood:", "Goal:", "Obstacle:", "Outlook:", "Sichtbare Aktion:", "Aktion fortgesetzt:", "Visible action:", "Action continued:". Also never start sentences with "Ihr Ziel war", "Ein Hindernis war", "Her goal was", "An obstacle was".
4) Add a concrete action sequence + 2-3 short dialogue lines.
5) Keep the original plot beats and setting; just expand the scene.
6) Avoid template phrases like "important decision", "decisive clue", "special idea", "new ability", "felt the tension".
7) Target ${lengthTargets.wordMin}-${lengthTargets.wordMax} words, ${lengthTargets.sentenceMin}-${lengthTargets.sentenceMax} sentences.
${missingLine ? `8) ${missingLine}\n` : ""}

${prev}${next}
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

// ─── Full Story Prompt (all chapters in one call) ───────────────────────────
// OPTIMIZED V2: More compact, uses full character properties from DB
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
}): string {
  const { directives, cast, dna, language, ageRange, tone, totalWordMin, totalWordMax, wordsPerChapter, fusionSections } = input;
  const isGerman = language === "de";
  const artifactName = cast.artifact?.name?.trim();
  const artifactRule = cast.artifact?.storyUseRule || "important object";

  // Collect all unique character names
  const allSlots = new Set(directives.flatMap(d => d.charactersOnStage));
  const allowedNames: string[] = [];

  // Build compact character profiles with full DB properties
  const characterLines: string[] = [];
  for (const slot of allSlots) {
    const sheet = findCharacterBySlot(cast, slot);
    if (!sheet || slot.includes("ARTIFACT")) continue;
    allowedNames.push(sheet.displayName);

    const ep = sheet.enhancedPersonality;
    const personality = sheet.personalityTags?.slice(0, 4).join(", ") || ep?.dominant || "neugierig";
    const speechStyle = sheet.speechStyleHints?.slice(0, 2).join(", ") || "normal";

    // Compact one-line format: Name (age?): personality; spricht speechStyle.
    let line = `- ${sheet.displayName}`;
    if (sheet.roleType === "AVATAR") {
      line += ` (Kind)`;
    }
    line += `: ${personality}; spricht ${speechStyle}.`;

    // Add catchphrase with context if available
    if (ep?.catchphrase) {
      const context = (sheet as any).catchphraseContext || ep.emotionalTriggers?.[0] || "";
      line += ` Spruch: „${ep.catchphrase}"${context ? ` (${context})` : ""}.`;
    }

    // Add quirk if available
    if (ep?.quirk) {
      line += ` Marotte: ${ep.quirk}.`;
    }

    characterLines.push(line);
  }

  // Build compact chapter outline (Setting + Hook only)
  const chapterOutlines = directives.map((d, idx) => {
    const charsOnStage = d.charactersOnStage
      .filter(s => !s.includes("ARTIFACT"))
      .map(s => findCharacterBySlot(cast, s)?.displayName)
      .filter(Boolean)
      .join(", ");

    const isLast = idx === directives.length - 1;

    // Compact format: Chapter N (Setting): Goal. Hook: ...
    let outline = `${idx + 1}. ${d.setting}: ${d.goal}`;
    if (d.artifactUsage && !d.artifactUsage.toLowerCase().includes("nicht genutzt")) {
      outline += ` [${artifactName}]`;
    }
    outline += ` Figuren: ${charsOnStage}.`;
    if (!isLast && d.outcome) {
      outline += ` Hook: ${d.outcome.substring(0, 60)}...`;
    }

    // Add fusion hints if available (compact)
    const fusionBlock = fusionSections?.get(d.chapter);
    if (fusionBlock) {
      const compactFusion = fusionBlock.split("\n").slice(0, 2).join("; ");
      outline += ` [${compactFusion}]`;
    }

    return outline;
  }).join("\n");

  // Build recurring motifs from character quirks/catchphrases
  const motifs: string[] = [];
  for (const slot of allSlots) {
    const sheet = findCharacterBySlot(cast, slot);
    if (!sheet) continue;
    const ep = sheet.enhancedPersonality;
    if (ep?.quirk && motifs.length < 3) {
      motifs.push(`- ${sheet.displayName} ${ep.quirk} (spielerisch, wiederkehrend)`);
    }
  }

  // Determine age-specific style
  const ageStyle = ageRange.max <= 5
    ? "Sehr kurze Sätze, sanfte Wiederholung, 1 Hauptproblem, sichere Auflösung."
    : ageRange.max <= 8
      ? "Mehr Dialog, kleine Rätsel, spielerische Spannung, klare Hooks."
      : ageRange.max <= 12
        ? "Stärkere Motive, schärfere Wendungen, tiefere Emotionen, kindgerecht."
        : "Dichterer Stil, moralische Nuancen, größere Wendungen.";

  if (isGerman) {
    return `# Rolle und Zielsetzung
- Du bist: Preisgekrönter Kinderbuchautor.
- Ziel: Verfasse eine vollständige Kinderbuchgeschichte auf Deutsch. Nur JSON-Output.

# Zielgruppe
- ${ageRange.min}–${ageRange.max} Jahre
- Stil: ${ageStyle}

# Tonfall
- ${tone || dna.toneBounds?.targetTone || "Warm"}, witzig, spannend – niemals zynisch.

# Stilregeln
- Kurze, klare Absätze; lebendige Bilder; klare Ursache–Wirkung
- Handlung wird durch Dialog vorangetrieben (2–6 Dialogzeilen pro Kapitel)
- Pro Kapitel max. 1–2 poetische Bilder/Vergleiche

# Harte Regeln (Quality-Gates)
1. **Sprache**: Alle Textfelder ausschließlich auf Deutsch. Keine englischen Wörter.
2. **Länge**: Gesamt: ${totalWordMin}–${totalWordMax} Wörter. Pro Kapitel: ${wordsPerChapter.min}–${wordsPerChapter.max} Wörter (obere Hälfte bevorzugt). Keine Mini-Kapitel.
3. **Kapitelbau**: Jedes Kapitel enthält in Prosa: (a) Ort+Stimmung, (b) klares Vorhaben, (c) Schwierigkeit, (d) sichtbare Handlung (Verb+Objekt), (e) Fortschritt, (f) letzter Satz = sanfter Hook (außer letztes Kapitel).
4. **Keine Labels**: Im Kapiteltext keine Begriffe wie „Ort:", „Ziel:", „Hook:" – nur Erzählprosa.
5. **Cast-Lock**: Nur diese Namen: ${allowedNames.join(", ")}. Keine neuen Figuren. Hintergrundfiguren unbenannt.
6. **Kontinuität**: Roter Faden. Entscheidungen wirken nach. Keine abrupten Ortswechsel ohne Übergangssatz.
7. **Aktive Figuren**: Jede Figur nimmt aktiv Einfluss. Mind. 3–4 Figuren agieren pro Kapitel sichtbar.
8. **Wiederholungsschutz**: Keine identischen Sätze über Kapitel. Keine Füllwörter („plötzlich", „irgendwie"). Keine Floskeln wie „entscheidender Hinweis" – zeigen statt sagen.
9. **Charakter-Stimmen**: Jede Figur hat eine einzigartige Stimme im Dialog (gemäß Sprachstil). Sprüche genau 1x verwenden. Marotten zeigen.
${artifactName ? `10. **Artefakt-Bogen**: ${artifactName} wird in Kap 1–2 eingeführt, führt in Kap 2–3 fehl, hilft in Kap 4–5 entscheidend. Mind. 2 aktive Szenen.` : ""}
11. **Ende**: Letztes Kapitel löst Konflikt durch Szene (Dialog+Handlung), zeigt kleine Lektion ohne Predigt, endet mit warmem Schlussbild + kurzem Epilog (2–4 Sätze).

# Figuren (nur diese erlauben)
${characterLines.join("\n")}
${artifactName ? `\n# Artefakt\n- ${artifactName}: ${artifactRule}` : ""}

${motifs.length > 0 ? `# Wiederkehrende Motive\n${motifs.join("\n")}` : ""}

# Kapitelstruktur (Orientierung, NICHT wörtlich übernehmen)
${chapterOutlines}

# Output Format
Gib ausschließlich gültiges JSON zurück:
\`\`\`json
{
  "title": "Kurzer Titel (max 7 Wörter)",
  "description": "Ein Satz als Teaser",
  "chapters": [
    { "chapter": 1, "title": "Kapiteltitel", "text": "Kapiteltext..." },
    { "chapter": 2, "title": "Kapiteltitel", "text": "Kapiteltext..." },
    ...
  ]
}
\`\`\``;
  }

  // English version
  return `# Role and Goal
- You are: Award-winning children's book author.
- Goal: Write a complete children's story in ${language}. Only JSON output.

# Target Audience
- ${ageRange.min}–${ageRange.max} years old
- Style: ${ageStyle}

# Tone
- ${tone || dna.toneBounds?.targetTone || "Warm"}, witty, exciting – never cynical.

# Style Rules
- Short, clear paragraphs; vivid imagery; clear cause-effect
- Plot driven by dialogue (2–6 dialogue lines per chapter)
- Max 1–2 poetic images/similes per chapter

# Hard Rules (Quality Gates)
1. **Language**: All text fields in ${language} only.
2. **Length**: Total: ${totalWordMin}–${totalWordMax} words. Per chapter: ${wordsPerChapter.min}–${wordsPerChapter.max} words (upper half preferred). No mini-chapters.
3. **Chapter Structure**: Each chapter in prose: (a) setting+mood, (b) clear goal, (c) difficulty, (d) visible action (verb+object), (e) progress, (f) last sentence = gentle hook (except final chapter).
4. **No Labels**: No terms like "Setting:", "Goal:", "Hook:" in chapter text – only narrative prose.
5. **Cast Lock**: Only these names: ${allowedNames.join(", ")}. No new characters. Background figures unnamed.
6. **Continuity**: Red thread. Decisions carry over. No abrupt location changes without transition.
7. **Active Characters**: Every character influences the plot actively. At least 3–4 characters act visibly per chapter.
8. **Anti-Repetition**: No identical sentences across chapters. No filler words ("suddenly", "somehow"). No clichés like "decisive clue" – show don't tell.
9. **Character Voices**: Each character has a unique voice in dialogue (per speech style). Use catchphrases exactly 1x. Show quirks.
${artifactName ? `10. **Artifact Arc**: ${artifactName} introduced in ch 1–2, fails/misleads in ch 2–3, helps decisively in ch 4–5. At least 2 active scenes.` : ""}
11. **Ending**: Final chapter resolves conflict through scene (dialogue+action), shows small lesson without preaching, ends with warm closing image + short epilogue (2–4 sentences).

# Characters (only these allowed)
${characterLines.join("\n")}
${artifactName ? `\n# Artifact\n- ${artifactName}: ${artifactRule}` : ""}

${motifs.length > 0 ? `# Recurring Motifs\n${motifs.join("\n")}` : ""}

# Chapter Structure (guidance, NOT verbatim)
${chapterOutlines}

# Output Format
Return only valid JSON:
\`\`\`json
{
  "title": "Short title (max 7 words)",
  "description": "One-sentence teaser",
  "chapters": [
    { "chapter": 1, "title": "Chapter title", "text": "Chapter text..." },
    { "chapter": 2, "title": "Chapter title", "text": "Chapter text..." },
    ...
  ]
}
\`\`\``;
}

// ─── Full Story Rewrite Prompt ──────────────────────────────────────────────────
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
    .map(ch => `--- Chapter ${ch.chapter}: ${ch.title} ---\n${ch.text}`)
    .join("\n\n");

  if (isGerman) {
    return `Revise the following children's story. Keep the plot and action, but fix ALL listed problems. Write the output in German.

${qualityIssues}

STYLE TARGETS (do NOT mention these directly):
- Page-turning momentum, warm humor, cinematic clarity
- Poetic depth in small doses, distinct character voices

RULES (unchangeable):
- Allowed names: ${allowedNames || "none"}
- No new proper names
- Length: ${totalWordMin}-${totalWordMax} words total, ${wordsPerChapter.min}-${wordsPerChapter.max} per chapter
- No placeholder chapters; if a chapter is short, expand with a concrete action sequence + 2-3 short dialogue lines
- Avoid template phrases like "important decision", "decisive clue", "special idea", "new ability", "felt the tension"
- Each chapter must contain these beats woven naturally into prose (never as headings): a clear setting (place + mood, 1-2 sentences), a purpose, a difficulty, a concrete action, a step forward, and a closing hook
- If any chapter has 1-2 sentences, AUTO-EXPAND using these beats as natural prose
- Each chapter must include one small extra complication (something slips, is too heavy, is misunderstood, or distracts) — never label it
- Avoid sentences like "Er traf eine wichtige Entscheidung" or "Sie entdeckten den entscheidenden Hinweis"; replace with concrete action + short dialogue
- Do NOT render headings or labels like "Ort:", "Stimmung:", "Ziel:", "Hindernis:", "Handlung:", "Action:", "Mini-Problem:", "Mini-Aufloesung:", "Mini-Resolution:", "Hook:", "Ausblick:", "Epilog:", "Scene:", "Mood:", "Goal:", "Obstacle:", "Outlook:", "Sichtbare Aktion:", "Aktion fortgesetzt:", "Visible action:", "Action continued:" in the chapter text. Also never start sentences with "Ihr Ziel war", "Ein Hindernis war", "Her goal was", "An obstacle was". These are internal only.
- Tone: ${tone ?? dna.toneBounds?.targetTone ?? "warm"}
- Audience: ${ageRange.min}-${ageRange.max} years
${artifactName ? `- Artifact "${artifactName}" must be actively used` : ""}
- Chapter titles must be curiosity hooks (not "Chapter X")
- Description must be a 1-sentence teaser hook
- Last chapter ends with a short epilogue paragraph + optional 1-sentence spark for next adventure
${stylePackText ? `\n${stylePackText}\n` : ""}

ORIGINAL TEXT:
${originalText}

Return the COMPLETE revised story as JSON:
{
  "title": "Story title",
  "description": "1-2 sentences",
  "chapters": [
    { "chapter": 1, "title": "...", "text": "..." },
    ...
  ]
}`;
  }

  return `Revise the following children's story. Keep the plot and action, but fix ALL listed problems.

${qualityIssues}

STYLE TARGETS (do NOT mention these directly):
- Page-turning momentum, warm humor, cinematic clarity
- Poetic depth in small doses, distinct character voices

RULES (unchangeable):
- Allowed names: ${allowedNames || "none"}
- No new proper names
- Length: ${totalWordMin}-${totalWordMax} words total, ${wordsPerChapter.min}-${wordsPerChapter.max} per chapter
- No placeholder chapters; if a chapter is short, expand with a concrete action sequence + 2-3 short dialogue lines
- Avoid template phrases like "important decision", "decisive clue", "special idea", "new ability", "felt the tension"
- Each chapter must contain these beats woven naturally into prose (never as headings): a clear setting (place + mood, 1-2 sentences), a purpose, a difficulty, a concrete action, a step forward, and a closing hook
- If any chapter has 1-2 sentences, AUTO-EXPAND using these beats as natural prose
- Each chapter must include one small extra complication (something slips, is too heavy, is misunderstood, or distracts) — never label it
- Avoid sentences like "He made an important decision" or "They discovered the decisive clue"; replace with concrete action + short dialogue
- Do NOT render headings or labels like "Scene:", "Mood:", "Goal:", "Obstacle:", "Action:", "Mini-problem:", "Mini-resolution:", "Hook:", "Outlook:", "Epilogue:", "Ort:", "Stimmung:", "Ziel:", "Hindernis:", "Visible action:", "Action continued:", "Sichtbare Aktion:", "Aktion fortgesetzt:" in the chapter text. Also never start sentences with "Her goal was", "An obstacle was", "Ihr Ziel war", "Ein Hindernis war". These are internal only.
- Tone: ${tone ?? dna.toneBounds?.targetTone ?? "warm"}
- Audience: ${ageRange.min}-${ageRange.max} years
${artifactName ? `- Artifact "${artifactName}" must be actively used` : ""}
- Chapter titles must be curiosity hooks (not "Chapter X")
- Description must be a 1-sentence teaser hook
- Last chapter ends with a short epilogue paragraph + optional 1-sentence spark for next adventure
${stylePackText ? `\n${stylePackText}\n` : ""}

ORIGINAL TEXT:
${originalText}

Return the COMPLETE revised story as JSON:
{
  "title": "Story title",
  "description": "1-2 sentences",
  "chapters": [
    { "chapter": 1, "title": "...", "text": "..." },
    ...
  ]
}`;
}

export function buildStoryTitlePrompt(input: { storyText: string; language: string }): string {
  if (input.language === "de") {
    return `Create a short title (max 7 words) and a 1-sentence teaser hook for the following children's story in German.
Return JSON:
{ "title": "...", "description": "..." }

Story:
${input.storyText}`;
  }

  return `Create a short story title (max 7 words) and a 1-sentence teaser hook for the following children's story in ${input.language}.
Return JSON:
{ "title": "...", "description": "..." }

Story:
${input.storyText}`;
}

function buildStructureMap(chapterCount: number): string {
  if (chapterCount >= 8) {
    return [
      "- Ch1: Setup + promise + first mini-mystery",
      "- Ch2: First setback + rule of the world",
      "- Ch3: False lead / unexpected ally",
      "- Ch4: Midpoint twist (stakes widen)",
      "- Ch5: Loss or mistake by protagonist",
      "- Ch6: Plan + rising time pressure",
      "- Ch7: Final confrontation + clever solution",
      "- Ch8: Reward + warm resolution + short epilogue beat",
    ].join("\n");
  }
  if (chapterCount === 7) {
    return [
      "- Ch1: Setup + promise",
      "- Ch2: Setback + rule of the world",
      "- Ch3: False lead / ally",
      "- Ch4: Midpoint twist",
      "- Ch5: Darkest moment",
      "- Ch6: Final plan + confrontation",
      "- Ch7: Resolution + short epilogue beat",
    ].join("\n");
  }
  if (chapterCount === 6) {
    return [
      "- Ch1: Setup + promise",
      "- Ch2: Setback + rule of the world",
      "- Ch3: Twist / false lead",
      "- Ch4: Darkest moment",
      "- Ch5: Final plan + confrontation",
      "- Ch6: Resolution + short epilogue beat",
    ].join("\n");
  }
  if (chapterCount === 5) {
    return [
      "- Ch1: Setup + first mini-mystery",
      "- Ch2: First setback + escalation",
      "- Ch3: False lead / twist",
      "- Ch4: Darkest moment (nearly lost)",
      "- Ch5: Resolution + warm payoff + short epilogue beat",
    ].join("\n");
  }
  if (chapterCount === 4) {
    return [
      "- Ch1: Setup + promise",
      "- Ch2: Escalation + obstacle",
      "- Ch3: Climax (darkest moment)",
      "- Ch4: Resolution + short epilogue beat",
    ].join("\n");
  }
  return [
    "- Ch1: Setup + problem",
    "- Ch2: Confrontation + turning point",
    "- Ch3: Resolution + short epilogue beat",
  ].join("\n");
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

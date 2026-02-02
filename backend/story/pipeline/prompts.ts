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
  const personalityLabel = isGerman ? "Persoenlichkeit" : "Personality";
  const speechLabel = isGerman ? "Sprachstil" : "Speech style";
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
    ? (isGerman
      ? `Artefakt: ${chapter.artifactUsage}${artifactName ? ` (Name: ${artifactName} muss genannt werden)` : ""}`
      : `Artifact usage: ${chapter.artifactUsage}${artifactName ? ` (Name: ${artifactName} must be named)` : ""}`)
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
7) Children's-book style: vivid imagery, rhythmic flow, varied sentence starts, occasional dialogue.
8) Do not state belonging explicitly; show it through actions. Avoid phrases like "always been part of this tale".
9) Avoid stock phrases like "makes an important decision", "has a special idea", "shows a new ability", "feels the tension".
10) Avatars and supporting characters must be actively involved, not just present.
11) End with a gentle forward-looking line (except final chapter).
${strict ? "12) Double-check that no English sentence appears in the German output." : ""}

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
6) Children's-book style: vivid imagery, rhythmic flow, varied sentence starts, occasional dialogue.
7) Do not state belonging explicitly; show it through actions. Avoid phrases like "always been part of this tale".
8) Avoid stock phrases like "makes an important decision", "has a special idea", "shows a new ability", "feels the tension".
9) Avatars and supporting characters must be actively involved, not just present.
10) End with a gentle forward-looking line (except final chapter).
${strict ? "11) Do not include any instruction text or meta commentary in the output." : ""}

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
    short: { min: 180, max: 260 },
    medium: { min: 260, max: 360 },
    long: { min: 360, max: 520 },
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
4) Every character must act or speak.
5) Do not state belonging explicitly; avoid "always been part of this tale".
6) Avoid stock phrases like "makes an important decision", "has a special idea", "shows a new ability", "feels the tension".
7) ${lengthTargets.wordMin}-${lengthTargets.wordMax} words, ${lengthTargets.sentenceMin}-${lengthTargets.sentenceMax} sentences.
8) Children's-book style: vivid, rhythmic, varied sentence starts.

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
4) Every character must act or speak.
5) Do not state belonging explicitly; avoid phrases like "always been part of this tale".
6) Avoid stock phrases like "makes an important decision", "has a special idea", "shows a new ability", "feels the tension".
7) ${lengthTargets.wordMin}-${lengthTargets.wordMax} words, ${lengthTargets.sentenceMin}-${lengthTargets.sentenceMax} sentences.
8) Children's-book style: vivid, rhythmic, varied sentence starts.

ORIGINAL TEXT:
${originalText}

Return JSON:
{ "title": "Short chapter title", "text": "Chapter text" }`;
}

// ─── Full Story Prompt (all chapters in one call) ───────────────────────────
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
  const { directives, cast, dna, language, ageRange, tone, totalWordTarget, totalWordMin, totalWordMax, wordsPerChapter, stylePackText, strict, fusionSections } = input;
  const isGerman = language === "de";
  const artifactName = cast.artifact?.name?.trim();
  const personalityLabel = isGerman ? "Persoenlichkeit" : "Personality";
  const speechLabel = isGerman ? "Sprachstil" : "Speech style";

  const allCharacters = new Set<string>();
  const allSlots = new Set(directives.flatMap(d => d.charactersOnStage));
  for (const slot of allSlots) {
    const sheet = findCharacterBySlot(cast, slot);
    if (sheet) allCharacters.add(sheet.displayName);
  }
  const allowedNames = Array.from(allCharacters).join(", ");

  const characterProfiles = Array.from(allSlots)
    .map(slot => {
      const sheet = findCharacterBySlot(cast, slot);
      if (!sheet || slot.includes("ARTIFACT")) return null;
      const signature = sheet.visualSignature?.length ? sheet.visualSignature.join(", ") : "";
      const personality = sheet.personalityTags?.length ? `${personalityLabel}: ${sheet.personalityTags.slice(0, 4).join(", ")}` : "";
      const speech = sheet.speechStyleHints?.length ? `${speechLabel}: ${sheet.speechStyleHints.slice(0, 2).join(", ")}` : "";

      // V2: Enhanced personality details for recognizable characters
      const ep = sheet.enhancedPersonality;
      const catchphraseHint = ep?.catchphrase
        ? (isGerman ? `Catchphrase (max 1x!): "${ep.catchphrase}"` : `Catchphrase (max 1x!): "${ep.catchphrase}"`)
        : "";
      const dialogStyle = ep?.dialogueStyle
        ? (isGerman ? `Dialogstil: ${ep.dialogueStyle}` : `Dialogue style: ${ep.dialogueStyle}`)
        : "";
      const triggers = ep?.emotionalTriggers?.length
        ? (isGerman ? `Reagiert auf: ${ep.emotionalTriggers.slice(0, 2).join(", ")}` : `Reacts to: ${ep.emotionalTriggers.slice(0, 2).join(", ")}`)
        : "";
      const quirkHint = ep?.quirk
        ? (isGerman ? `Eigenart: ${ep.quirk}` : `Quirk: ${ep.quirk}`)
        : "";

      const extras = [personality, speech, catchphraseHint, dialogStyle, triggers, quirkHint].filter(Boolean).join("; ");
      return `- ${sheet.displayName} (${sheet.roleType})${signature ? ` - ${signature}` : ""}${extras ? `; ${extras}` : ""}`;
    })
    .filter(Boolean)
    .join("\n");

  const chapterBlocks = directives.map((d, idx) => {
    const chOnStage = d.charactersOnStage
      .filter(s => !s.includes("ARTIFACT"))
      .map(s => findCharacterBySlot(cast, s)?.displayName)
      .filter(Boolean)
      .join(", ");

    const artifactLine = d.artifactUsage && !d.artifactUsage.toLowerCase().includes("nicht genutzt") && !d.artifactUsage.toLowerCase().includes("not used")
      ? (isGerman ? `  Artefakt: ${d.artifactUsage}` : `  Artifact: ${d.artifactUsage}`)
      : "";

    const isFirst = idx === 0;
    const isLast = idx === directives.length - 1;
    const isMidPeak = idx === directives.length - 2;

    let arcHint = "";
    if (isGerman) {
      if (isFirst) arcHint = "  Bogen: Setup + erstes Raetsel";
      else if (idx === 1) arcHint = "  Bogen: Problem wird groesser";
      else if (idx === 2 && directives.length >= 5) arcHint = "  Bogen: Fehler/Irrweg (Twist)";
      else if (isMidPeak) arcHint = "  Bogen: Schwerster Moment, fast verloren (Hoehepunkt!)";
      else if (isLast) arcHint = "  Bogen: Loesung + Payoff + warmes Ende";
    } else {
      if (isFirst) arcHint = "  Arc: Setup + first mystery";
      else if (idx === 1) arcHint = "  Arc: Problem escalates";
      else if (idx === 2 && directives.length >= 5) arcHint = "  Arc: Mistake/false lead (twist)";
      else if (isMidPeak) arcHint = "  Arc: Darkest moment, nearly lost (climax!)";
      else if (isLast) arcHint = "  Arc: Resolution + payoff + warm ending";
    }

    // V2: Canon-Fusion section for this chapter (character entry/exit, dialogue cues, catchphrases)
    const fusionBlock = fusionSections?.get(d.chapter);
    const fusionLine = fusionBlock
      ? (isGerman ? `  FIGUREN-INTEGRATION:\n${fusionBlock.split("\n").map(l => `    ${l}`).join("\n")}` : `  CHARACTER INTEGRATION:\n${fusionBlock.split("\n").map(l => `    ${l}`).join("\n")}`)
      : "";

    return isGerman
      ? `KAPITEL ${d.chapter}:
  Setting: ${d.setting}
  Stimmung: ${d.mood ?? "COZY"}
  Ziel: ${d.goal}
  Konflikt: ${d.conflict}
  Ausgang: ${d.outcome}
  Figuren: ${chOnStage}
${artifactLine}
${arcHint}
${fusionLine}`
      : `CHAPTER ${d.chapter}:
  Setting: ${d.setting}
  Mood: ${d.mood ?? "COZY"}
  Goal: ${d.goal}
  Conflict: ${d.conflict}
  Outcome: ${d.outcome}
  Characters: ${chOnStage}
${artifactLine}
${arcHint}
${fusionLine}`;
  }).join("\n\n");

  if (isGerman) {
    return `You are an award-winning children's book author. Write a COMPLETE story with ${directives.length} chapters in German.
Target audience: ${ageRange.min}-${ageRange.max} years old.
Tone: ${tone ?? dna.toneBounds?.targetTone ?? "warm"}.

CHARACTER DIRECTORY (use ONLY these characters!):
${characterProfiles}
${artifactName ? `\nARTIFACT: ${artifactName} (${cast.artifact?.storyUseRule || "important object"})` : ""}

CHAPTER PLAN:
${chapterBlocks}
${stylePackText ? `\nSTYLE DIRECTIVES:\n${stylePackText}` : ""}

LENGTH REQUIREMENTS:
- Total story: ${totalWordMin}-${totalWordMax} words (target: ~${totalWordTarget})
- Per chapter: ${wordsPerChapter.min}-${wordsPerChapter.max} words

QUALITY REQUIREMENTS:
1) RED THREAD: The entire story must have a continuous narrative thread. Characters remember previous events. Actions build on each other.
2) CHAPTER STRUCTURE: Each chapter needs: 1 clear scene (place + mood), 1 mini-goal, 1 obstacle, 1 visible action (not just thoughts), 1 mini-resolution, 1 hook sentence at the end (except last chapter).
3) DIALOGUE: At least 2, max 6 dialogue lines per chapter. Dialogue shows character, doesn't explain.
4) ACTIVE CHARACTERS: Every named character MUST perform a concrete action (verb + object) and influence the plot (decision/idea/mistake/courage). No passive presence.
5) CAST LOCK: Use ONLY the listed names. No new proper names. Background figures only unnamed ("voices in the distance").
6) ANTI-REPETITION: No near-identical sentences across chapters. "Suddenly"/"all of a sudden" max 3x total. No recurring stock metaphors.
7) IMAGERY: Max 2 similes/metaphors per chapter. Prefer concrete sensory details (sounds, smells, temperatures, small movements) over poetic overload.
8) INTEGRATION HINTS: CHARACTER INTEGRATION is guidance only. Write actions naturally and vary phrasing; do not copy hint lines verbatim. Avoid stock phrases like "makes an important decision", "has a special idea", "shows a new ability", "feels the tension", "sad but hopeful".
9) SETTING COHERENCE: Each location shift needs a clear transition line (how/why they get there). No abrupt setting swaps without motivation. If multiple settings appear, use a recurring thread (book, map, flight) to tie them together.
10) TENSION ARC: Ch1=setup, Ch2=escalation, Ch3=twist/false lead, penultimate=climax (darkest moment), last=resolution+warm ending.
11) ARTIFACT ARC:${artifactName ? ` ${artifactName} must be introduced in ch 1-2, fail or be misunderstood in ch 2-3, and help decisively in ch 4-5. At least 2 active scenes.` : " No artifact in this story."}
12) ENDING: Last chapter resolves conflict, shows a small lesson (don't preach), ends with a warm closing image (e.g. homeward path, laughter, evening light). Optional 1 mini-teaser (1 sentence).
13) FORBIDDEN: Meta-sentences ("always been part of this tale"), stage directions, instruction text in output.
${strict ? "14) EXTRA STRICT: Double-check no instruction text leaks into output." : ""}

ALLOWED NAMES: ${allowedNames || "none"}

Return JSON:
{
  "title": "Short story title",
  "description": "1-2 sentence description",
  "chapters": [
    { "chapter": 1, "title": "Chapter title", "text": "Chapter text..." },
    { "chapter": 2, "title": "Chapter title", "text": "Chapter text..." }
  ]
}`;
  }

  return `You are an award-winning children's book author. Write a COMPLETE story with ${directives.length} chapters in ${language}.
Target audience: ${ageRange.min}-${ageRange.max} years old.
Tone: ${tone ?? dna.toneBounds?.targetTone ?? "warm"}.

CHARACTER DIRECTORY (use ONLY these characters!):
${characterProfiles}
${artifactName ? `\nARTIFACT: ${artifactName} (${cast.artifact?.storyUseRule || "important object"})` : ""}

CHAPTER PLAN:
${chapterBlocks}
${stylePackText ? `\nSTYLE DIRECTIVES:\n${stylePackText}` : ""}

LENGTH REQUIREMENTS:
- Total story: ${totalWordMin}-${totalWordMax} words (target: ~${totalWordTarget})
- Per chapter: ${wordsPerChapter.min}-${wordsPerChapter.max} words

QUALITY REQUIREMENTS:
1) RED THREAD: The entire story must have a continuous narrative thread. Characters remember previous events. Actions build on each other.
2) CHAPTER STRUCTURE: Each chapter needs: 1 clear scene (place + mood), 1 mini-goal, 1 obstacle, 1 visible action (not just thoughts), 1 mini-resolution, 1 hook sentence at the end (except last chapter).
3) DIALOGUE: At least 2, max 6 dialogue lines per chapter. Dialogue shows character, doesn't explain.
4) ACTIVE CHARACTERS: Every named character MUST perform a concrete action (verb + object) and influence the plot (decision/idea/mistake/courage). No passive presence.
5) CAST LOCK: Use ONLY the listed names. No new proper names. Background figures only unnamed ("voices in the distance").
6) ANTI-REPETITION: No near-identical sentences across chapters. "Suddenly"/"all of a sudden" max 3x total. No recurring stock metaphors.
7) IMAGERY: Max 2 similes/metaphors per chapter. Prefer concrete sensory details (sounds, smells, temperatures, small movements) over poetic overload.
8) INTEGRATION HINTS: CHARACTER INTEGRATION is guidance only. Write actions naturally and vary phrasing; do not copy hint lines verbatim. Avoid stock phrases like "makes an important decision", "has a special idea", "shows a new ability", "feels the tension", "sad but hopeful".
9) SETTING COHERENCE: Each location shift needs a clear transition line (how/why they get there). No abrupt setting swaps without motivation. If multiple settings appear, use a recurring thread (book, map, flight) to tie them together.
10) TENSION ARC: Ch1=setup, Ch2=escalation, Ch3=twist/false lead, penultimate=climax (darkest moment), last=resolution+warm ending.
11) ARTIFACT ARC:${artifactName ? ` ${artifactName} must be introduced in ch 1-2, fail or be misunderstood in ch 2-3, and help decisively in ch 4-5. At least 2 active scenes.` : " No artifact in this story."}
12) ENDING: Last chapter resolves conflict, shows a small lesson (don't preach), ends with a warm closing image (e.g. homeward path, laughter, evening light). Optional 1 mini-teaser (1 sentence).
13) FORBIDDEN: Meta-sentences ("always been part of this tale"), stage directions, instruction text in output.
${strict ? "14) EXTRA STRICT: Double-check no instruction text leaks into output." : ""}

ALLOWED NAMES: ${allowedNames || "none"}

Return JSON:
{
  "title": "Short story title",
  "description": "1-2 sentence description",
  "chapters": [
    { "chapter": 1, "title": "Chapter title", "text": "Chapter text..." },
    { "chapter": 2, "title": "Chapter title", "text": "Chapter text..." }
  ]
}`;
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
    .map(ch => `--- Kapitel ${ch.chapter}: ${ch.title} ---\n${ch.text}`)
    .join("\n\n");

  if (isGerman) {
    return `Revise the following children's story. Keep the plot and action, but fix ALL listed problems. Write the output in German.

${qualityIssues}

RULES (unchangeable):
- Allowed names: ${allowedNames || "none"}
- No new proper names
- Length: ${totalWordMin}-${totalWordMax} words total, ${wordsPerChapter.min}-${wordsPerChapter.max} per chapter
- Tone: ${tone ?? dna.toneBounds?.targetTone ?? "warm"}
- Audience: ${ageRange.min}-${ageRange.max} years
${artifactName ? `- Artifact "${artifactName}" must be actively used` : ""}
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

RULES (unchangeable):
- Allowed names: ${allowedNames || "none"}
- No new proper names
- Length: ${totalWordMin}-${totalWordMax} words total, ${wordsPerChapter.min}-${wordsPerChapter.max} per chapter
- Tone: ${tone ?? dna.toneBounds?.targetTone ?? "warm"}
- Audience: ${ageRange.min}-${ageRange.max} years
${artifactName ? `- Artifact "${artifactName}" must be actively used` : ""}
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
    return `Create a short title and description for the following children's story in German.
Return JSON:
{ "title": "...", "description": "..." }

Story:
${input.storyText}`;
  }

  return `Create a short story title and description for the following children's story in ${input.language}.
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

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
}): string {
  const { chapter, cast, dna, language, ageRange, tone, lengthTargets, stylePackText, originalText, previousContext, nextContext } = input;
  const isGerman = language === "de";
  const artifactName = cast.artifact?.name?.trim();
  const characterNames = chapter.charactersOnStage
    .map(slot => findCharacterBySlot(cast, slot)?.displayName)
    .filter(Boolean) as string[];
  const allowedNames = Array.from(new Set(characterNames)).join(", ");

  const prev = previousContext ? `PREVIOUS CHAPTER CONTEXT:\n${previousContext}\n` : "";
  const next = nextContext ? `NEXT CHAPTER CONTEXT:\n${nextContext}\n` : "";

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
4) Add a concrete action sequence + 2-3 short dialogue lines.
5) Keep the original plot beats and setting; just expand the scene.
6) Avoid template phrases like "important decision", "decisive clue", "special idea", "new ability", "felt the tension".
7) Target ${lengthTargets.wordMin}-${lengthTargets.wordMax} words, ${lengthTargets.sentenceMin}-${lengthTargets.sentenceMax} sentences.

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
}): string {
  const { chapter, cast, dna, language, ageRange, tone, lengthTargets, stylePackText, originalText, phraseLabels } = input;
  const isGerman = language === "de";
  const artifactName = cast.artifact?.name?.trim();
  const characterNames = chapter.charactersOnStage
    .map(slot => findCharacterBySlot(cast, slot)?.displayName)
    .filter(Boolean) as string[];
  const allowedNames = Array.from(new Set(characterNames)).join(", ");

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
4) Keep the chapter length within ${lengthTargets.wordMin}-${lengthTargets.wordMax} words.
5) Do not change the plot beats, only the wording.

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
  const personalityLabel = "Personality";
  const speechLabel = "Speech style";

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
        ? `Catchphrase (max 1x!): "${ep.catchphrase}"`
        : "";
      const dialogStyle = ep?.dialogueStyle
        ? `Dialogue style: ${ep.dialogueStyle}`
        : "";
      const triggers = ep?.emotionalTriggers?.length
        ? `Reacts to: ${ep.emotionalTriggers.slice(0, 2).join(", ")}`
        : "";
      const quirkHint = ep?.quirk
        ? `Quirk: ${ep.quirk}`
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
      ? `  Artifact: ${d.artifactUsage}`
      : "";

    const isFirst = idx === 0;
    const isLast = idx === directives.length - 1;
    const isMidPeak = idx === directives.length - 2;

    let arcHint = "";
    if (isFirst) arcHint = "  Arc: Setup + first mystery";
    else if (idx === 1) arcHint = "  Arc: Problem escalates";
    else if (idx === 2 && directives.length >= 5) arcHint = "  Arc: Mistake/false lead (twist)";
    else if (isMidPeak) arcHint = "  Arc: Darkest moment, nearly lost (climax!)";
    else if (isLast) arcHint = "  Arc: Resolution + payoff + warm ending";

    // V2: Canon-Fusion section for this chapter (character entry/exit, dialogue cues, catchphrases)
    const fusionBlock = fusionSections?.get(d.chapter);
    const fusionLine = fusionBlock
      ? `  CHARACTER INTEGRATION:\n${fusionBlock.split("\n").map(l => `    ${l}`).join("\n")}`
      : "";

    return `CHAPTER ${d.chapter}:
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
  const structureMap = buildStructureMap(directives.length);

  if (isGerman) {
    return `You are an award-winning children's book author. Write a COMPLETE story with ${directives.length} chapters in German.
Target audience: ${ageRange.min}-${ageRange.max} years old.
Tone: ${tone ?? dna.toneBounds?.targetTone ?? "warm"}.

STYLE TARGETS (do NOT mention these directly):
- Page-turning momentum with short, vivid scenes and frequent hooks
- Warm humor + real stakes, never cynical
- Cinematic clarity: strong visuals, clear staging, cause -> effect
- Poetic depth in small doses (1-2 standout images per chapter)
- Distinct character voices; dialogue carries meaning

AGE ADAPTATION:
- 3-5: very short sentences, gentle repetition, 1 main problem, safe resolution
- 6-8: more dialogue, small riddles, playful tension, clear hooks
- 9-12: stronger motives, sharper twists, deeper emotion, still kid-safe
- 12-14: denser style, moral nuance, bigger turns (age-appropriate)

CHARACTER DIRECTORY (use ONLY these characters!):
${characterProfiles}
${artifactName ? `\nARTIFACT: ${artifactName} (${cast.artifact?.storyUseRule || "important object"})` : ""}

CHAPTER PLAN:
${chapterBlocks}
${stylePackText ? `\nSTYLE DIRECTIVES:\n${stylePackText}` : ""}

LENGTH REQUIREMENTS:
- Total story: ${totalWordMin}-${totalWordMax} words (target: ~${totalWordTarget})
- Per chapter: ${wordsPerChapter.min}-${wordsPerChapter.max} words
- Aim for the upper half of the per-chapter range; no 1-2 sentence teaser chapters.

STRUCTURE MAP:
${structureMap}

QUALITY REQUIREMENTS:
1) RED THREAD: The entire story must have a continuous narrative thread. Characters remember previous events. Actions build on each other.
2) CHAPTER STRUCTURE: Each chapter needs: 1 clear scene (place + mood), 1 mini-goal, 1 obstacle, 1 visible action (not just thoughts), 1 mini-resolution, 1 hook sentence at the end (except last chapter).
2b) HARD BEATS PER CHAPTER (must be clearly present in the text): Szene (Ort + Stimmung, 1-2 Saetze), Ziel, Hindernis, Action, Mini-Aufloesung, Hook.
2c) If a chapter has only 1-2 sentences, AUTO-EXPAND by explicitly adding these 6 beats.
2d) IMPORTANT: Do NOT render labels like "Ort:", "Stimmung:", "Ziel:", "Hindernis:", "Handlung:", "Mini-Aufloesung:", "Ausblick:", "Epilog:" in the chapter text. Those are internal only.
3) NO PLACEHOLDERS: Every chapter must be fully written and within the word range. If a chapter would be short, expand with a concrete action sequence + 2-3 short dialogue lines.
4) DIALOGUE: At least 2, max 6 dialogue lines per chapter. Dialogue shows character, doesn't explain.
5) ACTIVE CHARACTERS: Every named character MUST perform a concrete action (verb + object) and influence the plot (decision/idea/mistake/courage). No passive presence.
6) CAST LOCK: Use ONLY the listed names. No new proper names. Background figures only unnamed ("voices in the distance").
7) ANTI-REPETITION: No near-identical sentences across chapters. Avoid filler words like "suddenly", "all of a sudden", "very", "quite", "somehow". No recurring stock metaphors.
8) IMAGERY: Max 2 similes/metaphors per chapter. Prefer concrete sensory details (sounds, smells, temperatures, small movements) over poetic overload.
9) INTEGRATION HINTS: CHARACTER INTEGRATION is guidance only. Write actions naturally and vary phrasing; do not copy hint lines verbatim. Avoid stock phrases like "makes an important decision", "has a special idea", "shows a new ability", "feels the tension", "decisive clue", "important hint", "question that unties the knot", "sad but hopeful".
9b) SHOW, DON'T TELL: Avoid sentences like "Er traf eine wichtige Entscheidung" or "Sie entdeckten den entscheidenden Hinweis." Replace with concrete action + short dialogue.
10) SETTING COHERENCE: Each location shift needs a clear transition line (how/why they get there). No abrupt setting swaps without motivation. If multiple settings appear, use a recurring thread (book, map, flight) to tie them together.
11) TENSION ARC: Ch1=setup, Ch2=escalation, Ch3=twist/false lead, penultimate=climax (darkest moment), last=resolution+warm ending.
12) ARTIFACT ARC:${artifactName ? ` ${artifactName} must be introduced in ch 1-2, fail or be misunderstood in ch 2-3, and help decisively in ch 4-5. At least 2 active scenes.` : " No artifact in this story."}
13) ENDING: Last chapter resolves conflict, shows a small lesson (don't preach), includes a concrete on-scene moment with dialogue + action (no summary-only wrap-up), and ends with a warm closing image (e.g. homeward path, laughter, evening light). Add a short epilogue paragraph + optional 1-sentence spark for a next adventure.
14) CHAPTER TITLES: Each chapter title must be a curiosity hook, not "Chapter X".
15) QUALITY TURBO: Include at least 3 children's-book moments: (a) a recurring playful motif, (b) a tender poetic observation, (c) a clever solution kids could imitate.
16) FORBIDDEN: Meta-sentences ("always been part of this tale"), stage directions, instruction text, lists or bullet points in the chapter text.
16b) MINI-PROBLEM: Every chapter includes one small extra problem (something slips, is too heavy, is misunderstood, or distracts).
${strict ? "17) EXTRA STRICT: Double-check no instruction text leaks into output." : ""}

ALLOWED NAMES: ${allowedNames || "none"}

Return JSON:
{
  "title": "Short story title (max 7 words)",
  "description": "1-sentence teaser hook",
  "chapters": [
    { "chapter": 1, "title": "Chapter title", "text": "Chapter text..." },
    { "chapter": 2, "title": "Chapter title", "text": "Chapter text..." }
  ]
}`;
  }

  return `You are an award-winning children's book author. Write a COMPLETE story with ${directives.length} chapters in ${language}.
Target audience: ${ageRange.min}-${ageRange.max} years old.
Tone: ${tone ?? dna.toneBounds?.targetTone ?? "warm"}.

STYLE TARGETS (do NOT mention these directly):
- Page-turning momentum with short, vivid scenes and frequent hooks
- Warm humor + real stakes, never cynical
- Cinematic clarity: strong visuals, clear staging, cause -> effect
- Poetic depth in small doses (1-2 standout images per chapter)
- Distinct character voices; dialogue carries meaning

AGE ADAPTATION:
- 3-5: very short sentences, gentle repetition, 1 main problem, safe resolution
- 6-8: more dialogue, small riddles, playful tension, clear hooks
- 9-12: stronger motives, sharper twists, deeper emotion, still kid-safe
- 12-14: denser style, moral nuance, bigger turns (age-appropriate)

CHARACTER DIRECTORY (use ONLY these characters!):
${characterProfiles}
${artifactName ? `\nARTIFACT: ${artifactName} (${cast.artifact?.storyUseRule || "important object"})` : ""}

CHAPTER PLAN:
${chapterBlocks}
${stylePackText ? `\nSTYLE DIRECTIVES:\n${stylePackText}` : ""}

LENGTH REQUIREMENTS:
- Total story: ${totalWordMin}-${totalWordMax} words (target: ~${totalWordTarget})
- Per chapter: ${wordsPerChapter.min}-${wordsPerChapter.max} words
- Aim for the upper half of the per-chapter range; no 1-2 sentence teaser chapters.

STRUCTURE MAP:
${structureMap}

QUALITY REQUIREMENTS:
1) RED THREAD: The entire story must have a continuous narrative thread. Characters remember previous events. Actions build on each other.
2) CHAPTER STRUCTURE: Each chapter needs: 1 clear scene (place + mood), 1 mini-goal, 1 obstacle, 1 visible action (not just thoughts), 1 mini-resolution, 1 hook sentence at the end (except last chapter).
2b) HARD BEATS PER CHAPTER (must be clearly present in the text): Scene (place + mood, 1-2 sentences), Goal, Obstacle, Action, Mini-resolution, Hook.
2c) If a chapter has only 1-2 sentences, AUTO-EXPAND by explicitly adding these 6 beats.
2d) IMPORTANT: Do NOT render labels like "Scene:", "Mood:", "Goal:", "Obstacle:", "Action:", "Mini-resolution:", "Outlook:", "Epilogue:" in the chapter text. Those are internal only.
3) NO PLACEHOLDERS: Every chapter must be fully written and within the word range. If a chapter would be short, expand with a concrete action sequence + 2-3 short dialogue lines.
4) DIALOGUE: At least 2, max 6 dialogue lines per chapter. Dialogue shows character, doesn't explain.
5) ACTIVE CHARACTERS: Every named character MUST perform a concrete action (verb + object) and influence the plot (decision/idea/mistake/courage). No passive presence.
6) CAST LOCK: Use ONLY the listed names. No new proper names. Background figures only unnamed ("voices in the distance").
7) ANTI-REPETITION: No near-identical sentences across chapters. Avoid filler words like "suddenly", "all of a sudden", "very", "quite", "somehow". No recurring stock metaphors.
8) IMAGERY: Max 2 similes/metaphors per chapter. Prefer concrete sensory details (sounds, smells, temperatures, small movements) over poetic overload.
9) INTEGRATION HINTS: CHARACTER INTEGRATION is guidance only. Write actions naturally and vary phrasing; do not copy hint lines verbatim. Avoid stock phrases like "makes an important decision", "has a special idea", "shows a new ability", "feels the tension", "decisive clue", "important hint", "question that unties the knot", "sad but hopeful".
9b) SHOW, DON'T TELL: Avoid sentences like "He made an important decision" or "They discovered the decisive clue." Replace with concrete action + short dialogue.
10) SETTING COHERENCE: Each location shift needs a clear transition line (how/why they get there). No abrupt setting swaps without motivation. If multiple settings appear, use a recurring thread (book, map, flight) to tie them together.
11) TENSION ARC: Ch1=setup, Ch2=escalation, Ch3=twist/false lead, penultimate=climax (darkest moment), last=resolution+warm ending.
12) ARTIFACT ARC:${artifactName ? ` ${artifactName} must be introduced in ch 1-2, fail or be misunderstood in ch 2-3, and help decisively in ch 4-5. At least 2 active scenes.` : " No artifact in this story."}
13) ENDING: Last chapter resolves conflict, shows a small lesson (don't preach), includes a concrete on-scene moment with dialogue + action (no summary-only wrap-up), and ends with a warm closing image (e.g. homeward path, laughter, evening light). Add a short epilogue paragraph + optional 1-sentence spark for a next adventure.
14) CHAPTER TITLES: Each chapter title must be a curiosity hook, not "Chapter X".
15) QUALITY TURBO: Include at least 3 children's-book moments: (a) a recurring playful motif, (b) a tender poetic observation, (c) a clever solution kids could imitate.
16) FORBIDDEN: Meta-sentences ("always been part of this tale"), stage directions, instruction text, lists or bullet points in the chapter text.
16b) MINI-PROBLEM: Every chapter includes one small extra problem (something slips, is too heavy, is misunderstood, or distracts).
${strict ? "17) EXTRA STRICT: Double-check no instruction text leaks into output." : ""}

ALLOWED NAMES: ${allowedNames || "none"}

Return JSON:
{
  "title": "Short story title (max 7 words)",
  "description": "1-sentence teaser hook",
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
- Each chapter must explicitly contain these beats: Szene (Ort + Stimmung, 1-2 Saetze), Ziel, Hindernis, Action, Mini-Aufloesung, Hook
- If any chapter has 1-2 sentences, AUTO-EXPAND using the 6 beats above
- Each chapter must include a small extra mini-problem (something slips, is too heavy, is misunderstood, or distracts)
- Avoid sentences like "Er traf eine wichtige Entscheidung" or "Sie entdeckten den entscheidenden Hinweis"; replace with concrete action + short dialogue
- Do NOT render labels like "Ort:", "Stimmung:", "Ziel:", "Hindernis:", "Handlung:", "Mini-Aufloesung:", "Ausblick:", "Epilog:" in the chapter text. Those are internal only.
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
- Each chapter must explicitly contain these beats: Scene (place + mood, 1-2 sentences), Goal, Obstacle, Action, Mini-resolution, Hook
- If any chapter has 1-2 sentences, AUTO-EXPAND using the 6 beats above
- Each chapter must include a small extra mini-problem (something slips, is too heavy, is misunderstood, or distracts)
- Avoid sentences like "He made an important decision" or "They discovered the decisive clue"; replace with concrete action + short dialogue
- Do NOT render labels like "Scene:", "Mood:", "Goal:", "Obstacle:", "Action:", "Mini-resolution:", "Outlook:", "Epilogue:" in the chapter text. Those are internal only.
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

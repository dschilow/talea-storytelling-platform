import type { CastSet, SceneDirective, StoryBible, StoryDNA, StoryOutline, TaleDNA, WorldState } from "./types";

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
  storyBible?: StoryBible;
  outlineChapter?: StoryOutline["chapters"][number];
  worldState?: WorldState;
  lastChapterSummary?: string;
}): string {
  const { chapter, cast, dna, language, ageRange, tone, strict, lengthHint, pacing, lengthTargets: overrideTargets, stylePackText, storyBible, outlineChapter, worldState, lastChapterSummary } = input;
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

  const continuityBlock = [
    chapter.recapBullet ? `RECAP: ${chapter.recapBullet}` : "",
    chapter.continuityMust?.length ? `CONTINUITY MUST:\n- ${chapter.continuityMust.join("\n- ")}` : "",
    chapter.openLoopsToAddress?.length ? `OPEN LOOPS TO ADDRESS:\n- ${chapter.openLoopsToAddress.join("\n- ")}` : "",
    chapter.openLoopsToCreate?.length ? `OPEN LOOP TO CREATE:\n- ${chapter.openLoopsToCreate.join("\n- ")}` : "",
  ].filter(Boolean).join("\n");

  const bibleBlock = storyBible
    ? `STORY BIBLE:\n- Ziel: ${storyBible.coreGoal}\n- Problem: ${storyBible.coreProblem}\n- Stakes: ${storyBible.stakes}\n- Mystery: ${storyBible.mysteryOrQuestion}`
    : "";
  const outlineBlock = outlineChapter
    ? `OUTLINE:\n- Titel: ${outlineChapter.title}\n- Subgoal: ${outlineChapter.subgoal}\n- Reversal: ${outlineChapter.reversal}\n- Hook: ${outlineChapter.hook}${outlineChapter.artifactBeat ? `\n- Artefakt: ${outlineChapter.artifactBeat}` : ""}`
    : "";
  const worldStateBlock = worldState ? `WORLD STATE (vorher):\n${JSON.stringify(worldState)}` : "";
  const lastSummaryBlock = lastChapterSummary ? `LETZTES KAPITEL (Kurzfassung): ${lastChapterSummary}` : "";

  if (isGerman) {
    return `Du bist eine professionelle Autorin fuer Kinderbuecher.

Schreibe Kapitel ${chapter.chapter} fuer ein Publikum von ${ageRange.min}-${ageRange.max} Jahren auf Deutsch.
Ton: ${tone ?? dna.toneBounds?.targetTone ?? "warm"}.

${bibleBlock ? `${bibleBlock}\n` : ""}${outlineBlock ? `${outlineBlock}\n` : ""}${worldStateBlock ? `${worldStateBlock}\n` : ""}${lastSummaryBlock ? `${lastSummaryBlock}\n` : ""}

SZENEN-VORGABE:
- Setting: ${chapter.setting}
- Stimmung: ${chapter.mood ?? "COZY"}
- Ziel: ${chapter.goal}
- Konflikt: ${chapter.conflict}
- Ausgang: ${chapter.outcome}
- Fortschritt: ${chapter.progressDelta ?? "muss spuerbar sein"}
- Neue Info: ${chapter.newInformation ?? "muss spuerbar sein"}
- Kosten/Tradeoff: ${chapter.costOrTradeoff ?? "muss spuerbar sein"}
- Hook: ${chapter.carryOverHook ?? "muss eine offene Schleife hinterlassen"}
- Figuren auf der Buehne (alle muessen vorkommen):
${characterSummaries}
${artifactLine}
${stylePackText ? `\n${stylePackText}\n` : ""}
${continuityBlock ? `\n${continuityBlock}\n` : ""}

ERLAUBTE NAMEN (exakt so schreiben): ${allowedNames || "keine"}

STRICTE REGELN:
1) Verwende ausschliesslich die gelisteten Namen. Keine neuen Eigennamen.
2) Keine zusaetzlichen Figuren oder Tiere mit Namen. Wenn unbedingt, dann nur unbenannt (z.B. \"einige Dorfbewohner\").
3) Keine Regieanweisungen, keine Meta-Saetze, keine englischen Anweisungen.
4) Jede Figur muss eine konkrete Handlung oder kurze Rede erhalten; keine Namensliste.
5) Erwaehne das Artefakt, wenn es gefordert ist (mit Namen).
6) ${lengthTargets.wordMin}-${lengthTargets.wordMax} Woerter, ${lengthTargets.sentenceMin}-${lengthTargets.sentenceMax} Saetze, kindgerecht.
7) Schreibstil wie hochwertige Kinderbuecher: bildhaft, rhythmisch, abwechslungsreiche Satzanfaenge, gelegentlich direkte Rede.
8) Keine Meta-Aussagen ueber Zugehoerigkeit; zeige Zugehoerigkeit nur durch Handlung. Vermeide Phrasen wie "gehoeren seit jeher" oder "ganz selbstverstaendlich dabei".
9) Avatare und Nebenfiguren muessen aktiv ins Geschehen eingebunden sein, nicht nur am Rand stehen.
10) Beende mit einem sanften Ausblick (ausser im letzten Kapitel).
11) Entry/Exit: Wenn CONTINUITY MUST ENTRY/EXIT enthaelt, muss ein Satz das begruenden.
12) Jede Szene muss das Story-Ziel oder Mystery beruehren.
${strict ? "13) Doppelt pruefen: Kein englischer Satz darf im Text erscheinen." : ""}

Gib JSON zurueck:
{ "title": "Kurzer Kapiteltitel", "text": "Kapiteltext" }`;
  }

  return `You are a professional children's story author.

Write Chapter ${chapter.chapter} for a ${ageRange.min}-${ageRange.max} year old audience in ${language}.
Tone: ${tone ?? dna.toneBounds?.targetTone ?? "warm"}.

${bibleBlock ? `${bibleBlock}\n` : ""}${outlineBlock ? `${outlineBlock}\n` : ""}${worldStateBlock ? `${worldStateBlock}\n` : ""}${lastSummaryBlock ? `${lastSummaryBlock}\n` : ""}

SCENE DIRECTIVE:
- Setting: ${chapter.setting}
- Mood: ${chapter.mood ?? "COZY"}
- Goal: ${chapter.goal}
- Conflict: ${chapter.conflict}
- Outcome: ${chapter.outcome}
- Progress: ${chapter.progressDelta ?? "must be clear"}
- New info: ${chapter.newInformation ?? "must be clear"}
- Cost/Tradeoff: ${chapter.costOrTradeoff ?? "must be clear"}
- Hook: ${chapter.carryOverHook ?? "must leave an open loop"}
- Characters on stage (must include all):
${characterSummaries}
${artifactLine}
${stylePackText ? `\n${stylePackText}\n` : ""}
${continuityBlock ? `\n${continuityBlock}\n` : ""}

Allowed names (use exactly): ${allowedNames || "none"}

STRICT RULES:
1) Use only the listed character names exactly as given. No extra named characters.
2) Do not introduce any additional named characters or animals; if absolutely needed, keep them unnamed.
3) Each character must have a concrete action or short line; no name lists.
4) Mention the artifact if required (by name).
5) Write ${lengthTargets.wordMin}-${lengthTargets.wordMax} words, ${lengthTargets.sentenceMin}-${lengthTargets.sentenceMax} sentences, age-appropriate.
6) Children's-book style: vivid imagery, rhythmic flow, varied sentence starts, occasional dialogue.
7) Do not state belonging explicitly; show it through actions. Avoid phrases like "always been part of this tale".
8) Avatars and supporting characters must be actively involved, not just present.
9) End with a gentle forward-looking line (except final chapter).
10) If CONTINUITY MUST includes ENTRY/EXIT, include a sentence that explains it.
11) Each chapter must touch the core goal or mystery.
${strict ? "12) Do not include any instruction text or meta commentary in the output." : ""}

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
  storyBible?: StoryBible;
  outlineChapter?: StoryOutline["chapters"][number];
  worldState?: WorldState;
}): string {
  const { chapter, cast, dna, language, ageRange, tone, lengthHint, pacing, lengthTargets: overrideTargets, stylePackText, issues, originalText, storyBible, outlineChapter, worldState } = input;
  const isGerman = language === "de";
  const lengthTargets = overrideTargets ?? resolveLengthTargets({ lengthHint, ageRange, pacing });
  const artifactName = cast.artifact?.name?.trim();
  const characterNames = chapter.charactersOnStage
    .map(slot => findCharacterBySlot(cast, slot)?.displayName)
    .filter(Boolean) as string[];
  const allowedNames = Array.from(new Set(characterNames)).join(", ");

  const issueList = issues.length > 0 ? issues.map(issue => `- ${issue}`).join("\n") : "- Keine";
  const bibleBlock = storyBible
    ? `STORY BIBLE:\n- Ziel: ${storyBible.coreGoal}\n- Problem: ${storyBible.coreProblem}\n- Mystery: ${storyBible.mysteryOrQuestion}`
    : "";
  const outlineBlock = outlineChapter
    ? `OUTLINE:\n- Titel: ${outlineChapter.title}\n- Subgoal: ${outlineChapter.subgoal}\n- Reversal: ${outlineChapter.reversal}\n- Hook: ${outlineChapter.hook}`
    : "";
  const worldStateBlock = worldState ? `WORLD STATE (vorher):\n${JSON.stringify(worldState)}` : "";
  const continuityBlock = chapter.continuityMust?.length ? `CONTINUITY MUST:\n- ${chapter.continuityMust.join("\n- ")}` : "";

  if (isGerman) {
    return `Ueberarbeite das folgende Kapitel, ohne den Inhalt zu verlieren, aber erfuelle alle Regeln.

PROBLEME:
${issueList}

${bibleBlock ? `${bibleBlock}\n` : ""}${outlineBlock ? `${outlineBlock}\n` : ""}${worldStateBlock ? `${worldStateBlock}\n` : ""}${continuityBlock ? `${continuityBlock}\n` : ""}

SZENEN-VORGABE:
- Setting: ${chapter.setting}
- Stimmung: ${chapter.mood ?? "COZY"}
- Ziel: ${chapter.goal}
- Konflikt: ${chapter.conflict}
- Ausgang: ${chapter.outcome}
- Figuren (muessen vorkommen): ${allowedNames || "keine"}
- Artefakt: ${chapter.artifactUsage}${artifactName ? ` (Name: ${artifactName} muss genannt werden)` : ""}
- Ton: ${tone ?? dna.toneBounds?.targetTone ?? "warm"}
${stylePackText ? `\n${stylePackText}\n` : ""}

REGELN:
1) Nur diese Namen verwenden: ${allowedNames || "keine"}.
2) Keine neuen Eigennamen.
3) Keine Meta-Texte oder Anweisungen.
4) Jede Figur muss handeln oder sprechen.
5) Keine Meta-Aussagen ueber Zugehoerigkeit; vermeide "gehoeren seit jeher" und "ganz selbstverstaendlich dabei".
6) ${lengthTargets.wordMin}-${lengthTargets.wordMax} Woerter, ${lengthTargets.sentenceMin}-${lengthTargets.sentenceMax} Saetze.
7) Stil wie hochwertige Kinderbuecher: bildhaft, rhythmisch, abwechslungsreich.
8) Wenn CONTINUITY MUST ENTRY/EXIT enthaelt, ergaenze einen Satz dazu.

ORIGINALTEXT:
${originalText}

Gib JSON zurueck:
{ "title": "Kurzer Kapiteltitel", "text": "Kapiteltext" }`;
  }

  return `Revise the chapter below to satisfy the rules without losing the plot.

ISSUES:
${issueList}

${bibleBlock ? `${bibleBlock}\n` : ""}${outlineBlock ? `${outlineBlock}\n` : ""}${worldStateBlock ? `${worldStateBlock}\n` : ""}${continuityBlock ? `${continuityBlock}\n` : ""}

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
6) ${lengthTargets.wordMin}-${lengthTargets.wordMax} words, ${lengthTargets.sentenceMin}-${lengthTargets.sentenceMax} sentences.
7) Children's-book style: vivid, rhythmic, varied sentence starts.
8) If CONTINUITY MUST includes ENTRY/EXIT, add a sentence that explains it.

ORIGINAL TEXT:
${originalText}

Return JSON:
{ "title": "Short chapter title", "text": "Chapter text" }`;
}

export function buildStoryTitlePrompt(input: { storyText: string; language: string }): string {
  if (input.language === "de") {
    return `Erstelle einen kurzen Titel und eine Beschreibung fuer die folgende Kindergeschichte auf Deutsch.
Gib JSON zurueck:
{ "title": "...", "description": "..." }

Geschichte:
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

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
  strict?: boolean;
}): string {
  const { chapter, cast, dna, language, ageRange, tone, strict, lengthHint, pacing } = input;
  const isGerman = language === "de";
  const lengthTargets = resolveLengthTargets({ lengthHint, ageRange, pacing });
  const artifactName = cast.artifact?.name?.trim();
  const characterSummaries = chapter.charactersOnStage
    .map(slot => {
      const sheet = findCharacterBySlot(cast, slot);
      if (!sheet) return null;
      const signature = sheet.visualSignature?.length ? sheet.visualSignature.join(", ") : "distinct look";
      return `${sheet.displayName} (${sheet.roleType}) - ${signature}`;
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
    return `Du bist eine professionelle Autorin fuer Kinderbuecher.

Schreibe Kapitel ${chapter.chapter} fuer ein Publikum von ${ageRange.min}-${ageRange.max} Jahren auf Deutsch.
Ton: ${tone ?? dna.toneBounds?.targetTone ?? "warm"}.

SZENEN-VORGABE:
- Setting: ${chapter.setting}
- Stimmung: ${chapter.mood ?? "COZY"}
- Ziel: ${chapter.goal}
- Konflikt: ${chapter.conflict}
- Ausgang: ${chapter.outcome}
- Kanonischer Hinweis (als Subtext, NICHT wortwoertlich, nicht wiederholen): ${chapter.canonAnchorLine}
- Figuren auf der Buehne (alle muessen vorkommen):
${characterSummaries}
${artifactLine}

ERLAUBTE NAMEN (exakt so schreiben): ${allowedNames || "keine"}

STRICTE REGELN:
1) Verwende ausschliesslich die gelisteten Namen. Keine neuen Eigennamen.
2) Keine zusaetzlichen Figuren oder Tiere mit Namen. Wenn unbedingt, dann nur unbenannt (z.B. \"einige Dorfbewohner\").
3) Keine Regieanweisungen, keine Meta-Saetze, keine englischen Anweisungen.
4) Jede Figur muss eine konkrete Handlung oder kurze Rede erhalten; keine Namensliste.
5) Erwaehne das Artefakt, wenn es gefordert ist (mit Namen).
6) ${lengthTargets.wordMin}-${lengthTargets.wordMax} Woerter, ${lengthTargets.sentenceMin}-${lengthTargets.sentenceMax} Saetze, kindgerecht.
7) Schreibstil wie hochwertige Kinderbuecher: bildhaft, rhythmisch, abwechslungsreiche Satzanfaenge, gelegentlich direkte Rede.
8) Vermeide wiederholte Standard-Saetze wie "gehoeren seit jeher" oder "ganz selbstverstaendlich dabei".
9) Avatare und Nebenfiguren muessen aktiv ins Geschehen eingebunden sein, nicht nur am Rand stehen.
10) Beende mit einem sanften Ausblick (ausser im letzten Kapitel).
${strict ? "11) Doppelt pruefen: Kein englischer Satz darf im Text erscheinen." : ""}

Gib JSON zurueck:
{ "title": "Kurzer Kapiteltitel", "text": "Kapiteltext" }`;
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
- Canon hint (subtext only, NOT verbatim, do not repeat): ${chapter.canonAnchorLine}
- Characters on stage (must include all):
${characterSummaries}
${artifactLine}

Allowed names (use exactly): ${allowedNames || "none"}

STRICT RULES:
1) Use only the listed character names exactly as given. No extra named characters.
2) Do not introduce any additional named characters or animals; if absolutely needed, keep them unnamed.
3) Each character must have a concrete action or short line; no name lists.
4) Mention the artifact if required (by name).
5) Write ${lengthTargets.wordMin}-${lengthTargets.wordMax} words, ${lengthTargets.sentenceMin}-${lengthTargets.sentenceMax} sentences, age-appropriate.
6) Children's-book style: vivid imagery, rhythmic flow, varied sentence starts, occasional dialogue.
7) Avoid repetitive stock lines like "always been part of this tale" or "naturally belongs here".
8) Avatars and supporting characters must be actively involved, not just present.
9) End with a gentle forward-looking line (except final chapter).
${strict ? "10) Do not include any instruction text or meta commentary in the output." : ""}

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
  issues: string[];
  originalText: string;
}): string {
  const { chapter, cast, dna, language, ageRange, tone, lengthHint, pacing, issues, originalText } = input;
  const isGerman = language === "de";
  const lengthTargets = resolveLengthTargets({ lengthHint, ageRange, pacing });
  const artifactName = cast.artifact?.name?.trim();
  const characterNames = chapter.charactersOnStage
    .map(slot => findCharacterBySlot(cast, slot)?.displayName)
    .filter(Boolean) as string[];
  const allowedNames = Array.from(new Set(characterNames)).join(", ");

  const issueList = issues.length > 0 ? issues.map(issue => `- ${issue}`).join("\n") : "- Keine";

  if (isGerman) {
    return `Ueberarbeite das folgende Kapitel, ohne den Inhalt zu verlieren, aber erfuelle alle Regeln.

PROBLEME:
${issueList}

SZENEN-VORGABE:
- Setting: ${chapter.setting}
- Stimmung: ${chapter.mood ?? "COZY"}
- Ziel: ${chapter.goal}
- Konflikt: ${chapter.conflict}
- Ausgang: ${chapter.outcome}
- Kanonischer Hinweis (Subtext, NICHT wortwoertlich): ${chapter.canonAnchorLine}
- Figuren (muessen vorkommen): ${allowedNames || "keine"}
- Artefakt: ${chapter.artifactUsage}${artifactName ? ` (Name: ${artifactName} muss genannt werden)` : ""}
- Ton: ${tone ?? dna.toneBounds?.targetTone ?? "warm"}

REGELN:
1) Nur diese Namen verwenden: ${allowedNames || "keine"}.
2) Keine neuen Eigennamen.
3) Keine Meta-Texte oder Anweisungen.
4) Jede Figur muss handeln oder sprechen.
5) Vermeide die Phrasen "gehoeren seit jeher" und "ganz selbstverstaendlich dabei".
6) ${lengthTargets.wordMin}-${lengthTargets.wordMax} Woerter, ${lengthTargets.sentenceMin}-${lengthTargets.sentenceMax} Saetze.
7) Stil wie hochwertige Kinderbuecher: bildhaft, rhythmisch, abwechslungsreich.

ORIGINALTEXT:
${originalText}

Gib JSON zurueck:
{ "title": "Kurzer Kapiteltitel", "text": "Kapiteltext" }`;
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
- Canon hint (subtext only): ${chapter.canonAnchorLine}
- Characters (must appear): ${allowedNames || "none"}
- Artifact: ${chapter.artifactUsage}${artifactName ? ` (Name: ${artifactName} must be named)` : ""}
- Tone: ${tone ?? dna.toneBounds?.targetTone ?? "warm"}

RULES:
1) Use only these names: ${allowedNames || "none"}.
2) No new proper names.
3) No meta-instructions.
4) Every character must act or speak.
5) Avoid phrases like "always been part of this tale" or "naturally belongs here".
6) ${lengthTargets.wordMin}-${lengthTargets.wordMax} words, ${lengthTargets.sentenceMin}-${lengthTargets.sentenceMax} sentences.
7) Children's-book style: vivid, rhythmic, varied sentence starts.

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

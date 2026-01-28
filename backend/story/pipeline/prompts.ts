import type { CastSet, SceneDirective, StoryDNA, TaleDNA } from "./types";

export function buildStoryChapterPrompt(input: {
  chapter: SceneDirective;
  cast: CastSet;
  dna: TaleDNA | StoryDNA;
  language: string;
  ageRange: { min: number; max: number };
  tone?: string;
  strict?: boolean;
}): string {
  const { chapter, cast, dna, language, ageRange, tone, strict } = input;
  const isGerman = language === "de";
  const characterSummaries = chapter.charactersOnStage
    .map(slot => {
      const sheet = findCharacterBySlot(cast, slot);
      if (!sheet) return null;
      return `${sheet.displayName} (${sheet.roleType}) - ${sheet.visualSignature.join(", ")}`;
    })
    .filter(Boolean)
    .join("\n");

  const allowedNames = Array.from(new Set(
    chapter.charactersOnStage
      .map(slot => findCharacterBySlot(cast, slot)?.displayName)
      .filter(Boolean) as string[]
  )).join(", ");

  const artifactLine = chapter.artifactUsage
    ? (isGerman ? `Artefakt: ${chapter.artifactUsage}` : `Artifact usage: ${chapter.artifactUsage}`)
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
- Kanonische Zeile (natuerlich einbauen): ${chapter.canonAnchorLine}
- Figuren auf der Buehne (alle muessen vorkommen):
${characterSummaries}
${artifactLine}

ERLAUBTE NAMEN (exakt so schreiben): ${allowedNames || "keine"}

STRICTE REGELN:
1) Verwende ausschliesslich die gelisteten Namen. Keine neuen Eigennamen.
2) Keine zusaetzlichen Figuren oder Tiere mit Namen. Wenn unbedingt, dann nur unbenannt (z.B. \"einige Dorfbewohner\").
3) Keine Regieanweisungen, keine Meta-Saetze, keine englischen Anweisungen.
4) Erwaehne das Artefakt, wenn es gefordert ist.
5) 120-200 Woerter, 3-6 Saetze, kindgerecht.
6) Beende mit einem sanften Ausblick (ausser im letzten Kapitel).
${strict ? "7) Doppelt pruefen: Kein englischer Satz darf im Text erscheinen." : ""}

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
- Canon anchor line (must include naturally): ${chapter.canonAnchorLine}
- Characters on stage (must include all):
${characterSummaries}
${artifactLine}

Allowed names (use exactly): ${allowedNames || "none"}

STRICT RULES:
1) Use only the listed character names exactly as given. No extra named characters.
2) Do not introduce any additional named characters or animals; if absolutely needed, keep them unnamed.
3) Mention the artifact if required.
4) Integrate the canon anchor line naturally.
5) Write 120-200 words, 3-6 sentences, age-appropriate.
6) End with a gentle forward-looking line (except final chapter).
${strict ? "7) Do not include any instruction text or meta commentary in the output." : ""}

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

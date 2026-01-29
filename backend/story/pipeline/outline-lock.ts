import type { CastSet, NormalizedRequest, StoryBible, StoryOutline, StoryOutlineChapter } from "./types";
import { callChatCompletion } from "./llm-client";

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function validateOutline(input: any, chapterCount: number): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!input || typeof input !== "object") return { valid: false, errors: ["Outline not an object"] };
  if (!Array.isArray(input.chapters) || input.chapters.length !== chapterCount) {
    errors.push(`Outline chapters must have length ${chapterCount}`);
  } else {
    input.chapters.forEach((ch: any, idx: number) => {
      const required = ["title", "subgoal", "reversal", "hook"];
      required.forEach((key) => {
        if (typeof ch?.[key] !== "string" || ch[key].trim().length < 2) {
          errors.push(`chapters[${idx}] missing ${key}`);
        }
      });
      if (ch?.chapter !== idx + 1) {
        errors.push(`chapters[${idx}] chapter must be ${idx + 1}`);
      }
    });
  }
  return { valid: errors.length === 0, errors };
}

function buildOutlinePrompt(input: {
  normalized: NormalizedRequest;
  storyBible: StoryBible;
  cast: CastSet;
  chapterCount: number;
}): string {
  const { normalized, storyBible, cast, chapterCount } = input;
  const isGerman = normalized.language === "de";
  const characterList = [
    ...cast.avatars.map(a => a.displayName),
    ...cast.poolCharacters.map(c => c.displayName),
  ].join(", ");
  const arcs = storyBible.chapterArcs
    .map(arc => `Kapitel ${arc.chapter}: Subgoal=${arc.subgoal}; Reversal=${arc.reversal}; Hook=${arc.carryOverHook}`)
    .join("\n");

  if (isGerman) {
    return `Erstelle eine Kapitel-Outline (Outline Lock).

StoryBible:
Goal: ${storyBible.coreGoal}
Problem: ${storyBible.coreProblem}
Mystery: ${storyBible.mysteryOrQuestion}
Figuren: ${characterList}

Kapitel-Arc Vorgaben:
${arcs}

REGELN:
1) Keine neuen Figuren.
2) Ein Titel pro Kapitel.
3) Subgoal/Reversal/Hook muessen klar sein.

Gib JSON:
{
  "chapters": [
    { "chapter": 1, "title": "...", "subgoal": "...", "reversal": "...", "hook": "...", "entryNotes": ["..."], "exitNotes": ["..."], "artifactBeat": "..." }
  ],
  "artifactArc": { "introduceChapter": ${storyBible.artifactArc?.introduceChapter ?? 1}, "attemptChapter": ${storyBible.artifactArc?.attemptChapter ?? 2}, "decisiveChapter": ${storyBible.artifactArc?.decisiveChapter ?? chapterCount}, "note": "..." }
}`;
  }

  return `Create a chapter outline (Outline Lock).

StoryBible:
Goal: ${storyBible.coreGoal}
Problem: ${storyBible.coreProblem}
Mystery: ${storyBible.mysteryOrQuestion}
Characters: ${characterList}

Chapter arc constraints:
${storyBible.chapterArcs.map(arc => `Chapter ${arc.chapter}: Subgoal=${arc.subgoal}; Reversal=${arc.reversal}; Hook=${arc.carryOverHook}`).join("\n")}

RULES:
1) No new characters.
2) One title per chapter.
3) Subgoal/Reversal/Hook must be clear.

Return JSON:
{
  "chapters": [
    { "chapter": 1, "title": "...", "subgoal": "...", "reversal": "...", "hook": "...", "entryNotes": ["..."], "exitNotes": ["..."], "artifactBeat": "..." }
  ],
  "artifactArc": { "introduceChapter": ${storyBible.artifactArc?.introduceChapter ?? 1}, "attemptChapter": ${storyBible.artifactArc?.attemptChapter ?? 2}, "decisiveChapter": ${storyBible.artifactArc?.decisiveChapter ?? chapterCount}, "note": "..." }
}`;
}

export async function createStoryOutline(input: {
  normalized: NormalizedRequest;
  storyBible: StoryBible;
  cast: CastSet;
  chapterCount: number;
}): Promise<StoryOutline> {
  const { normalized, storyBible, cast, chapterCount } = input;
  const model = normalized.rawConfig.aiModel || "gpt-5-mini";
  const prompt = buildOutlinePrompt({ normalized, storyBible, cast, chapterCount });

  const isReasoningModel = model.includes("gpt-5") || model.includes("o4");
  const maxTokens = isReasoningModel ? 3500 : 1400;

  const result = await callChatCompletion({
    model,
    messages: [
      { role: "system", content: normalized.language === "de" ? "Du planst Kapitel strukturiert." : "You structure chapter outlines." },
      { role: "user", content: prompt },
    ],
    responseFormat: "json_object",
    maxTokens,
    temperature: 0.3,
    seed: normalized.variantSeed,
    context: "story-outline",
  });

  let parsed = safeJson(result.content);
  let validation = validateOutline(parsed, chapterCount);
  if (!validation.valid) {
    const repairPrompt = `${prompt}\n\nERRORS:\n${validation.errors.join("\n")}\n\nFix and return valid JSON only.`;
    const repaired = await callChatCompletion({
      model,
      messages: [
        { role: "system", content: normalized.language === "de" ? "Korrigiere Outline JSON." : "Fix the outline JSON." },
        { role: "user", content: repairPrompt },
      ],
      responseFormat: "json_object",
      maxTokens,
      temperature: 0.2,
      seed: normalized.variantSeed,
      context: "story-outline-repair",
    });
    parsed = safeJson(repaired.content);
    validation = validateOutline(parsed, chapterCount);
    if (!validation.valid) {
      throw new Error(`Story outline validation failed: ${validation.errors.join("; ")}`);
    }
  }

  const chapters = (parsed.chapters as StoryOutlineChapter[]).map((ch: StoryOutlineChapter, idx: number) => ({
    ...ch,
    chapter: idx + 1,
  }));

  return {
    chapters,
    artifactArc: parsed.artifactArc,
  };
}

import type { AISceneDescription, AICharacterAction, CastSet, SceneDirective, StoryChapterText } from "./types";
import { callChatCompletion } from "./llm-client";

const MODEL = "gpt-5-nano";
const MAX_CHAPTER_WORDS = 360;
const LEAD_WORDS = 200;
const TAIL_WORDS = 180;
const MAX_RETRIES = 1;

export async function generateSceneDescriptions(input: {
  chapters: StoryChapterText[];
  directives: SceneDirective[];
  cast: CastSet;
  language: string;
}): Promise<{ descriptions: (AISceneDescription | null)[]; usage?: any }> {
  const { chapters, directives, cast, language } = input;

  const characterMap = buildCharacterMap(cast);

  const chapterInputs = chapters
    .map((chapter) => {
      const directive = directives.find(d => d.chapter === chapter.chapter);
      if (!directive) return null;

      const onStageSlots = directive.charactersOnStage.filter(s => !s.includes("ARTIFACT"));
      const onStageNames = onStageSlots
        .map(slot => characterMap.get(slot))
        .filter(Boolean) as string[];

      return {
        chapter,
        directive,
        onStageSlots,
        onStageNames,
      };
    })
    .filter(Boolean) as Array<{
      chapter: StoryChapterText;
      directive: SceneDirective;
      onStageSlots: string[];
      onStageNames: string[];
    }>;

  const batchResult = await extractBatchWithRetry({
    chapterInputs,
    language,
  });

  const results = chapterInputs.map((inputEntry) => {
    const match = batchResult.find(item => item.chapter === inputEntry.chapter.chapter);
    return normalizeSceneDescription({
      chapter: inputEntry.chapter,
      directive: inputEntry.directive,
      onStageSlots: inputEntry.onStageSlots,
      onStageNames: inputEntry.onStageNames,
      parsed: match,
    });
  });

  const successCount = results.filter(Boolean).length;
  const failCount = results.length - successCount;
  console.log(`[scene-prompt-generator] Completed: ${successCount}/${results.length} chapters in single batch (${failCount} fallback to templates)`);

  return { descriptions: results };
}

async function extractBatchWithRetry(input: {
  chapterInputs: Array<{
    chapter: StoryChapterText;
    directive: SceneDirective;
    onStageSlots: string[];
    onStageNames: string[];
  }>;
  language: string;
}): Promise<Array<any>> {
  const { chapterInputs } = input;
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      return await extractBatchSceneDescriptions(chapterInputs);
    } catch (error) {
      const isLastAttempt = attempt > MAX_RETRIES;
      if (isLastAttempt) {
        console.warn(
          `[scene-prompt-generator] Batch failed after ${MAX_RETRIES + 1} attempts, using default template prompts.`,
          (error as Error)?.message || error
        );
        return [];
      }
      console.warn(
        `[scene-prompt-generator] Batch attempt ${attempt}/${MAX_RETRIES + 1} failed, retrying...`,
        (error as Error)?.message || error
      );
    }
  }
  return [];
}

async function extractBatchSceneDescriptions(chapterInputs: Array<{
  chapter: StoryChapterText;
  directive: SceneDirective;
  onStageSlots: string[];
  onStageNames: string[];
}>): Promise<Array<any>> {
  const systemPrompt = `Extract the single most dynamic visual moment for EACH chapter. Output English JSON only. Each character must have a UNIQUE physical action and pose. Actions/bodyLanguage/expressions must be verb phrases only (no names, no pronouns, no other characters). Choose a moment where ALL listed characters are present at the same time. Do NOT add new characters or background people. Use only details explicitly present in the chapter text or directives. If "Must show" items are provided, include them in keyProps or environment. Be concise.`;

  const chapterBlocks = chapterInputs.map((input) => {
    const { chapter, directive, onStageSlots, onStageNames } = input;
    const truncatedText = buildSceneSnippet(chapter.text, MAX_CHAPTER_WORDS, LEAD_WORDS, TAIL_WORDS);
    const characterList = onStageNames.map((name, idx) => `${onStageSlots[idx]}: ${name}`).join(", ");
    const mustShow = (directive.imageMustShow || []).slice(0, 8).join(", ");
    const slotList = onStageSlots.map((s) => `"${s}"`).join(", ");

    return `CHAPTER ${chapter.chapter}: "${chapter.title}"
${truncatedText}
Setting: ${directive.setting}
Mood: ${directive.mood ?? "COZY"}
Goal: ${directive.goal}
Conflict: ${directive.conflict}
Outcome: ${directive.outcome}
Artifact usage: ${directive.artifactUsage}
Must show (visual hints): ${mustShow || "none"}
Characters: ${characterList}
Use exactly these slotKeys: ${slotList}`;
  }).join("\n\n---\n\n");

  const userPrompt = `${chapterBlocks}

Return JSON with this exact structure:
{
  "chapters": [
    {
      "chapter": number,
      "keyMoment": "...",
      "characterActions": [
        { "slotKey": "EXACT_SLOT", "action": "physical verb phrase", "expression": "face", "bodyLanguage": "pose" }
      ],
      "environment": "scene background",
      "cameraAngle": "angle (wide/medium shot only, NO portraits/close-ups)",
      "keyProps": ["obj1", "obj2"],
      "lighting": "light desc",
      "emotionalTone": "mood"
    }
  ]
}`;

  const result = await callChatCompletion({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    model: MODEL,
    responseFormat: "json_object",
    maxTokens: 4000,
    temperature: 0.6,
    context: "scene-prompt-generator-batch",
  });

  let parsed: any;
  try {
    parsed = JSON.parse(result.content);
  } catch (parseError) {
    console.error(`[scene-prompt-generator] Batch JSON parse failed. Raw response (first 800 chars): ${result.content?.substring(0, 800)}`);
    throw parseError;
  }

  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.chapters)) return parsed.chapters;
  return [];
}

function normalizeSceneDescription(input: {
  chapter: StoryChapterText;
  directive: SceneDirective;
  onStageSlots: string[];
  onStageNames: string[];
  parsed?: any;
}): AISceneDescription | null {
  const { chapter, onStageSlots, onStageNames, parsed } = input;
  if (!parsed) return null;

  const characterActions: AICharacterAction[] = onStageSlots.map((slot, i) => {
    const found = parsed.characterActions?.find((a: any) => a.slotKey === slot);
    if (found) {
      return {
        slotKey: slot,
        action: String(found.action || "stands in scene"),
        expression: String(found.expression || "neutral expression"),
        bodyLanguage: String(found.bodyLanguage || "standing"),
      };
    }
    return {
      slotKey: slot,
      action: `${onStageNames[i] || "character"} participates in the scene`,
      expression: "engaged expression",
      bodyLanguage: "active stance",
    };
  });

  return {
    chapter: chapter.chapter,
    keyMoment: String(parsed.keyMoment || ""),
    characterActions,
    environment: String(parsed.environment || ""),
    cameraAngle: String(parsed.cameraAngle || "wide shot, eye-level"),
    keyProps: Array.isArray(parsed.keyProps) ? parsed.keyProps.map(String) : [],
    lighting: String(parsed.lighting || "natural light"),
    emotionalTone: String(parsed.emotionalTone || "neutral"),
  };
}

function buildSceneSnippet(text: string, maxWords: number, leadWords: number, tailWords: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text;

  const lead = words.slice(0, leadWords).join(" ");
  const tail = words.slice(Math.max(leadWords, words.length - tailWords)).join(" ");
  return `${lead} ... ${tail}`;
}

function buildCharacterMap(cast: CastSet): Map<string, string> {
  const map = new Map<string, string>();
  for (const avatar of cast.avatars) {
    map.set(avatar.slotKey, avatar.displayName);
  }
  for (const character of cast.poolCharacters) {
    map.set(character.slotKey, character.displayName);
  }
  return map;
}

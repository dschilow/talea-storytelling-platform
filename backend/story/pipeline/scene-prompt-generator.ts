import type { AISceneDescription, AICharacterAction, CastSet, SceneDirective, StoryChapterText } from "./types";
import { callChatCompletion } from "./llm-client";

const MODEL = "gpt-5-mini";
const MAX_CHAPTER_WORDS = 360;
const LEAD_WORDS = 200;
const TAIL_WORDS = 180;
const MAX_RETRIES = 2;

export async function generateSceneDescriptions(input: {
  chapters: StoryChapterText[];
  directives: SceneDirective[];
  cast: CastSet;
  language: string;
}): Promise<{ descriptions: (AISceneDescription | null)[]; usage?: any }> {
  const { chapters, directives, cast, language } = input;

  const characterMap = buildCharacterMap(cast);

  const results = await Promise.all(
    chapters.map(async (chapter) => {
      const directive = directives.find(d => d.chapter === chapter.chapter);
      if (!directive) return null;

      const onStageSlots = directive.charactersOnStage.filter(s => !s.includes("ARTIFACT"));
      const onStageNames = onStageSlots
        .map(slot => characterMap.get(slot))
        .filter(Boolean) as string[];

      return await extractWithRetry({
        chapter,
        directive,
        onStageSlots,
        onStageNames,
        language,
      });
    })
  );

  const successCount = results.filter(Boolean).length;
  const failCount = results.length - successCount;
  console.log(`[scene-prompt-generator] Completed: ${successCount}/${results.length} chapters (${failCount} fallback to templates)`);

  return { descriptions: results };
}

async function extractWithRetry(input: {
  chapter: StoryChapterText;
  directive: SceneDirective;
  onStageSlots: string[];
  onStageNames: string[];
  language: string;
}): Promise<AISceneDescription | null> {
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      return await extractSceneDescription(input);
    } catch (error) {
      const isLastAttempt = attempt > MAX_RETRIES;
      if (isLastAttempt) {
        console.warn(
          `[scene-prompt-generator] Chapter ${input.chapter.chapter}: all ${MAX_RETRIES + 1} attempts failed, using default template prompts.`,
          (error as Error)?.message || error
        );
        return null;
      }
      console.warn(
        `[scene-prompt-generator] Chapter ${input.chapter.chapter}: attempt ${attempt}/${MAX_RETRIES + 1} failed, retrying...`,
        (error as Error)?.message || error
      );
    }
  }
  return null;
}

async function extractSceneDescription(input: {
  chapter: StoryChapterText;
  directive: SceneDirective;
  onStageSlots: string[];
  onStageNames: string[];
  language: string;
}): Promise<AISceneDescription> {
  const { chapter, directive, onStageSlots, onStageNames } = input;

  const truncatedText = buildSceneSnippet(chapter.text, MAX_CHAPTER_WORDS, LEAD_WORDS, TAIL_WORDS);
  const characterList = onStageNames.map((name, idx) => `${onStageSlots[idx]}: ${name}`).join(", ");
  const mustShow = (directive.imageMustShow || []).slice(0, 8).join(", ");

  const systemPrompt = `Extract the single most dynamic visual moment from a children's story chapter. Output English JSON only. Each character must have a UNIQUE physical action and pose. Choose a moment where ALL listed characters are present at the same time. Do NOT add new characters. Use only details explicitly present in the chapter text or directives. If "Must show" items are provided, include them in keyProps or environment. Be concise.`;

  const slotList = onStageSlots.map((s, i) => `"${s}"`).join(", ");

  const userPrompt = `Chapter ${chapter.chapter}: "${chapter.title}"

${truncatedText}

Setting: ${directive.setting}
Mood: ${directive.mood ?? "COZY"}
Goal: ${directive.goal}
Conflict: ${directive.conflict}
Outcome: ${directive.outcome}
Artifact usage: ${directive.artifactUsage}
Must show (visual hints): ${mustShow || "none"}

Characters: ${characterList}

Return JSON with these exact fields (keep values short, 5-15 words each):
{"keyMoment":"...", "characterActions":[{"slotKey":"EXACT_SLOT","action":"physical verb phrase","expression":"face","bodyLanguage":"pose"}], "environment":"scene background","cameraAngle":"angle (wide/medium shot only, NO portraits/close-ups)","keyProps":["obj1","obj2"],"lighting":"light desc","emotionalTone":"mood"}

Use exactly these slotKeys: ${slotList}. One entry per character.`;

  const result = await callChatCompletion({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    model: MODEL,
    responseFormat: "json_object",
    maxTokens: 1500,
    temperature: 0.6,
    context: "scene-prompt-generator",
  });

  let parsed: any;
  try {
    parsed = JSON.parse(result.content);
  } catch (parseError) {
    console.error(`[scene-prompt-generator] Chapter ${chapter.chapter}: JSON parse failed. Raw response (first 500 chars): ${result.content?.substring(0, 500)}`);
    throw parseError;
  }

  // Ensure characterActions has correct slotKeys
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
    // Fallback if AI didn't return this character
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

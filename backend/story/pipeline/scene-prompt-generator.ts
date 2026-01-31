import type { AISceneDescription, AICharacterAction, CastSet, SceneDirective, StoryChapterText } from "./types";
import { callChatCompletion } from "./llm-client";

const MODEL = "gpt-5-nano";
const MAX_CHAPTER_WORDS = 400;
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
  onStageSlots: string[];
  onStageNames: string[];
  language: string;
}): Promise<AISceneDescription> {
  const { chapter, onStageSlots, onStageNames, language } = input;

  const truncatedText = truncateText(chapter.text, MAX_CHAPTER_WORDS);
  const characterList = onStageNames.map((name, i) => `${onStageSlots[i]}: ${name}`).join("\n");

  const systemPrompt = `You are a visual scene extractor for children's storybook illustrations. Given a story chapter text, extract the single most visually interesting and dynamic moment. Focus on physical actions, body positions, and facial expressions. All output must be in English (for image generation), regardless of the story language.

IMPORTANT RULES:
- Characters must be doing something SPECIFIC and PHYSICAL (not just standing/sitting)
- Each character needs a UNIQUE pose and action (no two characters doing the same thing)
- Environment must be SPECIFIC to this scene (not generic)
- Camera angle should enhance the drama of the moment
- Return valid JSON only, no markdown`;

  const userPrompt = `Story chapter ${chapter.chapter}: "${chapter.title}"

TEXT (${language}):
${truncatedText}

CHARACTERS ON STAGE:
${characterList}

Extract the most visually striking moment from this chapter text. Return JSON:
{
  "keyMoment": "one-sentence description of the key visual moment",
  "characterActions": [
    {
      "slotKey": "SLOT_KEY",
      "action": "specific physical action verb phrase",
      "expression": "facial expression description",
      "bodyLanguage": "full body pose description"
    }
  ],
  "environment": "detailed background/setting description for this specific scene",
  "cameraAngle": "camera angle and framing suggestion",
  "keyProps": ["important visible objects"],
  "lighting": "lighting and atmosphere description",
  "emotionalTone": "emotional quality word or phrase"
}

Return one entry per character in characterActions. Use the exact slotKey values provided.`;

  const result = await callChatCompletion({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    model: MODEL,
    responseFormat: "json_object",
    maxTokens: 800,
    temperature: 0.6,
    context: "scene-prompt-generator",
  });

  const parsed = JSON.parse(result.content);

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

function truncateText(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ") + "...";
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

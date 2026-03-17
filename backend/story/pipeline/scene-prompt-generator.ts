import type { AISceneDescription, AICharacterAction, CastSet, SceneDirective, StoryChapterText, StoryCostEntry, TokenUsage } from "./types";
import { callChatCompletion } from "./llm-client";
import { buildLlmCostEntry, mergeNormalizedTokenUsage } from "./cost-ledger";
import { generateWithGemini } from "../gemini-generation";
import { resolveSupportTaskModel } from "./model-routing";

const DEFAULT_MODEL = "gpt-5-nano";
const MAX_CHAPTER_WORDS = 220;
const LEAD_WORDS = 130;
const TAIL_WORDS = 80;
const MAX_RETRIES = 1;
const CHAPTER_BATCH_SIZE = 3;
const INLINE_TTS_TAG_PATTERN = /\[([^\]\n]{1,40})\]/g;
const KNOWN_TTS_TAGS = new Set<string>([
  "excited",
  "dramatic",
  "thoughtful",
  "curious",
  "whisper",
  "whispers",
  "whispering",
  "gulps",
  "gulp",
  "nervous",
  "laughs",
  "laugh",
  "sad",
  "happy",
  "angry",
  "calm",
  "serious",
  "short pause",
]);

function resolveScenePromptModel(selectedStoryModel?: string): string {
  return resolveSupportTaskModel(selectedStoryModel) || DEFAULT_MODEL;
}

function normalizeTag(tag: string): string {
  return String(tag || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyTtsEmotionTag(tag: string): boolean {
  const normalized = normalizeTag(tag);
  if (!normalized) return false;
  if (KNOWN_TTS_TAGS.has(normalized)) return true;
  if (normalized.includes("pause") || normalized.includes("beat")) return true;
  if (normalized.includes("whisper")) return true;
  if (normalized.includes("laugh")) return true;
  if (normalized.includes("excit")) return true;
  if (normalized.includes("dramatic")) return true;
  return false;
}

function stripTtsEmotionTags(text: string): string {
  return String(text || "")
    .replace(INLINE_TTS_TAG_PATTERN, (fullTag, innerTag) => (
      isLikelyTtsEmotionTag(String(innerTag || "")) ? " " : fullTag
    ))
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.;!?])/g, "$1")
    .trim();
}

export async function generateSceneDescriptions(input: {
  chapters: StoryChapterText[];
  directives: SceneDirective[];
  cast: CastSet;
  language: string;
  storyId?: string;
  selectedStoryModel?: string;
}): Promise<{ descriptions: (AISceneDescription | null)[]; usage?: TokenUsage; costEntries?: StoryCostEntry[] }> {
  const { chapters, directives, cast, language, storyId, selectedStoryModel } = input;
  const scenePromptModel = resolveScenePromptModel(selectedStoryModel);
  let usage: TokenUsage | undefined;
  const costEntries: StoryCostEntry[] = [];

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

  const batchResults: Array<any> = [];
  for (let i = 0; i < chapterInputs.length; i += CHAPTER_BATCH_SIZE) {
    const chunk = chapterInputs.slice(i, i + CHAPTER_BATCH_SIZE);
    const chunkResult = await extractBatchWithRetry({
      chapterInputs: chunk,
      language,
      storyId,
      model: scenePromptModel,
    });
    batchResults.push(...chunkResult.entries);
    usage = mergeNormalizedTokenUsage(usage, chunkResult.usage, scenePromptModel);
    if (chunkResult.costEntry) {
      costEntries.push(chunkResult.costEntry);
    }
  }

  const byChapter = new Map<number, any>();
  for (const item of batchResults) {
    const chapterNumber = normalizeChapterNumber(item?.chapter);
    if (!chapterNumber) continue;
    byChapter.set(chapterNumber, item);
  }

  const results = chapterInputs.map((inputEntry) => {
    const match = byChapter.get(inputEntry.chapter.chapter);
    return normalizeSceneDescription({
      chapter: inputEntry.chapter,
      onStageSlots: inputEntry.onStageSlots,
      onStageNames: inputEntry.onStageNames,
      parsed: match,
    });
  });

  const successCount = results.filter(Boolean).length;
  const failCount = results.length - successCount;
  console.log(`[scene-prompt-generator] Completed: ${successCount}/${results.length} chapters (${failCount} fallback to templates)`);

  return { descriptions: results, usage, costEntries };
}

async function extractBatchWithRetry(input: {
  chapterInputs: Array<{
    chapter: StoryChapterText;
    directive: SceneDirective;
    onStageSlots: string[];
    onStageNames: string[];
  }>;
  language: string;
  storyId?: string;
  model: string;
}): Promise<{ entries: any[]; usage?: TokenUsage; costEntry: StoryCostEntry | null }> {
  const { chapterInputs, storyId, language, model } = input;
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      return await extractBatchSceneDescriptions(chapterInputs, storyId, language, model);
    } catch (error) {
      const isLastAttempt = attempt > MAX_RETRIES;
      if (isLastAttempt) {
        console.warn(
          `[scene-prompt-generator] Batch failed after ${MAX_RETRIES + 1} attempts, using default template prompts.`,
          (error as Error)?.message || error
        );
        return { entries: [], usage: undefined as TokenUsage | undefined, costEntry: null as StoryCostEntry | null };
      }
      console.warn(
        `[scene-prompt-generator] Batch attempt ${attempt}/${MAX_RETRIES + 1} failed, retrying...`,
        (error as Error)?.message || error
      );
    }
  }
  return { entries: [], usage: undefined as TokenUsage | undefined, costEntry: null as StoryCostEntry | null };
}

async function extractBatchSceneDescriptions(
  chapterInputs: Array<{
    chapter: StoryChapterText;
    directive: SceneDirective;
    onStageSlots: string[];
    onStageNames: string[];
  }>,
  storyId?: string,
  language?: string,
  model: string = DEFAULT_MODEL,
): Promise<{ entries: any[]; usage?: TokenUsage; costEntry: StoryCostEntry | null }> {
  const systemPrompt = `You are an art director for a premium children's picture book (ages 4-10). Extract one vivid NARRATIVE MOMENT per chapter — the kind of scene a master illustrator like Quentin Blake, Shaun Tan or Beatrix Potter would paint.

CRITICAL RULES:
- Pick the most EMOTIONALLY CHARGED or VISUALLY DRAMATIC moment from the chapter text
- Every listed character appears exactly once, each doing something PHYSICALLY DIFFERENT
- Characters must INTERACT with each other, with props, or with the environment — NOT pose side by side
- Describe SPECIFIC body positions: "kneeling on one knee reaching into a hollow tree trunk" NOT "reaches for something"
- Include ENVIRONMENTAL INTERACTION: characters touching, climbing, hiding behind, peeking around, sitting on, leaning against scene elements
- Describe the environment as a LIVED-IN SPACE with texture: scattered leaves, flickering candles, muddy footprints, dangling vines — NOT clean/empty backgrounds
- Camera angle should TELL THE STORY: bird's-eye for chase scenes, worm's-eye for towering moments, over-shoulder for discoveries
- NO static poses (standing/looking/watching), NO camera-facing, NO group portraits, NO symmetrical lineups
- Actions must show CAUSE AND EFFECT: wind blowing hair back, water splashing from a jump, dust rising from running feet
- Think in PANELS of a graphic novel — capture mid-action, not before or after
- Concise outputs (vivid phrases, not long prose)
- English only, use details from chapter text + metadata.`;

  const chapterBlocks = chapterInputs.map((input) => {
    const { chapter, directive, onStageSlots, onStageNames } = input;
    const truncatedText = buildSceneSnippet(chapter.text, MAX_CHAPTER_WORDS, LEAD_WORDS, TAIL_WORDS);
    const characterList = onStageNames.map((name, idx) => `${onStageSlots[idx]}: ${name}`).join(", ");
    const mustShow = compactVisualHints(directive.imageMustShow || [], onStageNames).join(", ");
    const slotList = onStageSlots.map((s) => `"${s}"`).join(", ");

    return `CHAPTER ${chapter.chapter}
${truncatedText}
Setting: ${directive.setting}
Mood: ${directive.mood ?? "COZY"}
Beat goal: ${sanitizeSceneText(directive.goal || "").slice(0, 90) || "n/a"}
Must show: ${mustShow || "none"}
Characters: ${characterList}
Slots: ${slotList}`;
  }).join("\n\n---\n\n");

  const userPrompt = `Story language: ${language || "de"}.
${chapterBlocks}

For each chapter, find the single most VISUALLY EXCITING moment — where something is actively HAPPENING.
NOT a moment where characters are "arriving" or "discovering" — pick the moment of ACTION itself.

Return JSON:
{
  "chapters": [
    {
      "chapter": number,
      "keyMoment": "max 25 words — describe the frozen instant of peak action like a movie still",
      "characterActions": [
        {
          "slotKey": "EXACT_SLOT",
          "action": "specific physical verb + object + direction, e.g. 'lunges across the fallen log to grab the glowing feather mid-air'",
          "expression": "face muscles + emotion, e.g. 'eyes squeezed shut, teeth gritted, cheeks flushed with effort'",
          "bodyLanguage": "exact body geometry, e.g. 'one knee on the ground, torso twisted left, right arm stretched overhead'"
        }
      ],
      "environment": "setting with TEXTURE and MESS — scattered objects, weather effects, light beams, footprints, broken things, growing things",
      "cameraAngle": "cinematic angle that serves the story: bird's-eye / worm's-eye / dutch tilt / over-shoulder / through-gap — NOT just 'wide shot'",
      "keyProps": ["max 5 props that are DOING something: 'glowing feather tumbling through the air', 'cracked lantern leaking golden light'"],
      "lighting": "dramatic and specific: 'single shaft of amber sunset light cutting through dust motes' NOT just 'warm light'",
      "emotionalTone": "single vivid mood word"
    }
  ]
}`;

  // Keep batches smaller and reasoning minimal so the model returns JSON instead of burning
  // the entire completion budget on internal reasoning.
  const baseTokens = Math.max(1500, chapterInputs.length * 600);
  const isReasoningModel = model.includes("gpt-5") || model.includes("o4");
  const maxCompletionTokens = Math.min(isReasoningModel ? 8000 : 2400, baseTokens * (isReasoningModel ? 3 : 1));

  const isGeminiModel = model.startsWith("gemini-");
  const result = isGeminiModel
    ? await (async () => {
        const geminiResult = await generateWithGemini({
          systemPrompt,
          userPrompt,
          model,
          maxTokens: maxCompletionTokens,
          temperature: 0.6,
          thinkingBudget: model.includes("flash") ? 64 : 96,
          logSource: "phase6.5-scene-prompts-llm",
          logMetadata: { storyId, chapters: chapterInputs.length, model },
        });
        return {
          content: geminiResult.content,
          finishReason: geminiResult.finishReason,
          usage: {
            promptTokens: geminiResult.usage.promptTokens,
            completionTokens: geminiResult.usage.completionTokens,
            totalTokens: geminiResult.usage.totalTokens,
            model: geminiResult.model,
          },
        };
      })()
    : await callChatCompletion({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        model,
        responseFormat: "json_object",
        maxTokens: maxCompletionTokens,
        temperature: 0.6,
        reasoningEffort: "minimal",
        context: "scene-prompt-generator-batch",
        logSource: "phase6.5-scene-prompts-llm",
        logMetadata: { storyId, chapters: chapterInputs.length, model },
      });

  const costEntry = buildLlmCostEntry({
    phase: "phase6.5-scene-prompts",
    step: "scene-prompt-batch",
    usage: result.usage,
    fallbackModel: model,
    itemCount: chapterInputs.length,
    metadata: { storyId },
  });

  let parsed: any;
  try {
    parsed = JSON.parse(result.content);
  } catch (parseError) {
    console.error(`[scene-prompt-generator] Batch JSON parse failed. Raw response (first 800 chars): ${result.content?.substring(0, 800)}`);
    throw parseError;
  }

  const entries = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.chapters)
      ? parsed.chapters
      : [];

  return {
    entries,
    usage: result.usage,
    costEntry,
  };
}

function normalizeSceneDescription(input: {
  chapter: StoryChapterText;
  onStageSlots: string[];
  onStageNames: string[];
  parsed?: any;
}): AISceneDescription | null {
  const { chapter, onStageSlots, onStageNames, parsed } = input;
  if (!parsed) return null;

  const parsedActions = Array.isArray(parsed.characterActions) ? parsed.characterActions : [];
  const characterActions: AICharacterAction[] = onStageSlots.map((slot, index) => {
    const found = parsedActions.find((entry: any) => {
      if (slotKeyMatches(entry?.slotKey, slot)) return true;
      return slotNameMatches(entry, onStageNames[index]);
    });

    if (found) {
      return {
        slotKey: slot,
        action: sanitizeStaticAction(String(found.action || defaultFallbackAction(index))),
        expression: sanitizeExpression(String(found.expression || defaultFallbackExpression(index))),
        bodyLanguage: sanitizeStaticPose(String(found.bodyLanguage || defaultFallbackPose(index))),
      };
    }

    return {
      slotKey: slot,
      action: defaultFallbackAction(index),
      expression: defaultFallbackExpression(index),
      bodyLanguage: defaultFallbackPose(index),
    };
  });

  ensureUniqueActions(characterActions);

  return {
    chapter: chapter.chapter,
    keyMoment: sanitizeSceneText(String(parsed.keyMoment || "")),
    characterActions,
    environment: sanitizeSceneText(String(parsed.environment || "")),
    cameraAngle: sanitizeCameraAngle(String(parsed.cameraAngle || "wide shot, eye-level")),
    keyProps: Array.isArray(parsed.keyProps)
      ? parsed.keyProps.map((value: any) => String(value)).filter(Boolean).slice(0, 6)
      : [],
    lighting: sanitizeSceneText(String(parsed.lighting || "natural light")),
    emotionalTone: String(parsed.emotionalTone || "neutral"),
  };
}

function buildSceneSnippet(text: string, maxWords: number, leadWords: number, tailWords: number): string {
  const cleaned = stripTtsEmotionTags(text);
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return cleaned;

  const lead = words.slice(0, leadWords).join(" ");
  const tail = words.slice(Math.max(leadWords, words.length - tailWords)).join(" ");
  return `${lead} ... ${tail}`;
}

function sanitizeStaticAction(action: string): string {
  const trimmed = action.trim();
  if (!trimmed) return "moves decisively toward the key object";

  const staticPatterns: Array<[RegExp, string]> = [
    [/^stands?\s*(in|at|near|by)?\s*/i, "moves through "],
    [/^looks?\s*(at|toward)?\s*/i, "peers closely at "],
    [/^watches?\s*/i, "leans forward observing "],
    [/^is\s+present\s*/i, "reaches toward something nearby"],
    [/^participates?\s*/i, "gestures actively"],
    [/\bstands?\b/gi, "moves"],
    [/\blooks?\b/gi, "focuses"],
    [/\bwatches?\b/gi, "tracks"],
    [/\bposes?\b/gi, "moves dynamically"],
    [/\bsmiles?\s+at\s+camera\b/gi, "reacts to the unfolding scene"],
    [/\bfacing\s+camera\b/gi, "turned toward the scene"],
  ];

  for (const [pattern, replacement] of staticPatterns) {
    if (!pattern.test(trimmed)) continue;
    return trimmed.replace(pattern, replacement).trim();
  }

  return trimmed;
}

function sanitizeStaticPose(pose: string): string {
  const trimmed = pose.trim();
  if (!trimmed) return "leaning forward with one hand extended";

  const staticPoses: Array<[RegExp, string]> = [
    [/^standing(\s+still)?$/i, "leaning forward with weight shifted"],
    [/^standing\s+upright$/i, "turned sideways with one arm extended"],
    [/^idle$/i, "crouching slightly with hands active"],
    [/^neutral$/i, "mid-gesture with expressive body language"],
    [/\bfacing\s+camera\b/i, "turned three-quarter toward the action"],
    [/\bfront-facing\b/i, "angled side-on toward the action"],
    [/\bposed?\b/i, "mid-motion with active limbs"],
  ];

  for (const [pattern, replacement] of staticPoses) {
    if (pattern.test(trimmed)) return replacement;
  }
  return trimmed;
}

function sanitizeExpression(value: string): string {
  const cleaned = value.trim();
  if (!cleaned) return "focused expression";
  return cleaned
    .replace(/\bfacing\s+camera\b/gi, "focused on the scene")
    .replace(/\bphoto\s+pose\b/gi, "tense focus")
    .trim();
}

function sanitizeSceneText(text: string): string {
  if (!text) return "";
  return stripTtsEmotionTags(text)
    .replace(/\bportrait\b/gi, "scene")
    .replace(/\bselfie\b/gi, "storybook scene")
    .replace(/\bclose-?up\b/gi, "wide shot")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeCameraAngle(text: string): string {
  const normalized = sanitizeSceneText(text).toLowerCase();
  if (!normalized) return "wide shot, eye-level, full body visible head-to-toe";
  if (normalized.includes("close-up") || normalized.includes("portrait")) {
    return "wide shot, eye-level, full body visible head-to-toe";
  }
  if (normalized.includes("full body") || normalized.includes("head-to-toe")) {
    return normalized;
  }
  if (normalized.includes("wide") || normalized.includes("medium")) {
    return `${normalized}, full body visible head-to-toe`;
  }
  return "wide shot, eye-level, full body visible head-to-toe";
}

function normalizeChapterNumber(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw !== "string") return null;
  const parsed = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSlotKey(raw: unknown): string {
  return String(raw || "")
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "");
}

function slotKeyMatches(candidate: unknown, target: string): boolean {
  const left = normalizeSlotKey(candidate);
  const right = normalizeSlotKey(target);
  if (!left || !right) return false;
  if (left === right) return true;
  return left.endsWith(right) || right.endsWith(left);
}

function slotNameMatches(candidate: any, expectedName?: string): boolean {
  if (!expectedName) return false;
  const expected = expectedName.trim().toLowerCase();
  if (!expected) return false;
  const fields = [candidate?.slotKey, candidate?.name, candidate?.character, candidate?.characterName]
    .map(value => String(value || "").trim().toLowerCase())
    .filter(Boolean);
  return fields.some(value => value.includes(expected) || expected.includes(value));
}

function defaultFallbackAction(index: number): string {
  const actions = [
    "steps forward and reaches toward the key object",
    "crouches and points out a critical clue",
    "moves quickly to support the others",
    "lifts an important prop and brings it into play",
  ];
  return actions[index % actions.length];
}

function defaultFallbackPose(index: number): string {
  const poses = [
    "leaning forward with weight on one leg",
    "kneeling with one arm extended",
    "side-turned in an active ready stance",
    "mid-step with torso angled toward the action",
  ];
  return poses[index % poses.length];
}

function defaultFallbackExpression(index: number): string {
  const expressions = [
    "focused expression",
    "determined expression",
    "wide-eyed with urgency",
    "concentrated and alert",
  ];
  return expressions[index % expressions.length];
}

function ensureUniqueActions(actions: AICharacterAction[]): void {
  const seen = new Set<string>();
  actions.forEach((item, index) => {
    const normalized = item.action.toLowerCase().trim();
    if (!normalized) {
      item.action = defaultFallbackAction(index);
      return;
    }
    if (!seen.has(normalized)) {
      seen.add(normalized);
      return;
    }
    const uniqueAction = `${item.action} while shifting position`;
    item.action = uniqueAction;
    seen.add(uniqueAction.toLowerCase());
  });
}

function compactVisualHints(hints: string[], onStageNames: string[]): string[] {
  if (!Array.isArray(hints) || hints.length === 0) return [];

  const blocked = new Set(onStageNames.map(name => name.trim().toLowerCase()));
  const unique = new Set<string>();

  for (const raw of hints) {
    const normalized = String(raw || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!normalized) continue;

    const lower = normalized.toLowerCase();
    if (blocked.has(lower)) continue;

    const compact = normalized
      .split(/[.,;:]/)[0]
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 52);
    if (!compact) continue;

    unique.add(compact);
    if (unique.size >= 5) break;
  }

  return Array.from(unique);
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

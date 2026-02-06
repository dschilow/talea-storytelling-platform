import type { AISceneDescription, AICharacterAction, CastSet, SceneDirective, StoryChapterText } from "./types";
import { callChatCompletion } from "./llm-client";

const MODEL = "gpt-5-nano";
const MAX_CHAPTER_WORDS = 360;
const LEAD_WORDS = 200;
const TAIL_WORDS = 180;
const MAX_RETRIES = 1;
const CHAPTER_BATCH_SIZE = 4;

export async function generateSceneDescriptions(input: {
  chapters: StoryChapterText[];
  directives: SceneDirective[];
  cast: CastSet;
  language: string;
  storyId?: string;
}): Promise<{ descriptions: (AISceneDescription | null)[]; usage?: any }> {
  const { chapters, directives, cast, language, storyId } = input;

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
    });
    batchResults.push(...chunkResult);
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
  storyId?: string;
}): Promise<Array<any>> {
  const { chapterInputs, storyId, language } = input;
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      return await extractBatchSceneDescriptions(chapterInputs, storyId, language);
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

async function extractBatchSceneDescriptions(
  chapterInputs: Array<{
    chapter: StoryChapterText;
    directive: SceneDirective;
    onStageSlots: string[];
    onStageNames: string[];
  }>,
  storyId?: string,
  language?: string
): Promise<Array<any>> {
  const systemPrompt = `Extract the single most dynamic visual moment for EACH chapter. Output English JSON only.

CRITICAL ACTION RULES:
- Each character MUST have a UNIQUE, SPECIFIC physical action - NOT just "standing" or "looking".
- Actions must be DYNAMIC VERBS showing movement or interaction: "kneels and reaches toward", "climbs over a wall", "runs with arms outstretched", "crouches behind a bush peering out", "leans forward pointing at a map", "swings from a branch".
- FORBIDDEN actions: "stands", "looks", "watches", "is present", "participates". These are too static.
- Characters must interact with EACH OTHER or with PROPS - not pose for a camera.
- bodyLanguage must describe a SPECIFIC POSE, not just "standing": "crouching low", "leaning forward", "arms raised", "one knee on ground", "back turned halfway".
- expression must show EMOTION: "wide-eyed with wonder", "frowning with concentration", "grinning mischievously".
- Actions/bodyLanguage/expressions must be verb phrases only (no names, no pronouns, no other characters).
- Choose a moment where ALL listed characters are present at the same time.
- Do NOT add new characters or background people.
- Use only details explicitly present in the chapter text or directives.
- If "Must show" items are provided, include them in keyProps or environment.
- Be concise.`;

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

  const userPrompt = `Story language: ${language || "de"}.
${chapterBlocks}

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
    maxTokens: 3500,
    temperature: 0.6,
    context: "scene-prompt-generator-batch",
    logSource: "phase6.5-scene-prompts-llm",
    logMetadata: { storyId, chapters: chapterInputs.length },
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
    keyProps: Array.isArray(parsed.keyProps) ? parsed.keyProps.map((value: any) => String(value)) : [],
    lighting: sanitizeSceneText(String(parsed.lighting || "natural light")),
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
  return text
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

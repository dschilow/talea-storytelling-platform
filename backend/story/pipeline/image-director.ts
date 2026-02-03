import type { AISceneDescription, CastSet, ImageDirector, ImageSpec, NormalizedRequest, SceneDirective, StoryDraft } from "./types";
import { COLLAGE_MODE_NEGATIVES, GLOBAL_IMAGE_NEGATIVES, MAX_ON_STAGE_CHARACTERS } from "./constants";
import { buildFinalPromptText } from "./image-prompt-builder";
import { buildCollageReference, buildCollageRefsForSlots, buildRefsForSlots, selectReferenceSlots } from "./reference-images";
import type { CollageResult } from "./sprite-collage";

export class TemplateImageDirector implements ImageDirector {
  async createImageSpecs(input: {
    normalizedRequest: NormalizedRequest;
    cast: CastSet;
    directives: SceneDirective[];
    aiSceneDescriptions?: AISceneDescription[];
  }): Promise<ImageSpec[]> {
    const { cast, directives, aiSceneDescriptions, normalizedRequest } = input;
    const forceEnglish = true;

    // Build a lookup map for AI descriptions by chapter number
    const aiDescMap = new Map<number, AISceneDescription>();
    if (aiSceneDescriptions) {
      for (const desc of aiSceneDescriptions) {
        aiDescMap.set(desc.chapter, desc);
      }
    }

    // Collage cache: reuse the same collage for identical character sets (stores Promises to avoid races)
    const collageCache = new Map<string, Promise<CollageResult | null>>();

    return Promise.all(directives.map(async (directive) => {
      const onStageExact = directive.charactersOnStage.filter(slot => !slot.includes("ARTIFACT"));
      const refSlots = selectReferenceSlots(onStageExact, cast);

      // Attempt collage with cache (uses Promise dedup to avoid parallel rebuilds)
      const cacheKey = [...refSlots].sort().join("|");
      if (!collageCache.has(cacheKey)) {
        collageCache.set(cacheKey, buildCollageReference(refSlots, cast));
      }
      const collageResult = await collageCache.get(cacheKey)!;

      const refs = collageResult
        ? buildCollageRefsForSlots(collageResult, cast)
        : buildRefsForSlots(refSlots, cast);

      const baseNegatives = collageResult
        ? [...GLOBAL_IMAGE_NEGATIVES, ...COLLAGE_MODE_NEGATIVES]
        : GLOBAL_IMAGE_NEGATIVES;
      const negatives = Array.from(new Set([...baseNegatives, ...directive.imageAvoid]));
      const beatType = inferBeatType(directive);

      const aiDesc = aiDescMap.get(directive.chapter);

      // If AI description is available, use it for dynamic prompts
      // Otherwise fall back to template-based prompts
      let spec: ImageSpec = aiDesc
        ? buildAISpec(directive, cast, aiDesc, onStageExact, refs, negatives, normalizedRequest.language)
        : buildTemplateSpec(directive, cast, beatType, onStageExact, refs, negatives, normalizedRequest.language);

      if (forceEnglish) {
        spec = normalizeSpecToEnglish(spec);
      }

      spec.finalPromptText = buildFinalPromptText(spec, cast, { forceEnglish });
      if (collageResult) {
        spec.collageUrl = collageResult.collageUrl;
      }

      return spec;
    }));
  }
}

export async function buildCoverSpec(input: {
  normalizedRequest: NormalizedRequest;
  cast: CastSet;
  directives: SceneDirective[];
  storyDraft: StoryDraft;
}): Promise<ImageSpec> {
  const { cast, directives, storyDraft } = input;
  const coverChapter = storyDraft.chapters?.[0]?.chapter ?? 1;
  const directive = directives.find(d => d.chapter === coverChapter) ?? directives[0];
  const mood = directive?.mood || "COZY";
  const setting = directive?.setting ? toEnglish(directive.setting) : "storybook cover scene";

  const onStageExact = selectCoverSlots(cast, MAX_ON_STAGE_CHARACTERS);
  const refSlots = selectReferenceSlots(onStageExact, cast);
  const collageResult = await buildCollageReference(refSlots, cast);
  const refs = collageResult
    ? buildCollageRefsForSlots(collageResult, cast)
    : buildRefsForSlots(refSlots, cast);
  const baseCoverNegatives = collageResult
    ? [...GLOBAL_IMAGE_NEGATIVES, ...COLLAGE_MODE_NEGATIVES]
    : GLOBAL_IMAGE_NEGATIVES;
  const negatives = Array.from(new Set([...baseCoverNegatives, ...(directive?.imageAvoid || [])]));

  const propsVisible = directive ? limitPropsVisible(directive, cast) : [];
  const artifactName = cast.artifact?.name;
  if (artifactName && !propsVisible.includes(artifactName)) {
    propsVisible.unshift(artifactName);
  }

  const title = storyDraft.title || "Story";
  const desc = storyDraft.description ? ` ${storyDraft.description}` : "";
  const sceneDescription = `Book cover illustration for "${title}".${desc}`.trim();

  const style = `storybook cover illustration, ${getMoodTexture(mood, "SETUP")}${setting ? `, ${setting}` : ""}`;
  const composition = "storybook cover, title space at top, wide shot, full body visible head-to-toe";
  const blocking = "Characters arranged in a clear, cover-friendly grouping, interacting with the scene.";
  const actions = artifactName
    ? `Characters engage with the ${artifactName} and each other in a key moment.`
    : "Characters engage with each other in a key moment.";
  const lighting = mapLighting(mood);

  const spec: ImageSpec = {
    chapter: coverChapter,
    style,
    composition,
    blocking,
    actions,
    propsVisible,
    lighting,
    setting,
    sceneDescription,
    refs,
    negatives,
    onStageExact,
  };

  spec.finalPromptText = buildFinalPromptText(spec, cast, { forceEnglish: true });
  if (collageResult) {
    spec.collageUrl = collageResult.collageUrl;
  }
  return spec;
}

function selectCoverSlots(cast: CastSet, maxCharacters: number): string[] {
  const slots = [
    ...cast.avatars.map(a => a.slotKey),
    ...cast.poolCharacters.map(c => c.slotKey),
  ].filter(Boolean);
  return slots.slice(0, Math.max(1, maxCharacters));
}

// ─── AI-Powered Spec Builder ──────────────────────────────────────────────

function buildAISpec(
  directive: SceneDirective,
  cast: CastSet,
  aiDesc: AISceneDescription,
  onStageExact: string[],
  refs: Record<string, string>,
  negatives: string[],
  language: string,
): ImageSpec {
  const propsFromAI = filterPropsList(aiDesc.keyProps.slice(0, 7), cast, directive);
  const propsVisible = mergeProps(propsFromAI, limitPropsVisible(directive, cast));

  // Build blocking from AI character actions
  const blockingParts = aiDesc.characterActions.map((charAction) => {
    const name = findName(cast, charAction.slotKey);
    return `${name} ${charAction.bodyLanguage}, ${charAction.expression}`;
  });
  const blocking = blockingParts.join(". ") + ".";

  // Build actions from AI character actions
  const actionParts = aiDesc.characterActions.map((charAction) => {
    const name = findName(cast, charAction.slotKey);
    return `${name} ${charAction.action}`;
  });

  // Add artifact action if relevant
  const artifactAction = getArtifactAction(directive, cast, directive.mood || "COZY");
  if (artifactAction) actionParts.push(artifactAction);
  const actions = actionParts.join(". ") + ".";

  // Use AI environment for style, with mood texture overlay
  const mood = directive.mood || "COZY";
  const texture = getMoodTexture(mood, "CONFLICT");

  // Sanitize environment to remove forbidden portrait-like terms
  const sanitizedEnvironment = sanitizeForbiddenTerms(aiDesc.environment);
  const normalizedSetting = directive.setting ? toEnglish(directive.setting) : "";
  const environmentParts = dedupeEnvironmentParts([sanitizedEnvironment, normalizedSetting]);
  const environmentLine = environmentParts.length > 0 ? `, ${environmentParts.join(", ")}` : "";
  const style = `high-quality children's storybook illustration, ${texture}${environmentLine}`;

  // Use AI camera angle for composition, ensure full-body constraint
  let composition = sanitizeForbiddenTerms(aiDesc.cameraAngle);

  if (!composition.toLowerCase().includes("full body") && !composition.toLowerCase().includes("head-to-toe")) {
    composition += ", full body visible head-to-toe";
  }
  if (onStageExact.length >= 3) {
    composition = "wide shot, eye-level, full body visible head-to-toe";
  }

  // Sanitize all AI-generated text fields to avoid validation failures
  const sanitizedLighting = sanitizeForbiddenTerms(aiDesc.lighting || mapLighting(mood));
  const sanitizedKeyMoment = sanitizeForbiddenTerms(
    aiDesc.keyMoment || directive.goal || directive.conflict || directive.outcome || ""
  );

  return {
    chapter: directive.chapter,
    style,
    composition,
    blocking: sanitizeForbiddenTerms(blocking),
    actions: sanitizeForbiddenTerms(actions),
    propsVisible,
    lighting: sanitizedLighting,
    setting: normalizedSetting || sanitizedEnvironment,
    sceneDescription: sanitizedKeyMoment,
    refs,
    negatives,
    onStageExact,
  };
}

// Removes forbidden portrait-like terms from AI-generated text
function sanitizeForbiddenTerms(text: string): string {
  if (!text) return text;
  const forbidden = ["portrait", "selfie", "close-up", "closeup"];
  let result = text;
  for (const word of forbidden) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    result = result.replace(regex, "medium shot");
  }
  // If the entire string was just a forbidden word, return a safe default
  if (forbidden.some(word => result.toLowerCase().trim() === word)) {
    return "medium shot";
  }
  return result;
}

// ─── Template-Based Spec Builder (original fallback) ──────────────────────

function buildTemplateSpec(
  directive: SceneDirective,
  cast: CastSet,
  beatType: string,
  onStageExact: string[],
  refs: Record<string, string>,
  negatives: string[],
  language: string,
): ImageSpec {
  const fallbackDescription = language === "en"
    ? directive.goal || directive.conflict || directive.outcome || ""
    : buildEnglishFallbackDescription(directive, cast);
  const normalizedSetting = directive.setting ? toEnglish(directive.setting) : "";

  return {
    chapter: directive.chapter,
    style: buildStyle(directive, beatType),
    composition: buildComposition(directive, beatType),
    blocking: buildBlocking(directive, cast),
    actions: buildActions(directive, cast),
    propsVisible: limitPropsVisible(directive, cast),
    lighting: mapLighting(directive.mood),
    setting: normalizedSetting,
    sceneDescription: fallbackDescription,
    refs,
    negatives,
    onStageExact,
  };
}

// ─── Template Helper Functions (unchanged) ────────────────────────────────

function buildStyle(directive: SceneDirective, beatType: string): string {
  const base = "high-quality children's storybook illustration";
  const setting = toEnglish(directive.setting || "").toLowerCase();
  const mood = directive.mood || "COZY";

  // Determine environment-specific style keywords
  let environment = "";
  if (setting.includes("wald") || setting.includes("forest") || setting.includes("wood")) {
    environment = "lush forest background with tall trees and foliage";
  } else if (setting.includes("nebel") || setting.includes("fog") || setting.includes("mist")) {
    environment = "thick fog and misty atmosphere, limited visibility";
  } else if (setting.includes("schloss") || setting.includes("burg") || setting.includes("castle") || setting.includes("palace")) {
    environment = "castle interior with stone walls and arched windows";
  } else if (setting.includes("garten") || setting.includes("garden")) {
    environment = "colorful garden with flowers and greenery";
  } else if (setting.includes("brunnen") || setting.includes("well") || setting.includes("fountain")) {
    environment = "old stone well or fountain as centerpiece";
  } else if (setting.includes("speisesaal") || setting.includes("hall") || setting.includes("dining")) {
    environment = "grand dining hall with long tables and candlelight";
  } else if (setting.includes("zimmer") || setting.includes("room") || setting.includes("chamber") || setting.includes("schlafgemach")) {
    environment = "cozy room interior with furniture and warm candlelight";
  } else if (setting.includes("berg") || setting.includes("mountain") || setting.includes("höhle") || setting.includes("cave")) {
    environment = "rugged mountain landscape or dark cave entrance";
  } else if (setting.includes("meer") || setting.includes("see") || setting.includes("sea") || setting.includes("lake") || setting.includes("strand") || setting.includes("beach")) {
    environment = "water landscape with waves or a calm lake shore";
  } else if (setting.includes("nacht") || setting.includes("night") || setting.includes("dunkel") || setting.includes("dark")) {
    environment = "nighttime scene with moonlight and stars";
  } else if (setting.includes("winter") || setting.includes("schnee") || setting.includes("snow")) {
    environment = "snowy winter landscape with frost-covered trees";
  } else if (setting.includes("lichtung") || setting.includes("clearing") || setting.includes("wiese") || setting.includes("meadow")) {
    environment = "open forest clearing bathed in sunlight";
  } else if (setting) {
    environment = setting;
  }

  const texture = getMoodTexture(mood, beatType);
  const parts = [base, texture];
  if (environment) parts.push(environment);
  return parts.join(", ");
}

function getMoodTexture(mood: string, beatType: string): string {
  if (mood === "TENSE" || mood === "SCARY_LIGHT") {
    return "dramatic ink wash style, moody shadows";
  } else if (mood === "MYSTERIOUS") {
    return "ethereal watercolor with glowing highlights, misty edges";
  } else if (mood === "MAGICAL") {
    return "luminous watercolor with soft glow, sparkling details";
  } else if (mood === "TRIUMPH") {
    return "vibrant watercolor with golden highlights, celebratory tones";
  } else if (mood === "FUNNY") {
    return "bright cheerful watercolor, playful cartoon-like details";
  } else if (mood === "SAD") {
    return "muted watercolor palette, gentle blue-grey tones";
  } else if (mood === "BITTERSWEET") {
    return "soft watercolor with warm light and gentle melancholy";
  } else if (beatType === "CLIMAX") {
    return "dynamic watercolor with bold contrast and vivid colors";
  }
  return "watercolor texture, soft lighting";
}

function buildComposition(directive: SceneDirective, beatType: string): string {
  const mood = directive.mood || "COZY";

  const compositions: Record<string, string> = {
    SETUP: "wide establishing shot, eye-level, full-body characters visible, environment prominently shown",
    INCITING: "medium-wide shot, slight low angle, characters discovering something, environment partly visible",
    CONFLICT: "medium shot, dynamic angle, characters in motion, tense body language",
    CLIMAX: "dramatic medium-close shot, low angle looking up at characters, intense action moment",
    RESOLUTION: "wide shot pulling back, warm and open framing, characters together peacefully",
  };

  let comp = compositions[beatType] || "wide shot, eye-level, full-body characters visible head-to-toe";

  if (mood === "MYSTERIOUS") {
    comp += ", partially obscured elements, atmospheric depth";
  } else if (mood === "TENSE") {
    comp += ", tight framing, characters close together";
  } else if (mood === "TRIUMPH") {
    comp += ", open expansive framing, upward energy";
  }

  return comp;
}

function buildBlocking(directive: SceneDirective, cast: CastSet): string {
  const slots = directive.charactersOnStage.filter(slot => !slot.includes("ARTIFACT"));
  const mood = directive.mood || "COZY";
  const beatType = inferBeatType(directive);

  const positions = slots.map((slot, index) => {
    const name = findName(cast, slot);
    const position = positionLabel(index, slots.length);
    const pose = getDynamicPose(index, slots.length, mood, beatType);
    return `${name} ${pose} ${position}`;
  });

  const gazeDirection = getGazeDirection(slots.length, mood, beatType);

  return positions.join(", ") + ". " + gazeDirection;
}

function buildActions(directive: SceneDirective, cast: CastSet): string {
  const slots = directive.charactersOnStage.filter(slot => !slot.includes("ARTIFACT"));
  const mood = directive.mood || "COZY";
  const beatType = inferBeatType(directive);

  const characters = slots.map(slot => findName(cast, slot));
  const primary = characters[0];
  const others = characters.slice(1);

  const primaryAction = getPrimaryAction(primary, mood, beatType);
  const secondaryActions = others.map((name, idx) => getSecondaryAction(name, idx, mood, beatType));

  const artifactAction = getArtifactAction(directive, cast, mood);

  const allActions = [primaryAction, ...secondaryActions, artifactAction].filter(Boolean);

  return allActions.join(" ");
}

function inferBeatType(directive: SceneDirective): string {
  const setting = directive.setting?.toLowerCase() || "";
  const chapter = directive.chapter;

  if (chapter === 1) return "SETUP";
  if (chapter === 2) return "INCITING";
  if (directive.mood === "TRIUMPH") return "RESOLUTION";
  if (directive.mood === "TENSE") return "CLIMAX";
  if (setting.includes("conflict") || directive.conflict?.includes("obstacle")) return "CONFLICT";
  return "CONFLICT";
}

function getDynamicPose(index: number, _total: number, _mood: string, beatType: string): string {
  const poses: Record<string, string[]> = {
    SETUP: ["walks calmly", "stands relaxed with open posture", "sits comfortably", "gestures warmly"],
    INCITING: ["leans forward curiously", "points toward something", "turns to look", "reaches out"],
    CONFLICT: ["steps forward determinedly", "crouches in ready stance", "holds up hands defensively", "moves quickly"],
    CLIMAX: ["rushes forward", "reaches dramatically", "jumps into action", "faces the challenge"],
    RESOLUTION: ["embraces joyfully", "stands triumphantly", "celebrates with arms raised", "waves happily"],
  };

  const poseSet = poses[beatType] || poses.CONFLICT;
  return poseSet[index % poseSet.length];
}

function getGazeDirection(characterCount: number, _mood: string, beatType: string): string {
  if (characterCount === 1) {
    const options: Record<string, string> = {
      SETUP: "Looking ahead at the path before them.",
      INCITING: "Eyes fixed on something in the distance.",
      CONFLICT: "Gazing intently at the scene before them.",
      CLIMAX: "Eyes focused on the challenge ahead.",
      RESOLUTION: "Looking toward the horizon with hope.",
    };
    return options[beatType] || "Looking at the scene around them.";
  }

  if (characterCount === 2) {
    const options: Record<string, string> = {
      SETUP: "The two characters exchange a warm glance.",
      INCITING: "Both looking at the same point of interest.",
      CONFLICT: "Eyes meet with determination and concern.",
      CLIMAX: "Exchanging a look of understanding.",
      RESOLUTION: "Smiling at each other in celebration.",
    };
    return options[beatType] || "Characters looking at each other.";
  }

  const options: Record<string, string> = {
    SETUP: "The group faces the same direction, ready to begin.",
    INCITING: "All eyes turn toward a new discovery.",
    CONFLICT: "Characters look at each other, planning their next move.",
    CLIMAX: "Focused together on overcoming the challenge.",
    RESOLUTION: "The group gathers together in celebration.",
  };
  return options[beatType] || "Characters interacting with each other.";
}

function getPrimaryAction(name: string, mood: string, beatType: string): string {
  const actions: Record<string, Record<string, string>> = {
    SETUP: {
      COZY: `${name} walks through the scene with curiosity`,
      TENSE: `${name} surveys the surroundings carefully`,
      MYSTERIOUS: `${name} discovers something intriguing`,
      TRIUMPH: `${name} prepares for the journey ahead`,
      FUNNY: `${name} explores with playful curiosity`,
    },
    INCITING: {
      COZY: `${name} encounters someone unexpected`,
      TENSE: `${name} spots something concerning in the distance`,
      MYSTERIOUS: `${name} follows a mysterious clue`,
      TRIUMPH: `${name} takes the first brave step`,
      FUNNY: `${name} stumbles upon a funny situation`,
    },
    CONFLICT: {
      COZY: `${name} works to solve a problem`,
      TENSE: `${name} faces a difficult challenge`,
      MYSTERIOUS: `${name} unravels a mystery`,
      TRIUMPH: `${name} overcomes an obstacle`,
      FUNNY: `${name} gets into a comical situation`,
    },
    CLIMAX: {
      COZY: `${name} steps forward to try a new plan`,
      TENSE: `${name} confronts the biggest challenge`,
      MYSTERIOUS: `${name} discovers the truth`,
      TRIUMPH: `${name} achieves a breakthrough`,
      FUNNY: `${name} solves the problem in an unexpected way`,
    },
    RESOLUTION: {
      COZY: `${name} celebrates with friends`,
      TENSE: `${name} finally relaxes after the adventure`,
      MYSTERIOUS: `${name} reflects on what was learned`,
      TRIUMPH: `${name} rejoices in victory`,
      FUNNY: `${name} laughs together with everyone`,
    },
  };

  const beatActions = actions[beatType] || actions.CONFLICT;
  return (beatActions[mood] || beatActions.COZY) + ".";
}

function getSecondaryAction(name: string, index: number, _mood: string, beatType: string): string {
  const reactions: Record<string, string[]> = {
    SETUP: [
      `${name} follows along with interest`,
      `${name} offers helpful advice`,
      `${name} watches supportively`,
    ],
    INCITING: [
      `${name} reacts with surprise`,
      `${name} points something out`,
      `${name} looks on with concern`,
    ],
    CONFLICT: [
      `${name} helps tackle the challenge`,
      `${name} provides crucial assistance`,
      `${name} stands ready to help`,
    ],
    CLIMAX: [
      `${name} supports the effort`,
      `${name} contributes to the solution`,
      `${name} cheers encouragement`,
    ],
    RESOLUTION: [
      `${name} joins in the celebration`,
      `${name} shares in the joy`,
      `${name} expresses happiness`,
    ],
  };

  const beatReactions = reactions[beatType] || reactions.CONFLICT;
  return (beatReactions[index % beatReactions.length]) + ".";
}

function getArtifactAction(directive: SceneDirective, cast: CastSet, mood: string): string {
  const artifactName = cast.artifact?.name;
  if (!artifactName) return "";

  const hasArtifact = directive.charactersOnStage.includes("SLOT_ARTIFACT_1") ||
    directive.artifactUsage?.toLowerCase().includes("rolle") ||
    directive.artifactUsage?.toLowerCase().includes("relevant") ||
    directive.artifactUsage?.toLowerCase().includes("function");

  if (!hasArtifact) return "";

  const artifactActions = [
    `The ${artifactName} glows with magical energy nearby.`,
    `${artifactName} is visible and plays a key role in the scene.`,
    `The characters interact with the ${artifactName}.`,
    `${artifactName} helps guide the way forward.`,
  ];

  const idx = mood === "TRIUMPH" ? 3 : mood === "TENSE" ? 1 : mood === "MYSTERIOUS" ? 0 : 2;
  return artifactActions[idx % artifactActions.length];
}

function positionLabel(index: number, total: number): string {
  if (total === 1) return "center";
  if (total === 2) return index === 0 ? "left" : "right";
  if (total === 3) return ["left", "center", "right"][index] || "center";
  if (total === 4) return ["far left", "left-center", "right-center", "far right"][index] || "center";
  return `position ${index + 1}`;
}

function mapLighting(mood?: SceneDirective["mood"]): string {
  switch (mood) {
    case "TENSE":
      return "dramatic lighting with soft shadows";
    case "MYSTERIOUS":
      return "misty, glowing light";
    case "MAGICAL":
      return "glowing, enchanted light with gentle sparkles";
    case "TRIUMPH":
      return "bright, celebratory light";
    case "FUNNY":
      return "cheerful, sunny light";
    case "BITTERSWEET":
      return "soft warm light with a hint of dusk";
    default:
      return "warm, gentle light";
  }
}

function findName(cast: CastSet, slotKey: string): string {
  const sheet = cast.avatars.find(a => a.slotKey === slotKey) || cast.poolCharacters.find(c => c.slotKey === slotKey);
  return sheet?.displayName ?? slotKey;
}

function limitPropsVisible(directive: SceneDirective, cast: CastSet): string[] {
  const maxItems = 7;
  const rawItems = directive.imageMustShow || [];
  const artifactName = cast.artifact?.name;
  const requiresArtifact = directive.charactersOnStage.includes("SLOT_ARTIFACT_1");
  const settingText = (directive.setting || "").toLowerCase();
  const characterNames = [
    ...cast.avatars.map(a => a.displayName),
    ...cast.poolCharacters.map(c => c.displayName),
    cast.artifact?.name,
  ]
    .filter(Boolean)
    .map(name => String(name).toLowerCase());
  const seen = new Set<string>();
  const result: string[] = [];

  const isCharacterName = (valueLower: string) => {
    return characterNames.some(name => name && (valueLower === name || valueLower.includes(name)));
  };

  const isSettingLike = (valueLower: string) => {
    if (!settingText) return false;
    return valueLower === settingText || valueLower.includes(settingText) || settingText.includes(valueLower);
  };

  const add = (value?: string | null) => {
    if (!value) return;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) return;
    const lower = trimmed.toLowerCase();
    if (isCharacterName(lower) || isSettingLike(lower)) return;
    if (result.length >= maxItems) return;
    seen.add(trimmed);
    result.push(trimmed);
  };

  if (requiresArtifact && artifactName) add(artifactName);

  for (const item of rawItems) {
    if (typeof item !== "string") continue;
    if (item.toLowerCase().includes("extra characters")) continue;
    add(item);
  }

  if (requiresArtifact && artifactName && !seen.has(artifactName) && result.length < maxItems) {
    add(artifactName);
  }

  return result;
}

function filterPropsList(props: string[], cast: CastSet, directive: SceneDirective): string[] {
  const settingText = (directive.setting || "").toLowerCase();
  const characterNames = [
    ...cast.avatars.map(a => a.displayName),
    ...cast.poolCharacters.map(c => c.displayName),
    cast.artifact?.name,
  ]
    .filter(Boolean)
    .map(name => String(name).toLowerCase());

  return props.filter((raw) => {
    const value = String(raw || "").trim();
    if (!value) return false;
    const lower = value.toLowerCase();
    if (characterNames.some(name => name && (lower === name || lower.includes(name)))) return false;
    if (settingText && (lower === settingText || lower.includes(settingText) || settingText.includes(lower))) return false;
    return true;
  });
}

function mergeProps(aiProps: string[], templateProps: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const maxItems = 7;

  for (const prop of [...aiProps, ...templateProps]) {
    const trimmed = prop.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    if (result.length >= maxItems) break;
    seen.add(trimmed);
    result.push(trimmed);
  }

  return result;
}

function normalizeSpecToEnglish(spec: ImageSpec): ImageSpec {
  return {
    ...spec,
    style: toEnglish(spec.style),
    composition: toEnglish(spec.composition),
    blocking: toEnglish(spec.blocking),
    actions: toEnglish(spec.actions),
    lighting: toEnglish(spec.lighting),
    setting: toEnglish(spec.setting || ""),
    sceneDescription: toEnglish(spec.sceneDescription || ""),
    propsVisible: (spec.propsVisible || []).map(item => toEnglish(item)),
  };
}

function toEnglish(text: string): string {
  if (!text) return text;
  let result = text;

  // Normalize common German umlauts to ASCII
  result = result.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/gi, "ue").replace(/ß/g, "ss");
  result = result.replace(/Ä/g, "Ae").replace(/Ö/g, "Oe").replace(/Ü/g, "Ue");
  result = result.replace(/\u00e4/g, "ae").replace(/\u00f6/g, "oe").replace(/\u00fc/gi, "ue").replace(/\u00df/g, "ss");
  result = result.replace(/\u00c4/g, "Ae").replace(/\u00d6/g, "Oe").replace(/\u00dc/g, "Ue");

  const replacements: Array<[RegExp, string]> = [
    [/\bkinderzimmer\b/gi, "nursery"],
    [/\bfensterbrett\b/gi, "windowsill"],
    [/\bfenster\b/gi, "window"],
    [/\bteppich\b/gi, "carpet"],
    [/\bbett\b/gi, "bed"],
    [/\bzimmer\b/gi, "room"],
    [/\bschatten\b/gi, "shadow"],
    [/\bnadel\b/gi, "needle"],
    [/\bgarn\b/gi, "thread"],
    [/\bmaerchenbuch\b/gi, "storybook"],
    [/\bmaerchen\b/gi, "fairy tale"],
    [/\bnebel\b/gi, "mist"],
    [/\bnebelhexe\b/gi, "mist witch"],
    [/\bwald\b/gi, "forest"],
    [/\bnebelwald\b/gi, "misty forest"],
    [/\bwinterwald\b/gi, "winter forest"],
    [/\bherbstwald\b/gi, "autumn forest"],
    [/\bherbst\b/gi, "autumn"],
    [/\bschloss\b/gi, "castle"],
    [/\bburg\b/gi, "castle"],
    [/\bunterwasserpalast\b/gi, "underwater palace"],
    [/\bpalast\b/gi, "palace"],
    [/\bthronsaal\b/gi, "throne hall"],
    [/\bstrasse\b/gi, "street"],
    [/\bhauptstrasse\b/gi, "main street"],
    [/\bmarkt\b/gi, "market"],
    [/\bplatz\b/gi, "square"],
    [/\blicht\b/gi, "light"],
    [/\bwind\b/gi, "wind"],
    [/\bnacht\b/gi, "night"],
    [/\btag\b/gi, "day"],
    [/\bsturmstrand\b/gi, "stormy beach"],
    [/\bsturm\b/gi, "storm"],
    [/\bstrand\b/gi, "beach"],
    [/\bkueste\b/gi, "coast"],
    [/\bk\u00fcste\b/gi, "coast"],
    [/\bmeer\b/gi, "sea"],
    [/\bunterwasser\b/gi, "underwater"],
    [/\bhoehle\b/gi, "cave"],
    [/\bh\u00f6hle\b/gi, "cave"],
    [/\bklippe\b/gi, "cliff"],
    [/\binsel\b/gi, "island"],
    [/\bzauberstab\b/gi, "magic wand"],
  ];

  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }

  return result;
}

function dedupeEnvironmentParts(parts: string[]): string[] {
  const result: string[] = [];
  for (const part of parts) {
    const value = (part || "").trim();
    if (!value) continue;
    const lower = value.toLowerCase();
    const isDuplicate = result.some(existing => {
      const existingLower = existing.toLowerCase();
      return existingLower === lower || existingLower.includes(lower) || lower.includes(existingLower);
    });
    if (!isDuplicate) result.push(value);
  }
  return result;
}

function buildEnglishFallbackDescription(directive: SceneDirective, cast: CastSet): string {
  const characterNames = directive.charactersOnStage
    .filter(slot => !slot.includes("ARTIFACT"))
    .map(slot => findName(cast, slot))
    .filter(Boolean)
    .join(", ");

  const setting = directive.setting ? `in ${toEnglish(directive.setting)}` : "in the scene";
  return `A key moment ${setting} with ${characterNames} acting together.`;
}



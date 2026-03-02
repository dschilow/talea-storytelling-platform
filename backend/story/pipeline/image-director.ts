import type { AICharacterAction, AISceneDescription, CastSet, ImageDirector, ImageSpec, NormalizedRequest, SceneDirective, StoryDraft } from "./types";
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
      // Include artifact in cache key when it's on stage for this scene
      const hasArtifactOnStage = directive.charactersOnStage.includes("SLOT_ARTIFACT_1");
      const artifactSuffix = hasArtifactOnStage && cast.artifact?.imageUrl ? "|ARTIFACT" : "";
      const cacheKey = [...refSlots].sort().join("|") + artifactSuffix;
      if (!collageCache.has(cacheKey)) {
        collageCache.set(cacheKey, buildCollageReference(refSlots, cast, directive));
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

  const desc = storyDraft.description ? ` ${storyDraft.description}` : "";
  const sceneDescription = `Illustration for the story.${desc}`.trim();

  const style = `high-quality children's storybook illustration, ${getMoodTexture(mood, "SETUP")}${setting ? `, ${setting}` : ""}`;
  const composition = "wide shot, eye-level, full body visible head-to-toe, balanced composition";
  const blocking = "Characters arranged in a clear grouping, interacting with the scene.";
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
  const characterNames = onStageExact
    .map(slot => findName(cast, slot))
    .filter(Boolean);
  const parsedActions = Array.isArray(aiDesc.characterActions) ? aiDesc.characterActions : [];
  const blockingParts = onStageExact.map((slotKey, index) => {
    const name = findName(cast, slotKey);
    const resolved = findActionBySlotOrName(parsedActions, slotKey, name);
    const bodyLanguage = ensureDynamicBodyLanguage(
      sanitizeActionPhrase(String(resolved?.bodyLanguage || ""), characterNames),
      index,
    );
    const expression = sanitizeActionPhrase(String(resolved?.expression || ""), characterNames) || defaultExpression(index);
    return `${name} ${bodyLanguage}, ${expression}`;
  });
  const blocking = dedupeSentences(blockingParts).join(" ");

  // Build explicit per-character actions in on-stage order.
  const actionParts = onStageExact.map((slotKey, index) => {
    const name = findName(cast, slotKey);
    const resolved = findActionBySlotOrName(parsedActions, slotKey, name);
    const action = ensureDynamicActionPhrase(
      sanitizeActionPhrase(String(resolved?.action || ""), characterNames),
      index,
    );
    return `${name} ${action}.`;
  });

  // Add artifact action if relevant
  const artifactAction = getArtifactAction(directive, cast, directive.mood || "COZY");
  if (artifactAction) actionParts.push(artifactAction);
  const actions = dedupeSentences(actionParts).join(" ");

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
  const forbidden = ["portrait", "selfie", "close-up", "closeup", "looking at camera", "look at camera", "staring at viewer"];
  let result = text;
  for (const word of forbidden) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    result = result.replace(regex, "wide shot");
  }
  // If the entire string was just a forbidden word, return a safe default
  if (forbidden.some(word => result.toLowerCase().trim() === word)) {
    return "wide shot";
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
    return "dramatic ink wash style with visible brushstrokes, deep moody shadows cast across the scene, splattered ink edges suggesting danger";
  } else if (mood === "MYSTERIOUS") {
    return "ethereal watercolor with luminous fog layers, paint bleeding at edges, mysterious glowing highlights peeking through mist, visible paper grain";
  } else if (mood === "MAGICAL") {
    return "luminous watercolor with paint pooling into sparkling light effects, golden and violet washes blending wet-on-wet, tiny hand-painted sparkle details";
  } else if (mood === "TRIUMPH") {
    return "bold expressive watercolor with splashes of gold and warm orange, energetic visible brushwork, paint dripping with joyful abandon, celebratory light burst";
  } else if (mood === "FUNNY") {
    return "bright loose watercolor with exaggerated playful proportions, wobbly hand-drawn linework, cheerful splashy color pops, visible pencil underdrawing";
  } else if (mood === "SAD") {
    return "muted watercolor in rain-washed blue-grey tones, paint diluted and running downward, soft wet-on-wet bleeds suggesting tears, gentle paper texture";
  } else if (mood === "BITTERSWEET") {
    return "warm amber watercolor with soft edges fading to cool blue, gentle light-and-shadow interplay, nostalgic golden-hour palette";
  } else if (beatType === "CLIMAX") {
    return "dynamic watercolor with bold confident strokes, high-contrast color collision, paint splatters suggesting explosive energy, vivid saturated pigments";
  }
  return "hand-painted watercolor texture with visible brushstrokes, warm palette, soft directional lighting, cozy picture-book atmosphere";
}

function buildComposition(directive: SceneDirective, beatType: string): string {
  const mood = directive.mood || "COZY";

  const compositions: Record<string, string> = {
    SETUP: "wide establishing shot, slightly elevated camera looking down into the scene, characters small within a rich detailed environment, depth layers with foreground objects framing the view",
    INCITING: "medium-wide shot from low angle, camera behind one character looking over their shoulder at the discovery, environmental depth with leading lines drawing eye to the action",
    CONFLICT: "dynamic wide shot with slight dutch tilt, characters scattered across the frame at different heights and distances, diagonal composition suggesting movement and tension",
    CLIMAX: "dramatic wide shot from ground-level looking up, characters mid-action filling the frame with energy, environment reacting to the action (dust/sparks/wind/water)",
    RESOLUTION: "warm wide pullback shot, gentle bird's-eye angle, characters gathered close in the lower third with expansive sky or scenery above, peaceful asymmetric composition",
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

  const interactionLine = slots.length > 1
    ? "Bodies angled toward each other and key props, never posed front-facing toward camera."
    : "Body angled toward the key prop, not front-facing camera.";

  return positions.join(", ") + ". " + interactionLine;
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
    SETUP: [
      "climbs onto a mossy rock to get a better view, one hand shielding eyes from the sun",
      "kneels in the tall grass examining something on the ground, backpack sliding off one shoulder",
      "balances on a fallen log with arms outstretched, hair blowing in the breeze",
      "leans against a tree trunk peeking around it cautiously, fingers gripping the bark",
    ],
    INCITING: [
      "stumbles backward in surprise with arms windmilling, knocking into a bush",
      "drops to all fours crawling toward a glowing object half-buried in leaves",
      "throws both hands up to catch something falling from above, rising on tiptoes",
      "grabs a companion's sleeve and pulls them behind a rock, pointing urgently",
    ],
    CONFLICT: [
      "braces against a heavy wooden door pushing with all body weight, feet sliding on stone floor",
      "ducks under a low-hanging branch mid-sprint, cloak tangled in thorns",
      "stands on a wobbly chair reaching for something on a high shelf, wobbling precariously",
      "hauls a heavy rope hand-over-hand, leaning back with feet planted wide apart",
    ],
    CLIMAX: [
      "leaps across a gap mid-air with legs tucked, reaching for the far edge",
      "slides on knees across wet ground to catch a falling object at the last second",
      "swings from a vine or rope one-handed, stretching the other hand toward a friend",
      "throws a glowing object upward with both hands, face lit from below by its light",
    ],
    RESOLUTION: [
      "collapses onto a grassy bank laughing, legs dangling over the edge",
      "carries a tired companion piggyback-style, both grinning ear to ear",
      "sits cross-legged on the ground examining a treasure together, heads touching",
      "dances in a circle holding hands, feet kicking up autumn leaves",
    ],
  };

  const poseSet = poses[beatType] || poses.CONFLICT;
  return poseSet[index % poseSet.length];
}

function getPrimaryAction(name: string, mood: string, beatType: string): string {
  const actions: Record<string, Record<string, string>> = {
    SETUP: {
      COZY: `${name} hops off a stone wall into the meadow, landing with bent knees and arms out for balance, scattering butterflies`,
      TENSE: `${name} presses flat against a rough stone wall and peeks around the corner, one eye visible, fingers white-knuckled on the edge`,
      MYSTERIOUS: `${name} crouches low in the undergrowth, brushing aside ferns to reveal a strange marking on the ground, nose almost touching the earth`,
      TRIUMPH: `${name} stands on a hilltop with arms thrown wide, wind whipping hair and clothes sideways, a trail of footprints behind`,
      FUNNY: `${name} trips over a root and tumbles forward, catching a low branch with one hand while the other clutches a slipping hat`,
    },
    INCITING: {
      COZY: `${name} stretches on tiptoes to pluck a glowing fruit from a high branch, tongue poking out in concentration`,
      TENSE: `${name} grabs a companion and drags them behind a barrel as something crashes nearby, dust and splinters flying`,
      MYSTERIOUS: `${name} traces a finger along a glowing trail on the ground, following it on hands and knees through a crack in a wall`,
      TRIUMPH: `${name} snatches a spinning key out of mid-air with a one-handed grab, skidding to a stop on gravel`,
      FUNNY: `${name} yanks open a creaky door only to be buried under an avalanche of junk tumbling out, legs sticking out comically`,
    },
    CONFLICT: {
      COZY: `${name} pulls a friend up a steep bank with both hands, boots digging into the mud, rain dripping off both of them`,
      TENSE: `${name} shoves a heavy table against a rattling door, sweat on forehead, one foot braced against the floor`,
      MYSTERIOUS: `${name} turns a series of stone wheels on an ancient mechanism, squinting at fading symbols, gears clicking into place`,
      TRIUMPH: `${name} hurls a rope across a ravine and cinches it tight, testing the tension with a sharp tug before waving the others across`,
      FUNNY: `${name} juggles three objects while running, dropping one, kicking it up with a foot, and catching it behind the back`,
    },
    CLIMAX: {
      COZY: `${name} dives forward to catch a falling companion's hand at the edge, flat on stomach with arm extended over the void`,
      TENSE: `${name} spins to face the threat with feet wide apart, holding up the key artifact like a shield, light blazing from it`,
      MYSTERIOUS: `${name} slams the final puzzle piece into the mosaic, cracks of golden light spreading outward from the impact`,
      TRIUMPH: `${name} leaps from a crumbling ledge and grabs a swinging chain, momentum carrying them in a wide arc across the chamber`,
      FUNNY: `${name} accidentally triggers the solution by sitting on the wrong lever, catapulting into a pile of cushions while everything clicks into place`,
    },
    RESOLUTION: {
      COZY: `${name} flops onto soft grass beside the others, all lying in a star pattern gazing up at the sky, laughing breathlessly`,
      TENSE: `${name} sits on a doorstep wrapping a bandage around a scraped knee, smiling wearily at a companion handing over a water bottle`,
      MYSTERIOUS: `${name} carefully places the found treasure in a lined box, closing the lid with both hands and blowing out a long relieved breath`,
      TRIUMPH: `${name} hoists the prize overhead standing on a boulder, the others cheering below with arms raised, confetti of flower petals in the air`,
      FUNNY: `${name} does a silly victory dance on a table, mimicking the defeated villain while the others double over laughing`,
    },
  };

  const beatActions = actions[beatType] || actions.CONFLICT;
  return (beatActions[mood] || beatActions.COZY) + ".";
}

function getSecondaryAction(name: string, index: number, _mood: string, beatType: string): string {
  const reactions: Record<string, string[]> = {
    SETUP: [
      `${name} squats beside a stream splashing water on a dusty face, sleeves rolled up, ripples spreading outward`,
      `${name} rummages through a satchel pulling out a crumpled map, holding it sideways and squinting at it upside-down`,
      `${name} perches on a tree stump sketching the landscape in a little notebook, pencil tucked behind one ear`,
    ],
    INCITING: [
      `${name} presses an ear flat against a wooden door listening intently, one finger raised to shush the others`,
      `${name} scrambles up a pile of crates to peek through a high window, feet dangling and arms straining`,
      `${name} scoops up a startled small creature and tucks it safely inside a coat pocket, whispering reassurances`,
    ],
    CONFLICT: [
      `${name} holds a flickering lantern high to illuminate the path while rain streams down an outstretched arm`,
      `${name} wedges a thick stick under a boulder and leans on it with full body weight, feet skidding`,
      `${name} shields a smaller companion with outstretched arms, back turned to the danger, cloak billowing`,
    ],
    CLIMAX: [
      `${name} throws a heavy cloak over a flame to smother it, diving sideways to avoid the smoke`,
      `${name} catches a sliding companion by the ankle just before they go over the edge, bracing against a post`,
      `${name} heaves a stone slab aside revealing a hidden passage, veins standing out on straining arms`,
    ],
    RESOLUTION: [
      `${name} hangs upside-down from a low branch offering an apple to the others below, grinning`,
      `${name} carefully bandages a friend's scraped hand, tongue poking out in concentration`,
      `${name} stack-carries wobbling celebration treats on both arms, chin holding the top one steady`,
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
      return "harsh sidelight casting long angular shadows, single light source from a torch or crack in the wall, deep contrast between lit and unlit areas";
    case "MYSTERIOUS":
      return "soft bioluminescent glow from below mixed with pale moonlight filtering through canopy, volumetric mist catching scattered light beams";
    case "MAGICAL":
      return "warm golden light radiating from a magical source, casting prismatic rainbow refractions on nearby surfaces, gentle sparkle particles floating in the air";
    case "TRIUMPH":
      return "bright warm sunlight breaking through clouds in dramatic god-rays, rim light on characters creating a heroic silhouette edge, lens-flare warmth";
    case "FUNNY":
      return "bright even daylight with playful dappled tree shadows, cheerful sun high in a blue sky, everything well-lit and colorful";
    case "BITTERSWEET":
      return "golden-hour sunset light casting everything in warm amber, long gentle shadows stretching across the ground, sky transitioning from warm to cool";
    case "SAD":
      return "overcast diffused light with no harsh shadows, cool blue-grey tones, occasional break in clouds letting a single warm ray through";
    case "SCARY_LIGHT":
      return "flickering unstable light from a candle or fireplace, shadows jumping and shifting on walls, warm core with cold dark edges";
    default:
      return "warm afternoon light filtering through leaves creating dappled patterns on the ground, cozy and inviting with gentle shadows";
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
    if (isCharacterName(lower) || isSettingLike(lower) || isPersonLike(lower) || isLocationLike(lower) || isCharacterDescriptorPhrase(lower)) return;
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
  ]
    .filter(Boolean)
    .map(name => String(name).toLowerCase());

  return props.filter((raw) => {
    const value = String(raw || "").trim();
    if (!value) return false;
    const lower = value.toLowerCase();
    if (characterNames.some(name => name && (lower === name || lower.includes(name)))) return false;
    if (settingText && (lower === settingText || lower.includes(settingText) || settingText.includes(lower))) return false;
    if (isCharacterDescriptorPhrase(lower)) return false;
    if (isPersonLike(lower) || isLocationLike(lower)) return false;
    return true;
  });
}

const PERSON_LIKE_TOKENS = [
  "human",
  "person",
  "people",
  "child",
  "boy",
  "girl",
  "man",
  "woman",
  "adult",
  "teen",
  "teenager",
  "stranger",
  "villager",
  "bystander",
  "crowd",
  "family",
  "parent",
  "mother",
  "father",
  "friend",
  "partner",
  "helper",
  "fremder",
  "fremde",
  "kind",
  "junge",
  "maedchen",
  "mann",
  "frau",
  "menschen",
  "leute",
  "helfer",
  "familie",
];

const LOCATION_TOKENS = [
  "forest",
  "woods",
  "village",
  "town",
  "city",
  "barn",
  "stable",
  "castle",
  "palace",
  "cave",
  "mountain",
  "beach",
  "sea",
  "lake",
  "river",
  "meadow",
  "garden",
  "park",
  "street",
  "market",
  "square",
  "room",
  "house",
  "home",
  "school",
  "yard",
  "farm",
  "field",
  "valley",
  "cliff",
  "island",
  "desert",
  "forest",
  "barn",
  "sunset",
  "sunrise",
  "night",
  "dusk",
  "dawn",
  "wald",
  "dorf",
  "stadt",
  "scheune",
  "burg",
  "schloss",
  "hoehle",
  "hoehl",
  "meer",
  "see",
  "strand",
  "berg",
  "wiese",
  "garten",
  "park",
  "strasse",
  "markt",
  "platz",
  "zimmer",
  "haus",
];

function isPersonLike(valueLower: string): boolean {
  return PERSON_LIKE_TOKENS.some(token => valueLower.includes(token));
}

function isLocationLike(valueLower: string): boolean {
  return LOCATION_TOKENS.some(token => valueLower.includes(token));
}

const CHARACTER_DESCRIPTOR_TOKENS = [
  "eichhoernchen",
  "squirrel",
  "kobold",
  "goblin",
  "dragon",
  "unicorn",
  "fox",
  "wolf",
  "dog",
  "cat",
  "bird",
  "companion",
  "avatar",
  "character",
];

function isCharacterDescriptorPhrase(valueLower: string): boolean {
  const wordCount = valueLower.split(/\s+/).filter(Boolean).length;
  if (wordCount < 3) return false;
  return CHARACTER_DESCRIPTOR_TOKENS.some(token => valueLower.includes(token));
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

function findActionBySlotOrName(
  actions: AICharacterAction[],
  slotKey: string,
  characterName: string,
): AICharacterAction | null {
  const normalizedSlot = normalizeSlotKey(slotKey);
  for (const entry of actions) {
    if (!entry) continue;
    if (normalizeSlotKey(entry.slotKey) === normalizedSlot) return entry;
  }

  const nameLower = characterName.trim().toLowerCase();
  if (!nameLower) return null;
  for (const entry of actions) {
    const haystack = [
      entry.slotKey,
      (entry as any).name,
      (entry as any).characterName,
      (entry as any).character,
    ]
      .map(value => String(value || "").trim().toLowerCase())
      .filter(Boolean)
      .join(" ");
    if (haystack.includes(nameLower)) return entry;
  }

  return null;
}

function normalizeSlotKey(value: string): string {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "");
}

function ensureDynamicActionPhrase(action: string, index: number): string {
  const cleaned = normalizeMovementClause(normalizeActionText(action));
  if (!cleaned) return fallbackDynamicAction(index);

  const lowered = cleaned.toLowerCase();
  if (STATIC_ACTION_PATTERNS.some(pattern => pattern.test(lowered)) && !hasDynamicVerb(lowered)) {
    return fallbackDynamicAction(index);
  }
  if (!hasDynamicVerb(lowered) && !MOVEMENT_PHRASE_PATTERN.test(lowered)) {
    return `${cleaned} while moving decisively`;
  }
  return cleaned;
}

function ensureDynamicBodyLanguage(bodyLanguage: string, index: number): string {
  const cleaned = normalizeActionText(bodyLanguage);
  if (!cleaned) return fallbackDynamicPose(index);

  const lowered = cleaned.toLowerCase();
  if (STATIC_POSE_PATTERNS.some(pattern => pattern.test(lowered))) {
    return fallbackDynamicPose(index);
  }
  return cleaned;
}

function normalizeActionText(value: string): string {
  if (!value) return "";
  return value
    .replace(/\s+/g, " ")
    .replace(/^[,.;:\-]+/, "")
    .trim();
}

function hasDynamicVerb(value: string): boolean {
  return DYNAMIC_VERBS.some(verb => value.includes(verb));
}

function normalizeMovementClause(value: string): string {
  if (!value) return "";
  let result = value;
  result = result.replace(/\bwhile\s+moving\s+decisively\b/gi, "while actively moving");
  result = result.replace(/\bwhile\s+actively\s+moving\b(?:\s+\bwhile\s+actively\s+moving\b)+/gi, "while actively moving");
  result = result.replace(/\s+/g, " ").trim();
  return result;
}

function fallbackDynamicAction(index: number): string {
  const fallbacks = [
    "scrambles over a moss-covered boulder, fingers digging into cracks, pebbles rolling underfoot",
    "slides on knees across wet ground to grab a rolling object, one hand slamming down for balance",
    "climbs a rickety ladder one rung at a time, free hand clutching a flickering torch overhead",
    "vaults over a low wall using one hand, landing in a crouch on the other side with momentum",
  ];
  return fallbacks[index % fallbacks.length];
}

function fallbackDynamicPose(index: number): string {
  const fallbacks = [
    "mid-leap with knees tucked and arms reaching forward, hair streaming behind",
    "crouched on one knee with torso twisted, both hands grasping a heavy object close to the ground",
    "balanced on a narrow beam with arms outstretched like a tightrope walker, looking down nervously",
    "running full tilt with body leaned forward at 45 degrees, cloak flying, one arm pumping",
  ];
  return fallbacks[index % fallbacks.length];
}

function defaultExpression(index: number): string {
  const fallbacks = [
    "focused expression",
    "determined expression",
    "alert expression",
    "tense but controlled expression",
  ];
  return fallbacks[index % fallbacks.length];
}

function dedupeSentences(lines: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const normalized = line
      .replace(/[.!?]+$/g, "")
      .replace(/\s+/g, " ")
      .toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(/[.!?]$/.test(line) ? line : `${line}.`);
  }
  return output;
}

const STATIC_ACTION_PATTERNS = [
  /\bstand(?:s|ing)?\b/,
  /\blook(?:s|ing)?\b/,
  /\bwatch(?:es|ing)?\b/,
  /\bpose(?:s|d)?\b/,
  /\bfacing\s+(?:camera|viewer)\b/,
  /\bwait(?:s|ing)?\b/,
  /\bidle\b/,
];

const STATIC_POSE_PATTERNS = [
  /\bstanding\b/,
  /\bupright\b/,
  /\bidle\b/,
  /\bneutral\b/,
  /\bfront-?facing\b/,
  /\bfacing\s+(?:camera|viewer)\b/,
  /\bposed?\b/,
];

const DYNAMIC_VERBS = [
  "run", "sprint", "dash", "jump", "leap", "lunge", "crawl", "climb", "duck", "grab",
  "pull", "push", "lift", "hold", "open", "read", "tap", "swing", "throw", "catch",
  "brace", "reach", "drag", "step", "vault", "slide", "kneel", "crouch", "pivot",
  "race", "charge", "scramble", "hurry", "stabilize", "balance",
];
const MOVEMENT_PHRASE_PATTERN = /\bwhile\s+(?:actively\s+)?moving(?:\s+decisively)?\b/i;

function sanitizeActionPhrase(text: string, names: string[]): string {
  if (!text) return "";
  let result = text.trim();
  if (!result) return "";

  for (const name of names) {
    if (!name) continue;
    const pattern = new RegExp(`\\b${escapeRegExp(name)}\\b`, "gi");
    result = result.replace(pattern, " ").replace(/\s{2,}/g, " ").trim();
  }

  result = result.replace(/^('s|\\u2019s)\\s+/i, "").trim();
  result = result.replace(/^[,.:;\\-]+\\s*/g, "").trim();
  return result;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
    [/\bhilfsbereiter\s+fremder\b/gi, "helpful stranger"],
    [/\bfremder\b/gi, "stranger"],
    [/\bdrachenauge\b/gi, "dragon-eye gem"],
    [/\btopf\b/gi, "pot"],
    [/\bscheune\b/gi, "barn"],
    [/\bbrief\b/gi, "letter"],
    [/\bbriefe\b/gi, "letters"],
    [/\bglas\b/gi, "glass"],
    [/\bsonnenuntergang\b/gi, "sunset"],
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
